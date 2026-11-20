/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from "express";
import path from "path";
import fs from "fs";
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

function getClientKey(req: any): string {
  const raw = req?.headers?.["x-client-id"];
  if (typeof raw === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(raw.trim())) {
    return `cid:${raw.trim()}`;
  }
  const xffParts = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const xff = xffParts.length >= 2 ? xffParts[xffParts.length - 2] : (xffParts[0] || "");
  return `ip:${xff || req?.ip || req?.socket?.remoteAddress || "unknown"}`;
}

function aiRateLimitMiddleware(req: any, res: any, next: any) {
  const key = getClientKey(req);
  const now = Date.now();
  const entry = apiRateLimits.get(key);
  if (!entry || now >= entry.resetAt) {
    apiRateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: "Too many requests. Please wait a moment before generating again.",
    });
  }
  entry.count += 1;
  return next();
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 2);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
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
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-client-id");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
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
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }

      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      const voiceName = typeof req.body?.voiceName === "string" && req.body.voiceName.trim()
        ? req.body.voiceName.trim().slice(0, 50)
        : "Kore";
      const style = typeof req.body?.style === "string" ? req.body.style.trim().slice(0, 200) : "";

      if (!text) {
        return res.status(400).json({ error: "Text is required for speech generation." });
      }
      if (text.length > 5000) {
        return res.status(400).json({ error: "Text is too long (maximum 5,000 characters)." });
      }

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
        response = await callTts(Boolean(style));
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (style && msg.includes("speechMetadata")) {
          response = await callTts(false);
        } else {
          throw err;
        }
      }

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData?.data) {
        return res.status(502).json({ error: "No audio data received from the TTS model." });
      }

      return res.json({
        audioData: inlineData.data,
        mimeType: inlineData.mimeType || "audio/wav",
      });
    } catch (error: any) {
      console.error("[Backend] /api/tts error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate speech." });
    }
  });

  app.post("/api/generate-content", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = createAiClient(apiKey);
      const params = { ...req.body, model: resolveModel(req.body?.model) };
      const response = await ai.models.generateContent(params);
      return res.json(serializeGenerateContentResponse(response));
    } catch (error: any) {
      console.error("[Backend] /api/generate-content error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate content." });
    }
  });

  app.post("/api/generate-content-stream", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
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
        return res.status(500).json({ error: error.message || "Failed to stream content." });
      }
      res.end();
    }
  });

  app.post("/api/chat-message", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const { sessionId, model, config, history, message, msgConfig } = req.body || {};
      const ai = createAiClient(apiKey);
      const chatKey = sessionId ? `${getClientKey(req)}:${String(sessionId).slice(0, 128)}` : "";
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
      return res.status(500).json({ error: error.message || "Failed to send chat message." });
    }
  });

  app.post("/api/chat-stream", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const { sessionId, model, config, history, message, msgConfig } = req.body || {};
      const ai = createAiClient(apiKey);
      const chatKey = sessionId ? `${getClientKey(req)}:${String(sessionId).slice(0, 128)}` : "";
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
        return res.status(500).json({ error: error.message || "Failed to stream chat message." });
      }
      res.end();
    }
  });

  app.post("/api/generate-images", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = createAiClient(apiKey);
      const response = await ai.models.generateImages({ ...req.body, model: resolveModel(req.body?.model || "imagen-3.0-generate-002") });
      return res.json(response);
    } catch (error: any) {
      console.error("[Backend] /api/generate-images error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate images." });
    }
  });

  app.post("/api/generate-videos", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = createAiClient(apiKey);
      const body = { ...req.body };
      delete body.video;
      if (body.video && typeof body.video === 'object') { const c = { ...body.video }; delete c.uri; delete c.videoUri; body.video = Object.keys(c).length ? c : undefined; }
      delete body.source;
      body.model = resolveModel(body.model || "veo-3.1-fast-generate-preview");
      const op = await ai.models.generateVideos(body);
      if (op.name) {
        videoOps.set(op.name, { op, ownerKey: getClientKey(req) });
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
      return res.status(500).json({ error: error.message || "Failed to start video generation." });
    }
  });

  app.post("/api/videos-operation", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = createAiClient(apiKey);
      const opName = req.body?.operation?.name;
      const storedOp = opName ? videoOps.get(opName) : undefined;
      if (!storedOp) {
        return res.status(404).json({ error: "Video operation not found on server." });
      }
      const op = await ai.operations.getVideosOperation({ operation: storedOp.op });
      if (op.name) {
        videoOps.set(op.name, { op, ownerKey: getClientKey(req) });
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
      return res.status(500).json({ error: error.message || "Failed to poll video operation." });
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
