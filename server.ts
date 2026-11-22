/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

class BoundedMap<K, V> extends Map<K, V> {
  maxEntries: number;
  constructor(maxEntries: number) {
    super();
    this.maxEntries = maxEntries;
  }
  set(key: K, value: V): this {
    if (this.has(key)) {
      this.delete(key);
    } else if (this.size >= this.maxEntries) {
      const oldest = this.keys().next().value;
      if (oldest !== undefined) this.delete(oldest);
    }
    return super.set(key, value);
  }
}


function stripHttpOptions(val: any): any {
  if (!val || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripHttpOptions);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (
      k === "httpOptions" ||
      k === "http_options" ||
      k === "__proto__" ||
      k === "constructor" ||
      k === "prototype" ||
      k === "cachedContent" ||
      k === "cached_content" ||
      k === "fileSearch" ||
      k === "file_search" ||
      k === "corpora" ||
      k === "semanticRetriever" ||
      k === "semantic_retriever"
    ) continue;
    if ((k === "fileData" || k === "file_data") && v && typeof v === "object") {
      const rawU = (v as any).fileUri ?? (v as any).file_uri;
      const u = typeof rawU === "string" ? rawU.trim() : "";
      if (!/^https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(u)) continue;
    }
    out[k] = stripHttpOptions(v);
  }
  return out;
}


const MODEL_UPGRADES: Record<string, string> = {
  "gemini-2.5-flash": "gemini-3.1-flash-lite",
  "gemini-2.5-pro": "gemini-4-argon",
  "gemini-3-pro-preview": "gemini-4-argon",
  "gemini-3-flash-preview": "gemini-3.1-flash-lite",
  "gemini-2.0-flash": "gemini-3.1-flash-lite",
  "gemini-2.0-flash-exp": "gemini-3.1-flash-lite",
  "gemini-4-hydrogen": "gemini-3.1-flash-lite",
};

const ALLOWED_MODEL_RE = /^(?!.*\.\.)(?:models\/)?(?:gemini-|imagen-|veo-|lyria-|learnlm-|text-embedding-|gemini-embedding-)[a-zA-Z0-9._-]+$/;

function resolveModel(model?: string): string {
  const candidate = !model ? "gemini-3.1-flash-lite" : MODEL_UPGRADES[model] || model;
  if (!ALLOWED_MODEL_RE.test(candidate)) {
    throw new Error(`Disallowed model: ${candidate}`);
  }
  return candidate;
}

function getServerApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : undefined;
}

const MISSING_API_KEY_ERROR =
  "GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Render > Environment (or hosting Secrets) and redeploy.";

