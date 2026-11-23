/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import { GoogleGenAI, Type } from '../genaiProxy';
import { VOICE_DATA } from '../constants';
import { CustomVoiceProfile, ProPackageType, UserPlan } from '../types';
import { StudioTierId, resolveStudioTier } from './studioTiers';
import { createWavBlob, decodeAudioToBuffer } from './audio';

export const VOICE_PROFILE_LIMITS: Record<StudioTierId, number> = {
  free: 1,
  monthly: 3,
  yearly: 10,
};

export const VALID_GEMINI_BASE_VOICES = [
  'Kore',
  'Charon',
  'Fenrir',
  'Zephyr',
  'Puck',
  'Aoede',
  'Orus',
  'Leda',
  'Enceladus',
  'Algenib',
  'Achird',
  'Sulafat',
  'Vindemiatrix',
  'Gacrux',
  'Schedar',
  'Umbriel',
] as const;

const VOICE_PROFILES_STORAGE_PREFIX = 'srabon_custom_voice_profiles_v1';
const SAMPLE_DB_NAME = 'srabon_voice_samples_db_v1';
const SAMPLE_STORE_NAME = 'samples';
const MAX_INLINE_DATA_URL_LENGTH = 360_000;

export function getVoiceProfileLimit(options: {
  isAdmin: boolean;
  userPlan: UserPlan;
  proPackageType?: ProPackageType | null;
}): { tier: StudioTierId; maxProfiles: number; allowFineTuning: boolean } {
  const tier = resolveStudioTier(options);
  return {
    tier,
    maxProfiles: VOICE_PROFILE_LIMITS[tier],
    allowFineTuning: tier === 'yearly',
  };
}

export function getSupportedRecorderMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch {}
  }
  return '';
}

export function normalizeAudioMimeType(rawMime: string | undefined): string {
  const base = (rawMime || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (
    base === 'audio/wav' ||
    base === 'audio/wave' ||
    base === 'audio/x-wav'
  ) {
    return 'audio/wav';
  }
  if (base === 'audio/mpeg' || base === 'audio/mp3') {
    return 'audio/mp3';
  }
  if (base === 'audio/mp4' || base === 'audio/m4a' || base === 'audio/x-m4a') {
    return 'audio/mp4';
  }
  if (base === 'audio/ogg') {
    return 'audio/ogg';
  }
  return 'audio/webm';
}

export async function blobToBase64Data(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = res.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('অডিও ফাইল কনভার্ট করা যায়নি।'));
        return;
      }
      resolve(res.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(new Error('অডিও ফাইল পড়া যায়নি।'));
    reader.readAsDataURL(blob);
  });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read audio data URL.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read audio blob.'));
    reader.readAsDataURL(blob);
  });
}

function openSampleDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(SAMPLE_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SAMPLE_STORE_NAME)) {
          db.createObjectStore(SAMPLE_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveVoiceSampleBlobToDb(
  profileId: string,
  blob: Blob
): Promise<void> {
  const db = await openSampleDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(SAMPLE_STORE_NAME, 'readwrite');
      tx.objectStore(SAMPLE_STORE_NAME).put(blob, profileId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function loadVoiceSampleBlobFromDb(
  profileId: string
): Promise<Blob | null> {
  const db = await openSampleDb();
  if (!db) return null;
  return await new Promise<Blob | null>((resolve) => {
    try {
      const tx = db.transaction(SAMPLE_STORE_NAME, 'readonly');
      const req = tx.objectStore(SAMPLE_STORE_NAME).get(profileId);
      req.onsuccess = () => {
        const res = req.result instanceof Blob ? req.result : null;
        db.close();
        resolve(res);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function deleteVoiceSampleBlobFromDb(
  profileId: string
): Promise<void> {
  const db = await openSampleDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(SAMPLE_STORE_NAME, 'readwrite');
      tx.objectStore(SAMPLE_STORE_NAME).delete(profileId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export function loadCustomVoiceProfiles(
  uid?: string | null
): CustomVoiceProfile[] {
  if (typeof window === 'undefined' || !uid) return [];
  try {
    const raw = localStorage.getItem(`${VOICE_PROFILES_STORAGE_PREFIX}:${uid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.matchedBaseVoice === 'string' &&
          typeof item.synthesizedStylePrompt === 'string'
      )
      .slice(0, 12);
  } catch {
    return [];
  }
}

export function persistCustomVoiceProfiles(
  uid: string | null | undefined,
  profiles: CustomVoiceProfile[]
): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    const compact = profiles.slice(0, 12).map((p) => {
      if (
        p.sampleAudioDataUrl &&
        p.sampleAudioDataUrl.length > MAX_INLINE_DATA_URL_LENGTH
      ) {
        const { sampleAudioDataUrl: _omit, ...rest } = p;
        return rest;
      }
      return p;
    });
    localStorage.setItem(
      `${VOICE_PROFILES_STORAGE_PREFIX}:${uid}`,
      JSON.stringify(compact)
    );
  } catch {
    try {
      // Fallback: save profiles without inline data URLs if storage quota is tight
      const stripped = profiles
        .slice(0, 12)
        .map(({ sampleAudioDataUrl: _omit, ...rest }) => rest);
      localStorage.setItem(
        `${VOICE_PROFILES_STORAGE_PREFIX}:${uid}`,
        JSON.stringify(stripped)
      );
    } catch {}
  }
}

export interface AnalyzedVoiceResult {
  suggestedProfileName: string;
  gender: string;
  pitchLabel: string;
  speakingRateLabel: string;
  toneDescription: string;
  accentNotes: string;
  transcriptSample: string;
  matchedBaseVoice: string;
  synthesizedStylePrompt: string;
  pitchCentsOffset: number;
  rateMultiplier: number;
  warmthBoost: number;
}

export async function analyzeRecordedVoiceSample(params: {
  audioBlob: Blob;
  durationSec: number;
  customLabel?: string;
}): Promise<AnalyzedVoiceResult> {
  const { audioBlob, durationSec, customLabel } = params;
  const base64Audio = await blobToBase64Data(audioBlob);
  const mimeType = normalizeAudioMimeType(audioBlob.type);

  const voiceCatalogSummary = VOICE_DATA.filter((v) =>
    (VALID_GEMINI_BASE_VOICES as readonly string[]).includes(v.name)
  )
    .map(
      (v) =>
        `- ${v.name}: ${v.analysis.gender}, pitch=${v.analysis.pitch}, traits=${v.analysis.characteristics.join(', ')}`
    )
    .join('\n');

  const prompt = `Listen carefully to the user's recorded voice sample (approx ${Math.max(
    1,
    Math.round(durationSec)
  )} seconds). Perform a deep acoustic & vocal persona analysis so our TTS engine can closely replicate this speaker's delivery, pitch range, speaking rhythm, warmth, and articulation when reading any Bengali, English, or multilingual script.

Select the single closest matchedBaseVoice ONLY from this catalog:
${voiceCatalogSummary}

Rules:
1. Match gender & fundamental pitch register accurately (never pick a deep bass voice for a higher female voice or vice versa).
2. In "synthesizedStylePrompt" (write in concise English, 180-360 characters), describe exact vocal timbre, chest/head resonance, cadence, pause rhythm, emotional warmth, and articulation clarity to direct a TTS engine to sound closely aligned with this speaker.
3. Set "pitchCentsOffset" between -160 and +160 cents to align the chosen base voice's pitch toward the speaker's actual pitch.
4. Set "rateMultiplier" between 0.88 and 1.16 to match the speaker's speaking speed.
5. Set "warmthBoost" between -3 and +4 (dB low-mid EQ adjustment) to match vocal fullness.
6. Write "toneDescription" and "accentNotes" clearly in Bengali (with key acoustic terms if helpful) so the customer easily understands their analyzed voice DNA.
7. Transcribe a short phrase (or summarize the spoken sentence) accurately in "transcriptSample".
8. Suggest a clean short Bengali/English label in "suggestedProfileName"${
    customLabel?.trim()
      ? ` (user requested label hint: "${customLabel.trim()}")`
      : ''
  }.`;

  const ai = new GoogleGenAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedProfileName: { type: Type.STRING },
          gender: { type: Type.STRING },
          pitchLabel: { type: Type.STRING },
          speakingRateLabel: { type: Type.STRING },
          toneDescription: { type: Type.STRING },
          accentNotes: { type: Type.STRING },
          transcriptSample: { type: Type.STRING },
          matchedBaseVoice: { type: Type.STRING },
          synthesizedStylePrompt: { type: Type.STRING },
          pitchCentsOffset: { type: Type.INTEGER },
          rateMultiplier: { type: Type.NUMBER },
          warmthBoost: { type: Type.NUMBER },
        },
        required: [
          'suggestedProfileName',
          'gender',
          'pitchLabel',
          'speakingRateLabel',
          'toneDescription',
          'accentNotes',
          'transcriptSample',
          'matchedBaseVoice',
          'synthesizedStylePrompt',
          'pitchCentsOffset',
          'rateMultiplier',
          'warmthBoost',
        ],
      },
    },
  });

  const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text || response?.text || '';
  if (!rawText) {
    throw new Error('ভয়েস রেকর্ডিং বিশ্লেষণ থেকে কোনো উত্তর পাওয়া যায়নি। অনুগ্রহ করে পরিষ্কারভাবে আবার রেকর্ড করুন।');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('ভয়েস বিশ্লেষণ ডেটা প্রসেস করা যায়নি।');
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  const fallbackVoice =
    String(parsed?.gender || '').toLowerCase().includes('female') ? 'Kore' : 'Charon';
  const matchedBaseVoice = (VALID_GEMINI_BASE_VOICES as readonly string[]).includes(
    parsed?.matchedBaseVoice
  )
    ? parsed.matchedBaseVoice
    : fallbackVoice;

  const clamp = (val: number, min: number, max: number) =>
    Math.min(max, Math.max(min, val));

  return {
    suggestedProfileName:
      String(customLabel?.trim() || parsed?.suggestedProfileName || 'আমার কণ্ঠ প্রোফাইল').slice(
        0,
        48
      ),
    gender: String(parsed?.gender || 'Neutral').slice(0, 24),
    pitchLabel: String(parsed?.pitchLabel || 'Medium').slice(0, 36),
    speakingRateLabel: String(parsed?.speakingRateLabel || 'Natural Conversational').slice(
      0,
      48
    ),
    toneDescription: String(
      parsed?.toneDescription || 'স্পষ্ট, স্বাভাবিক এবং উষ্ণ কণ্ঠস্বর।'
    ).slice(0, 240),
    accentNotes: String(
      parsed?.accentNotes || 'পরিষ্কার উচ্চারণ ও ভারসাম্যপূর্ণ ছন্দ।'
    ).slice(0, 180),
    transcriptSample: String(
      parsed?.transcriptSample || 'ভয়েস স্যাম্পল রেকর্ড সম্পন্ন হয়েছে।'
    ).slice(0, 180),
    matchedBaseVoice,
    synthesizedStylePrompt: String(
      parsed?.synthesizedStylePrompt ||
        'Natural warm conversational delivery matching the speaker tone with clear articulation'
    ).slice(0, 420),
    pitchCentsOffset: Math.round(
      clamp(Number(parsed?.pitchCentsOffset) || 0, -220, 220)
    ),
    rateMultiplier: Number(
      clamp(Number(parsed?.rateMultiplier) || 1.0, 0.85, 1.2).toFixed(2)
    ),
    warmthBoost: Number(
      clamp(Number(parsed?.warmthBoost) || 0, -4, 4).toFixed(1)
    ),
  };
}

export function encodeAudioBufferToWavBytes(audioBuffer: AudioBuffer): Uint8Array {
  const numChannels = Math.min(1, audioBuffer.numberOfChannels || 1);
  const sampleRate = audioBuffer.sampleRate || 24000;
  const channelData = audioBuffer.getChannelData(0);
  const frameCount = channelData.length;
  const dataSize = frameCount * 2;
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
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

/**
 * Renders TTS bytes through an OfflineAudioContext applying the analyzed
 * pitch alignment (detune), speaking pace (playbackRate), chest warmth EQ filter,
 * and optional loudness boost so both playback and WAV download reflect the
 * customer's calibrated Voice DNA.
 */
export async function renderCalibratedAudioBytes(options: {
  rawBytes: Uint8Array;
  pitchCentsOffset?: number;
  rateMultiplier?: number;
  warmthBoost?: number;
  loudnessBoost?: boolean;
}): Promise<Uint8Array> {
  const {
    rawBytes,
    pitchCentsOffset = 0,
    rateMultiplier = 1.0,
    warmthBoost = 0,
    loudnessBoost = false,
  } = options;

  const needsProcessing =
    Math.abs(pitchCentsOffset) >= 5 ||
    Math.abs(rateMultiplier - 1.0) >= 0.02 ||
    Math.abs(warmthBoost) >= 0.3 ||
    loudnessBoost;

  if (!needsProcessing) {
    return rawBytes;
  }

  if (
    typeof window === 'undefined' ||
    typeof OfflineAudioContext === 'undefined'
  ) {
    return rawBytes;
  }

  const tempCtx = new (window.AudioContext ||
    (window as any).webkitAudioContext)({ sampleRate: 24000 });
  try {
    const decoded = await decodeAudioToBuffer(rawBytes, tempCtx, 24000);
    const effectiveRate = Math.max(0.75, Math.min(1.4, rateMultiplier)) *
      Math.pow(2, pitchCentsOffset / 1200);
    const outputSampleRate = 24000;
    const outputLength = Math.max(
      1,
      Math.ceil((decoded.duration / Math.max(0.5, effectiveRate)) * outputSampleRate) +
        Math.round(outputSampleRate * 0.08)
    );

    const offlineCtx = new OfflineAudioContext(1, outputLength, outputSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.playbackRate.value = Math.max(0.75, Math.min(1.4, rateMultiplier));
    source.detune.value = Math.max(-350, Math.min(350, pitchCentsOffset));

    let currentNode: AudioNode = source;

    if (Math.abs(warmthBoost) >= 0.3) {
      const shelf = offlineCtx.createBiquadFilter();
      shelf.type = 'lowshelf';
      shelf.frequency.value = 230;
      shelf.gain.value = Math.max(-5, Math.min(5, warmthBoost));
      currentNode.connect(shelf);
      currentNode = shelf;
    }

    if (loudnessBoost) {
      const gainNode = offlineCtx.createGain();
      gainNode.gain.value = 1.38;
      const compressor = offlineCtx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.ratio.value = 4;
      currentNode.connect(gainNode);
      gainNode.connect(compressor);
      currentNode = compressor;
    }

    currentNode.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    return encodeAudioBufferToWavBytes(rendered);
  } catch {
    return rawBytes;
  } finally {
    if (tempCtx.state !== 'closed') {
      tempCtx.close().catch(() => {});
    }
  }
}

export function createCalibratedWavBlob(bytes: Uint8Array): Blob {
  return createWavBlob(bytes, 24000);
}
