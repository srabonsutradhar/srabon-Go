/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function isWavBuffer(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // "RIFF" and "WAVE"
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  );
}

export async function decodeAudioToBuffer(
  bytes: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  if (isWavBuffer(bytes)) {
    const copy = bytes.slice().buffer;
    return await ctx.decodeAudioData(copy);
  }

  const dataInt16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const frameCount = Math.floor(dataInt16.length / numChannels);
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createWavBlob(
  bytes: Uint8Array,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Blob {
  if (isWavBuffer(bytes)) {
    return new Blob([bytes.slice()], { type: 'audio/wav' });
  }

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = bytes.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, 44).set(bytes);
  return new Blob([buffer], { type: 'audio/wav' });
}

function getAppletClientId(): string {
  try {
    if (typeof sessionStorage !== 'undefined') {
      let id = sessionStorage.getItem('__ais_cid');
      if (!id || !/^[a-zA-Z0-9_-]{8,128}$/.test(id)) {
        id =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        sessionStorage.setItem('__ais_cid', id);
      }
      return id;
    }
  } catch {}
  return 'anonclient0001';
}

let dynamicApiBaseUrl = '';

export function normalizeApiBaseUrl(raw?: string): string {
  const cleaned = (raw || '').trim().replace(/\/+$/, '');
  if (!cleaned || cleaned.length > 200) return '';
  try {
    const parsed = new URL(cleaned);
    if (parsed.username || parsed.password) return '';
    if (parsed.search || parsed.hash) return '';
    const host = parsed.hostname.toLowerCase();
    const isLoopback = host === 'localhost' || host === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback)) {
      return '';
    }
    if (
      host === '0.0.0.0' ||
      host === '[::1]' ||
      host === '::1' ||
      /^169\.254\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^fc00:|^fe80:/i.test(host)
    ) {
      return '';
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function setDynamicApiBaseUrl(url?: string): void {
  dynamicApiBaseUrl = normalizeApiBaseUrl(url);
}

export function getDynamicApiBaseUrl(): string {
  const envBase = normalizeApiBaseUrl((import.meta as any).env?.VITE_API_BASE_URL || '');
  return dynamicApiBaseUrl || envBase;
}

export function resolveApiUrl(path: string): string {
  const base = getDynamicApiBaseUrl();
  return base ? `${base}${path}` : path;
}

export async function testApiHealthAtUrl(baseUrl: string): Promise<boolean> {
  const cleanBase = normalizeApiBaseUrl(baseUrl);
  const url = cleanBase ? `${cleanBase}/api/health` : '/api/health';
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(new Error('Health check timed out')), 6000)
    : null;
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller?.signal,
    });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return false;
    const data = await res.json().catch(() => null);
    return data?.status === 'ok';
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  return testApiHealthAtUrl(getDynamicApiBaseUrl());
}

export async function generateTtsAudio(params: {
  text: string;
  voiceName: string;
  style?: string;
}): Promise<{ audioData: string; mimeType: string }> {
  const response = await fetch(resolveApiUrl('/api/tts'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': getAppletClientId(),
    },
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || data.retryAfterSeconds;
      throw new Error(
        data.error ||
          `অনেকগুলো অনুরোধ একসাথে পাঠানো হয়েছে (429)। অনুগ্রহ করে ${retryAfter ? `${retryAfter} সেকেন্ড` : 'কিছুক্ষণ'} পর আবার চেষ্টা করুন।`
      );
    }
    if ((response.status === 404 || response.status === 405) && !data.error) {
      throw new Error(
        `ব্যাকএন্ড সার্ভার সক্রিয় নেই (Status ${response.status})। GitHub Pages শুধু স্ট্যাটিক ফাইল চালায়—তাই Gemini AI TTS ব্যবহার করতে পূর্ণাঙ্গ সার্ভার (Node.js) বা VITE_API_BASE_URL যুক্ত করুন।`
      );
    }
    throw new Error(data.error || `TTS request failed with status ${response.status}`);
  }
  if (!data.audioData) {
    throw new Error('No audio data received from server.');
  }
  return data;
}