function createAiClient(apiKey: string) {
  return new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function serializeGenerateContentResponse(r: any) {
  return {
    candidates: r?.candidates,
    promptFeedback: r?.promptFeedback,
    usageMetadata: r?.usageMetadata,
    modelVersion: r?.modelVersion,
    responseId: r?.responseId,
    text: r?.text,
    functionCalls: r?.functionCalls,
    data: r?.data,
    executableCode: r?.executableCode,
    codeExecutionResult: r?.codeExecutionResult,
  };
}

const chats = new BoundedMap<string, any>(200);
const videoOps = new BoundedMap<string, { op: any; ownerKey: string }>(100);
const apiRateLimits = new BoundedMap<string, { count: number; resetAt: number }>(1000);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 45;

// --- Gemini Flash-Lite TTS (gemini-3.8-flash-lite-tts) Cache & RPM/TPM/RPD Governor ---
function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const TTS_RPM_LIMIT = parseNonNegativeInt(process.env.TTS_RPM_LIMIT, 10);
const TTS_TPM_LIMIT = parseNonNegativeInt(process.env.TTS_TPM_LIMIT, 10_000);
const TTS_RPD_LIMIT = parseNonNegativeInt(process.env.TTS_RPD_LIMIT, 0); // 0 = no local daily cap unless configured

const TTS_CACHE_MAX_ENTRIES = 120;
const TTS_CACHE_MAX_BYTES = 32 * 1024 * 1024; // 32 MB cap safe for Render 512MB Free Tier
const TTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface TtsCacheEntry {
  audioData: string;
  mimeType: string;
  byteLength: number;
  createdAt: number;
  hits: number;
}

const ttsCache = new Map<string, TtsCacheEntry>();
const inFlightTts = new Map<string, Promise<{ audioData: string; mimeType: string }>>();
let ttsCacheTotalBytes = 0;

function makeTtsCacheKey(text: string, voiceName: string, style: string): string {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const normalizedStyle = style.replace(/\s+/g, " ").trim();
  const rawKey = `${voiceName.trim().toLowerCase()}::${normalizedStyle}::${normalizedText}`;
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function getCachedTts(key: string): TtsCacheEntry | null {
  const entry = ttsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTS_CACHE_TTL_MS) {
    ttsCache.delete(key);
    ttsCacheTotalBytes = Math.max(0, ttsCacheTotalBytes - entry.byteLength);
    return null;
  }
  // Refresh LRU order
  ttsCache.delete(key);
  entry.hits += 1;
  ttsCache.set(key, entry);
  return entry;
}

function setCachedTts(key: string, audioData: string, mimeType: string): void {
  const byteLength = Buffer.byteLength(audioData, "utf8");
  if (byteLength > TTS_CACHE_MAX_BYTES / 2) return;

  const existing = ttsCache.get(key);
  if (existing) {
    ttsCache.delete(key);
    ttsCacheTotalBytes = Math.max(0, ttsCacheTotalBytes - existing.byteLength);
  }

  while (
    ttsCache.size >= TTS_CACHE_MAX_ENTRIES ||
    (ttsCacheTotalBytes + byteLength > TTS_CACHE_MAX_BYTES && ttsCache.size > 0)
  ) {
    const oldestKey = ttsCache.keys().next().value;
    if (!oldestKey) break;
    const oldest = ttsCache.get(oldestKey);
    ttsCache.delete(oldestKey);
    if (oldest) {
      ttsCacheTotalBytes = Math.max(0, ttsCacheTotalBytes - oldest.byteLength);
    }
  }

  ttsCache.set(key, {
    audioData,
    mimeType,
    byteLength,
    createdAt: Date.now(),
    hits: 0,
  });
  ttsCacheTotalBytes += byteLength;
}

function estimateTtsTokens(text: string, style: string): number {
  // Bengali/Unicode scripts tokenize denser (~2.5 chars/token); include prompt overhead
  return Math.max(12, Math.ceil(text.length / 2.5) + Math.ceil(style.length / 3) + 25);
}

interface TtsWindowEntry {
  ts: number;
  tokens: number;
}

const ttsMinuteWindow: TtsWindowEntry[] = [];
let ttsDailyDate = new Date().toISOString().slice(0, 10);
let ttsDailyCount = 0;
let ttsUpstreamCooldownUntil = 0;
let ttsQueueTail: Promise<void> = Promise.resolve();

function pruneTtsWindow(now: number): void {
  const cutoff = now - 60_000;
  while (ttsMinuteWindow.length > 0 && ttsMinuteWindow[0].ts <= cutoff) {
    ttsMinuteWindow.shift();
  }
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== ttsDailyDate) {
    ttsDailyDate = today;
    ttsDailyCount = 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TtsQuotaError extends Error {
  status: number;
  retryAfterSeconds: number;
  constructor(message: string, status: number, retryAfterSeconds: number = 15) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function isRateLimitError(err: any): boolean {
  const status = err?.status ?? err?.statusCode ?? err?.error?.code;
  if (status === 429) return true;
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  );
}

function parseRetryAfterSeconds(err: any): number {
  const msg = String(err?.message || "");
  const match = msg.match(/retry\s*(?:in|after)\s*([0-9]+(?:\.[0-9]+)?)\s*s/i);
  if (match) {
    const parsed = Math.ceil(Number.parseFloat(match[1]));
    if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 120);
  }
  const headerVal = err?.headers?.["retry-after"];
  if (headerVal) {
    const parsed = Number.parseInt(String(headerVal), 10);
    if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 120);
  }
  return 15;
}

