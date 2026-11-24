/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import { resolveApiUrl } from './audio';

export interface SmartScriptAnalysis {
  engine: string;
  charCount: number;
  wordCount: number;
  sentenceCount: number;
  estimatedSeconds: number;
  estimatedTokens: number;
  language: {
    primary: 'bn' | 'en' | 'pt' | 'mixed';
    bengaliPercent: number;
    latinPercent: number;
  };
  recommendedStyle: {
    presetId: string;
    stylePrompt: string;
    language: string;
  };
  chunkCount: number;
  chunks: string[];
  overLimit: boolean;
}

export interface SmartSalonSlotInsight {
  timeSlot: string;
  bookedCount: number;
  expired: boolean;
  loadLevel: 'open' | 'moderate' | 'busy' | 'expired';
  estimatedWaitMins: number;
}

export interface SmartSalonInsights {
  engine: string;
  bookingDate: string;
  activeQueueCount: number;
  estimatedQueueWaitMins: number;
  bestSlot: string | null;
  bestSlotBookedCount: number;
  openSlotsCount: number;
  slots: SmartSalonSlotInsight[];
}

export interface SmartAudioInspection {
  engine: string;
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  peakDbfs: number;
  rmsDbfs: number;
  byteLength: number;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function analyzeScriptSmart(params: {
  text: string;
  maxChars?: number;
  signal?: AbortSignal;
}): Promise<SmartScriptAnalysis | null> {
  try {
    const res = await fetch(resolveApiUrl('/api/smart/analyze-script'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: params.text,
        maxChars: params.maxChars ?? 5000,
      }),
      signal: params.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as SmartScriptAnalysis;
  } catch {
    return null;
  }
}

export async function fetchSalonSmartInsights(params: {
  bookingDate: string;
  todayDate: string;
  nowMinutes: number;
  timeSlots: string[];
  tickets: Array<{ timeSlot: string; status: string; serviceKey?: string }>;
  signal?: AbortSignal;
}): Promise<SmartSalonInsights | null> {
  try {
    const res = await fetch(resolveApiUrl('/api/smart/salon-insights'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingDate: params.bookingDate,
        todayDate: params.todayDate,
        nowMinutes: params.nowMinutes,
        timeSlots: params.timeSlots,
        tickets: params.tickets,
      }),
      signal: params.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as SmartSalonInsights;
  } catch {
    return null;
  }
}

export async function inspectAudioSmart(bytes: Uint8Array): Promise<SmartAudioInspection | null> {
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) return null;
  try {
    const res = await fetch(resolveApiUrl('/api/smart/audio-inspect'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioData: uint8ToBase64(bytes),
        sampleRate: 24000,
        channels: 1,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as SmartAudioInspection;
  } catch {
    return null;
  }
}