function isDailyQuotaMessage(err: any): boolean {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("per day") ||
    msg.includes("perday") ||
    msg.includes("rpd") ||
    msg.includes("daily")
  );
}

async function acquireTtsQuotaSlot(tokensNeeded: number): Promise<void> {
  const MAX_QUEUE_WAIT_MS = 12_000;
  const startedWait = Date.now();

  if (TTS_TPM_LIMIT > 0 && tokensNeeded > TTS_TPM_LIMIT) {
    throw new TtsQuotaError(
      `টেক্সটটি এক মিনিটের টোকেন সীমার (TPM: ${TTS_TPM_LIMIT}) চেয়ে বড়। অনুগ্রহ করে ছোট অংশে ভাগ করে চেষ্টা করুন।`,
      400,
      5
    );
  }

  while (true) {
    const now = Date.now();
    pruneTtsWindow(now);

    if (now < ttsUpstreamCooldownUntil) {
      const waitSec = Math.max(1, Math.ceil((ttsUpstreamCooldownUntil - now) / 1000));
      if (ttsUpstreamCooldownUntil - now <= 4000 && Date.now() - startedWait < MAX_QUEUE_WAIT_MS) {
        await sleep(ttsUpstreamCooldownUntil - now + 100);
        continue;
      }
      throw new TtsQuotaError(
        `Gemini TTS সার্ভারে সাময়িক Rate Limit চলছে (429)। অনুগ্রহ করে ${waitSec} সেকেন্ড পর আবার চেষ্টা করুন।`,
        429,
        waitSec
      );
    }

    if (TTS_RPD_LIMIT > 0 && ttsDailyCount >= TTS_RPD_LIMIT) {
      throw new TtsQuotaError(
        `আজকের দৈনিক TTS সীমা (${TTS_RPD_LIMIT} RPD) শেষ হয়েছে। আগে তৈরি করা অডিওগুলো ক্যাশ থেকে চলবে, নতুন অডিওর জন্য আগামীকাল চেষ্টা করুন।`,
        429,
        60
      );
    }

    const usedRpm = ttsMinuteWindow.length;
    const usedTpm = ttsMinuteWindow.reduce((sum, item) => sum + item.tokens, 0);
    const rpmExceeded = TTS_RPM_LIMIT > 0 && usedRpm >= TTS_RPM_LIMIT;
    const tpmExceeded = TTS_TPM_LIMIT > 0 && usedTpm + tokensNeeded > TTS_TPM_LIMIT;

    if (!rpmExceeded && !tpmExceeded) {
      ttsMinuteWindow.push({ ts: now, tokens: tokensNeeded });
      ttsDailyCount += 1;
      return;
    }

    const oldestTs = ttsMinuteWindow[0]?.ts ?? now;
    const waitMs = Math.max(250, oldestTs + 60_000 - now + 50);
    if (Date.now() - startedWait + waitMs > MAX_QUEUE_WAIT_MS) {
      const waitSec = Math.max(1, Math.ceil(waitMs / 1000));
      throw new TtsQuotaError(
        `একসাথে অনেকগুলো অডিও অনুরোধ আসায় প্রতি মিনিটের সীমা (${rpmExceeded ? `${TTS_RPM_LIMIT} RPM` : `${TTS_TPM_LIMIT} TPM`}) পূর্ণ হয়েছে। ${waitSec} সেকেন্ড পর আবার চেষ্টা করুন।`,
        429,
        waitSec
      );
    }

    await sleep(Math.min(waitMs, 3000));
  }
}

function enqueueTtsTask<T>(task: () => Promise<T>): Promise<T> {
  const next = ttsQueueTail.then(task, task);
  ttsQueueTail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function callGeminiWithRetry<T>(fn: () => Promise<T>, maxRetries: number = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      const retryable429 = isRateLimitError(err);
      const status = err?.status ?? err?.statusCode;
      const retryable5xx = status === 500 || status === 502 || status === 503 || status === 504;

      if ((!retryable429 && !retryable5xx) || attempt >= maxRetries) {
        throw err;
      }

      if (retryable429) {
        if (isDailyQuotaMessage(err)) {
          throw err;
        }
        const suggestedSec = parseRetryAfterSeconds(err);
        if (suggestedSec > 6) {
          throw err;
        }
      }

      const backoffMs = Math.min(4000, 1200 * Math.pow(2, attempt)) + Math.floor(Math.random() * 400);
      attempt += 1;
      await sleep(backoffMs);
    }
  }
}

function getIpKey(req: any): string {
  const rawIp = String(req?.ip || req?.socket?.remoteAddress || "unknown").trim();
  return `ip:${rawIp.slice(0, 80)}`;
}

function getOwnerSessionKey(req: any): string {
  const ipKey = getIpKey(req);
  const raw = req?.headers?.["x-client-id"];
  if (typeof raw === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(raw.trim())) {
    return `${ipKey}:cid:${raw.trim()}`;
  }
  return `${ipKey}:anon`;
}

const VALID_VOICE_NAME_RE = /^[a-zA-Z0-9_-]{2,40}$/;
const VALID_SESSION_ID_RE = /^[a-zA-Z0-9_-]{4,80}$/;

const STATIC_ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://ais-dev-zvcdkj4ecmn5inpmhiiyl7-1006926458026.asia-east1.run.app",
  "https://ais-pre-zvcdkj4ecmn5inpmhiiyl7-1006926458026.asia-east1.run.app",
  ...(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean),
]);

function isAllowedCorsOrigin(origin: string, req: any): boolean {
  const normalized = origin.trim().replace(/\/+$/, "");
  if (STATIC_ALLOWED_ORIGINS.has(normalized)) return true;
  try {
    const parsedOrigin = new URL(normalized);
    if (parsedOrigin.protocol !== "https:" && parsedOrigin.protocol !== "http:") {
      return false;
    }
    const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
    const requestHost = String(forwardedHost || req.headers.host || "").trim();
    if (requestHost && parsedOrigin.host.toLowerCase() === requestHost.toLowerCase()) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function buildContentSecurityPolicy(): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://apis.google.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https://*.googlesyndication.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://www.gstatic.com https://gstatic.com https://*.googleusercontent.com https://images.unsplash.com https://*.googlesyndication.com https://googleads.g.doubleclick.net",
    "media-src 'self' blob: data: https://gstatic.com https://*.gstatic.com https://storage.googleapis.com",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://gstatic.com https://*.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net",
    "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];
  return directives.join("; ");
}

function aiRateLimitMiddleware(req: any, res: any, next: any) {
  const key = getIpKey(req);
  const now = Date.now();
  const entry = apiRateLimits.get(key);
  if (!entry || now >= entry.resetAt) {
    apiRateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader("Retry-After", "30");
    return res.status(429).json({
      error: "অল্প সময়ে অনেকগুলো অনুরোধ পাঠানো হয়েছে। অনুগ্রহ করে ৩০ সেকেন্ড পর আবার চেষ্টা করুন।",
      retryAfterSeconds: 30,
    });
  }
  entry.count += 1;
  return next();
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 2);
  const PORT = Number(process.env.PORT) || 3000;

  const cspHeaderValue = buildContentSecurityPolicy();
  app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", cspHeaderValue);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ limit: "12mb", extended: true }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = stripHttpOptions(req.body);
    }
    next();
  });

  for (const dir of ["examples", "assets", "public"]) {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      app.use(`/${dir}`, express.static(dirPath));
    }
  }

  app.use("/api", (req, res, next): any => {
    const origin = req.headers.origin;
    res.setHeader("Vary", "Origin");
    if (typeof origin === "string" && origin.trim()) {
      if (!isAllowedCorsOrigin(origin, req)) {
        return res.status(403).json({ error: "Origin not allowed." });
      }
      res.setHeader("Access-Control-Allow-Origin", origin.trim().replace(/\/+$/, ""));
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-client-id");
      res.setHeader("Access-Control-Expose-Headers", "Retry-After,X-TTS-Cache");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  });

  app.get("/api/health", (_req, res) => {
    const now = Date.now();
    pruneTtsWindow(now);
    res.json({
      status: "ok",
      configured: Boolean(getServerApiKey()),
      ttsCacheEntries: ttsCache.size,
      limits: {
        rpm: TTS_RPM_LIMIT,
        tpm: TTS_TPM_LIMIT,
        rpd: TTS_RPD_LIMIT,
      },
      usage: {
        rpmUsed: ttsMinuteWindow.length,
        tpmUsed: ttsMinuteWindow.reduce((sum, item) => sum + item.tokens, 0),
        rpdUsed: ttsDailyCount,
      },
    });
  });

  app.use("/api/tts", aiRateLimitMiddleware);
  app.use("/api/generate-content", aiRateLimitMiddleware);
  app.use("/api/generate-content-stream", aiRateLimitMiddleware);
  app.use("/api/chat-message", aiRateLimitMiddleware);
  app.use("/api/chat-stream", aiRateLimitMiddleware);
  app.use("/api/generate-images", aiRateLimitMiddleware);
  app.use("/api/generate-videos", aiRateLimitMiddleware);

  app.post("/api/tts", async (req, res): Promise<any> => {
    try {
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      const rawVoiceName = typeof req.body?.voiceName === "string" ? req.body.voiceName.trim() : "";
      if (rawVoiceName && !VALID_VOICE_NAME_RE.test(rawVoiceName)) {
        return res.status(400).json({ error: "Invalid voice name." });
      }
      const voiceName = rawVoiceName || "Kore";
      const style = typeof req.body?.style === "string" ? req.body.style.trim().slice(0, 450) : "";

      if (!text) {
        return res.status(400).json({ error: "Text is required for speech generation." });
      }
      if (text.length > 5000) {
        return res.status(400).json({ error: "Text is too long (maximum 5,000 characters)." });
      }

      // 1. Check in-memory LRU cache FIRST (0 RPM / TPM / RPD cost for identical text!)
      const cacheKey = makeTtsCacheKey(text, voiceName, style);
      const cached = getCachedTts(cacheKey);
      if (cached) {
        res.setHeader("X-TTS-Cache", "HIT");
        return res.json({
          audioData: cached.audioData,
          mimeType: cached.mimeType,
          cached: true,
        });
      }

      const apiKey = getServerApiKey();
      if (!apiKey) {
        return res.status(503).json({
          error: MISSING_API_KEY_ERROR,
        });
      }

      // 2. Coalesce simultaneous identical requests into a single Gemini API call
      let pending = inFlightTts.get(cacheKey);
      if (!pending) {
        const tokensNeeded = estimateTtsTokens(text, style);
        pending = enqueueTtsTask(async () => {
          // Re-check cache in case an earlier queued task just populated it
          const insideCached = getCachedTts(cacheKey);
          if (insideCached) {
            return { audioData: insideCached.audioData, mimeType: insideCached.mimeType };
          }

          await acquireTtsQuotaSlot(tokensNeeded);

          const ai = createAiClient(apiKey);
          const callTts = async (includeSpeechMetadata: boolean) => {
            const part: Record<string, any> = { text };
            if (includeSpeechMetadata && style) {
              part.speechMetadata = { style };
            }
            return await ai.models.generateContent({
              model: "gemini-3.8-flash-lite-tts",
              contents: [
                {
                  role: "user",
                  parts: [part],
                },
              ],
              config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
              },
            });
          };

          let response;
          try {
            response = await callGeminiWithRetry(() => callTts(Boolean(style)));
          } catch (err: any) {
            const msg = String(err?.message || "");
            if (style && msg.includes("speechMetadata")) {
              response = await callGeminiWithRetry(() => callTts(false));
            } else {
              throw err;
            }
          }

          const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
          if (!inlineData?.data) {
            throw new TtsQuotaError("No audio data received from the TTS model.", 502, 5);
          }

          const mimeType = inlineData.mimeType || "audio/wav";
          setCachedTts(cacheKey, inlineData.data, mimeType);
          return { audioData: inlineData.data, mimeType };
        }).finally(() => {
          inFlightTts.delete(cacheKey);
        });

        inFlightTts.set(cacheKey, pending);
      }

      const result = await pending;
      res.setHeader("X-TTS-Cache", "MISS");
      return res.json({
        audioData: result.audioData,
        mimeType: result.mimeType,
        cached: false,
      });
    } catch (error: any) {
      if (error instanceof TtsQuotaError) {
        if (error.status === 429) {
          res.setHeader("Retry-After", String(error.retryAfterSeconds));
        }
        return res.status(error.status).json({
          error: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        });
      }

      if (isRateLimitError(error)) {
        const retrySec = parseRetryAfterSeconds(error);
        const daily = isDailyQuotaMessage(error);
        ttsUpstreamCooldownUntil = Date.now() + Math.min(retrySec, 60) * 1000;
        res.setHeader("Retry-After", String(retrySec));
        return res.status(429).json({
          error: daily
            ? "Gemini TTS-এর দৈনিক কোটা (RPD) শেষ হয়েছে। আগে তৈরি করা টেক্সট ক্যাশ থেকে চলবে; নতুন টেক্সটের জন্য পরে বা পেইড API Key দিয়ে চেষ্টা করুন।"
            : `Gemini API সাময়িকভাবে ব্যস্ত (429 Rate Limit)। অনুগ্রহ করে ${retrySec} সেকেন্ড পর আবার চেষ্টা করুন।`,
          retryAfterSeconds: retrySec,
        });
      }

      console.error("[Backend] /api/tts error:", error);
      return res.status(500).json({ error: "Failed to generate speech." });
    }
  });

  app.post("/api/generate-content", async (req, res): Promise<any> => {
    try {
      const apiKey = getServerApiKey();
      if (!apiKey) {
        return res.status(503).json({
          error: MISSING_API_KEY_ERROR,
        });
      }
      const contents = req.body?.contents;
      if (contents === undefined || contents === null || (typeof contents === "string" && !contents.trim())) {
        return res.status(400).json({ error: "Valid contents payload is required." });
      }
      const ai = createAiClient(apiKey);
      const params = { ...req.body, model: resolveModel(req.body?.model) };
      const response = await callGeminiWithRetry(() => ai.models.generateContent(params));
      return res.json(serializeGenerateContentResponse(response));
    } catch (error: any) {
      if (String(error?.message || "").startsWith("Disallowed model:")) {
        return res.status(400).json({ error: "Unsupported AI model requested." });
      }
      if (isRateLimitError(error)) {
        const retrySec = parseRetryAfterSeconds(error);
        res.setHeader("Retry-After", String(retrySec));
        return res.status(429).json({
          error: `AI সার্ভার এখন ব্যস্ত (429 Rate Limit)। অনুগ্রহ করে ${retrySec} সেকেন্ড পর আবার চেষ্টা করুন।`,
          retryAfterSeconds: retrySec,
        });
      }
      console.error("[Backend] /api/generate-content error:", error);
      return res.status(500).json({ error: "Failed to generate content." });
    }
  });

  app.post("/api/generate-content-stream", async (req, res): Promise<any> => {
    try {
      const apiKey = getServerApiKey();
      if (!apiKey) {
        return res.status(503).json({
          error: MISSING_API_KEY_ERROR,
        });
      }
      const contents = req.body?.contents;
      if (contents === undefined || contents === null || (typeof contents === "string" && !contents.trim())) {
        return res.status(400).json({ error: "Valid contents payload is required." });
      }
      const ai = createAiClient(apiKey);
      const params = { ...req.body, model: resolveModel(req.body?.model) };
      const stream = await ai.models.generateContentStream(params);
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      for await (const chunk of stream) {
        res.write(JSON.stringify(serializeGenerateContentResponse(chunk)) + "\n");
      }
      res.end();
    } catch (error: any) {
      console.error("[Backend] /api/generate-content-stream error:", error);
      if (!res.headersSent) {
        if (String(error?.message || "").startsWith("Disallowed model:")) {
          return res.status(400).json({ error: "Unsupported AI model requested." });
        }
        return res.status(500).json({ error: "Failed to stream content." });
      }
      res.end();
    }
  });

  app.post("/api/chat-message", async (req, res): Promise<any> => {
    try {
      const apiKey = getServerApiKey();
      if (!apiKey) {
        return res.status(503).json({
          error: MISSING_API_KEY_ERROR,
        });
      }
      const { sessionId, model, config, history, message, msgConfig } = req.body || {};
      if (sessionId !== undefined && (typeof sessionId !== "string" || !VALID_SESSION_ID_RE.test(sessionId))) {
        return res.status(400).json({ error: "Invalid chat session identifier." });
      }
      if (message === undefined || message === null || (typeof message === "string" && !message.trim())) {
        return res.status(400).json({ error: "Chat message is required." });
      }
      const ai = createAiClient(apiKey);
      const chatKey = sessionId ? `${getOwnerSessionKey(req)}:${sessionId}` : "";
      let chat = chatKey ? chats.get(chatKey) : undefined;
      if (!chat) {
        chat = ai.chats.create({
          model: resolveModel(model),
          config,
          history,
        });
        if (chatKey) chats.set(chatKey, chat);
      }
      const response = await chat.sendMessage({ message, config: msgConfig });
      return res.json(serializeGenerateContentResponse(response));
    } catch (error: any) {
      console.error("[Backend] /api/chat-message error:", error);
      if (String(error?.message || "").startsWith("Disallowed model:")) {
        return res.status(400).json({ error: "Unsupported AI model requested." });
      }
      return res.status(500).json({ error: "Failed to send chat message." });
    }
  });

  app.post("/api/chat-stream", async (req, res): Promise<any> => {
    try {
      const apiKey = getServerApiKey();
      if (!apiKey) {
        return res.status(503).json({
          error: MISSING_API_KEY_ERROR,
        });
      }
      const { sessionId, model, config, history, message, msgConfig } = req.body || {};
      if (sessionId !== undefined && (typeof sessionId !== "string" || !VALID_SESSION_ID_RE.test(sessionId))) {
        return res.status(400).json({ error: "Invalid chat session identifier." });
      }
      if (message === undefined || message === null || (typeof message === "string" && !message.trim())) {
        return res.status(400).json({ error: "Chat message is required." });
      }
      const ai = createAiClient(apiKey);
      const chatKey = sessionId ? `${getOwnerSessionKey(req)}:${sessionId}` : "";
      let chat = chatKey ? chats.get(chatKey) : undefined;
      if (!chat) {
        chat = ai.chats.create({
          model: resolveModel(model),
          config,
          history,
        });
        if (chatKey) chats.set(chatKey, chat);
      }
      const stream = await chat.sendMessageStream({ message, config: msgConfig });
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      for await (const chunk of stream) {
        res.write(JSON.stringify(serializeGenerateContentResponse(chunk)) + "\n");
      }
      res.end();
    } catch (error: any) {
      console.error("[Backend] /api/chat-stream error:", error);
      if (!res.headersSent) {
        if (String(error?.message || "").startsWith("Disallowed model:")) {
          return res.status(400).json({ error: "Unsupported AI model requested." });
        }
        return res.status(500).json({ error: "Failed to stream chat message." });
      }
      res.end();
    }
  });

  app.post("/api/generate-images", async (req, res): Promise<any> => {
    try {
      const apiKey = getServerApiKey();
      if (!apiKey) {
        return res.status(503).json({
          error: MISSING_API_KEY_ERROR,
        });
      }
      const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
      if (!prompt || prompt.length > 4000) {
        return res.status(400).json({ error: "Valid prompt is required for image generation." });
      }
      const ai = createAiClient(apiKey);
      const response = await ai.models.generateImages({ ...req.body, prompt, model: resolveModel(req.body?.model || "imagen-3.0-generate-002") });
      return res.json(response);
    } catch (error: any) {
      console.error("[Backend] /api/generate-images error:", error);
      if (String(error?.message || "").startsWith("Disallowed model:")) {
        return res.status(400).json({ error: "Unsupported AI model requested." });
      }
      return res.status(500).json({ error: "Failed to generate images." });
    }
  });

  app.post("/api/generate-videos", async (req, res): Promise<any> => {
    try {
      const apiKey = getServerApiKey();
      if (!apiKey) {
        return res.status(503).json({
          error: MISSING_API_KEY_ERROR,
        });
      }
      const ai = createAiClient(apiKey);
      const body = { ...req.body };
      delete body.video;
      if (body.video && typeof body.video === 'object') { const c = { ...body.video }; delete c.uri; delete c.videoUri; body.video = Object.keys(c).length ? c : undefined; }
      delete body.source;
      body.model = resolveModel(body.model || "veo-3.1-fast-generate-preview");
      const ownerKey = getOwnerSessionKey(req);
      const op = await ai.models.generateVideos(body);
      if (op.name) {
        videoOps.set(op.name, { op, ownerKey });
      }
      return res.json({
        name: op.name,
        done: op.done,
        metadata: op.metadata,
        error: op.error,
        response: op.response,
      });
    } catch (error: any) {
      console.error("[Backend] /api/generate-videos error:", error);
      if (String(error?.message || "").startsWith("Disallowed model:")) {
        return res.status(400).json({ error: "Unsupported AI model requested." });
      }
      return res.status(500).json({ error: "Failed to start video generation." });
    }
  });

  app.post("/api/videos-operation", async (req, res): Promise<any> => {
    try {
      const apiKey = getServerApiKey();
      if (!apiKey) {
        return res.status(503).json({
          error: MISSING_API_KEY_ERROR,
        });
      }
      const ai = createAiClient(apiKey);
      const opName = req.body?.operation?.name;
      if (typeof opName !== "string" || !opName.trim() || opName.length > 200) {
        return res.status(400).json({ error: "Valid operation name is required." });
      }
      const storedOp = videoOps.get(opName);
      if (!storedOp) {
        return res.status(404).json({ error: "Video operation not found on server." });
      }
      const callerOwnerKey = getOwnerSessionKey(req);
      if (storedOp.ownerKey !== callerOwnerKey) {
        return res.status(403).json({ error: "Access denied for this video operation." });
      }
      const op = await ai.operations.getVideosOperation({ operation: storedOp.op });
      if (op.name) {
        videoOps.set(op.name, { op, ownerKey: callerOwnerKey });
      }
      const responseCopy = op.response ? JSON.parse(JSON.stringify(op.response)) : undefined;
      if (op.done && responseCopy?.generatedVideos) {
        for (const gv of responseCopy.generatedVideos) {
          if (gv.video?.uri) {
            const b64 = Buffer.from(gv.video.uri, "utf-8").toString("base64url");
            gv.video.uri = `/api/video-download?b64=${b64}`;
          }
        }
      }
      return res.json({
        name: op.name,
        done: op.done,
        metadata: op.metadata,
        error: op.error,
        response: responseCopy,
      });
    } catch (error: any) {
      console.error("[Backend] /api/videos-operation error:", error);
      return res.status(500).json({ error: "Failed to poll video operation." });
    }
  });

  app.get("/api/video-download", (_req, res) => {
    res.status(404).json({ error: "Video download is not enabled for this applet." });
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found." });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(["/server.cjs", "/server.cjs.map"], (_req: any, res: any) => res.status(404).end());
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] Server running on http://localhost:${PORT}`);
  });
}

startServer();
