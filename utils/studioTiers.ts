/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import { ProPackageType, UserPlan } from '../types';

export type StudioTierId = 'free' | 'monthly' | 'yearly';

export interface StudioTierCapabilities {
  tier: StudioTierId;
  maxScriptChars: number;
  maxSavedScripts: number;
  allowExtraStyles: boolean;
  allowPlaybackSpeed: boolean;
  allowLoudnessBoost: boolean;
  allowCustomLoopDelay: boolean;
}

export interface StudioStylePreset {
  id: string;
  label: string;
  value: string;
  tier: 'standard' | 'yearly';
}

export interface SavedStudioScript {
  id: string;
  title: string;
  text: string;
  style: string;
  voiceName: string;
  updatedAt: number;
}

export const STUDIO_TIER_LIMITS = {
  free: {
    maxScriptChars: 1000,
    maxSavedScripts: 0,
    validityLabel: 'দৈনিক ফ্রি কোটা',
  },
  monthly: {
    maxScriptChars: 2500,
    maxSavedScripts: 3,
    validityLabel: '৩০ দিন মেয়াদ',
  },
  yearly: {
    maxScriptChars: 5000,
    maxSavedScripts: 25,
    validityLabel: '৩৬৫ দিন (১ বছর)',
  },
} as const;

export const STUDIO_PLAYBACK_SPEEDS = [0.85, 1.0, 1.15, 1.25] as const;
export const STUDIO_ALARM_DELAYS_MS = [1200, 3000, 5000, 10000] as const;

export const STUDIO_STYLE_PRESETS: StudioStylePreset[] = [
  {
    id: 'alarm',
    label: 'Energetic Morning Alarm',
    value: 'Energetic, bright, motivating morning wake-up announcement with crisp articulation',
    tier: 'standard',
  },
  {
    id: 'warm',
    label: 'Warm & Gentle',
    value: 'Warm, soothing, encouraging mentor tone',
    tier: 'standard',
  },
  {
    id: 'coach',
    label: 'Firm Study Coach',
    value: 'Firm, confident, disciplined coach urging immediate action',
    tier: 'standard',
  },
  {
    id: 'calm',
    label: 'Calm & Clear',
    value: 'Natural, calm, steady conversational narrator',
    tier: 'standard',
  },
  {
    id: 'documentary',
    label: 'Documentary Narrator',
    value: 'Cinematic, deep, authoritative documentary storytelling narration with measured pacing',
    tier: 'yearly',
  },
  {
    id: 'newsroom',
    label: 'Newsroom Anchor',
    value: 'Crisp, authoritative broadcast news anchor with clear emphasis and steady rhythm',
    tier: 'yearly',
  },
  {
    id: 'podcast',
    label: 'Podcast Host',
    value: 'Engaging, warm, expressive conversational studio podcast host',
    tier: 'yearly',
  },
  {
    id: 'meditation',
    label: 'Mindful Calm Guide',
    value: 'Soft, tranquil, slow-paced mindfulness and relaxation guide with gentle pauses',
    tier: 'yearly',
  },
];

export function resolveStudioTier(options: {
  isAdmin: boolean;
  userPlan: UserPlan;
  proPackageType?: ProPackageType | null;
}): StudioTierId {
  if (options.isAdmin) return 'yearly';
  if (options.userPlan === 'pro') {
    return options.proPackageType === 'yearly' ? 'yearly' : 'monthly';
  }
  return 'free';
}

export function getStudioCapabilities(tier: StudioTierId): StudioTierCapabilities {
  if (tier === 'yearly') {
    return {
      tier: 'yearly',
      maxScriptChars: STUDIO_TIER_LIMITS.yearly.maxScriptChars,
      maxSavedScripts: STUDIO_TIER_LIMITS.yearly.maxSavedScripts,
      allowExtraStyles: true,
      allowPlaybackSpeed: true,
      allowLoudnessBoost: true,
      allowCustomLoopDelay: true,
    };
  }
  if (tier === 'monthly') {
    return {
      tier: 'monthly',
      maxScriptChars: STUDIO_TIER_LIMITS.monthly.maxScriptChars,
      maxSavedScripts: STUDIO_TIER_LIMITS.monthly.maxSavedScripts,
      allowExtraStyles: false,
      allowPlaybackSpeed: false,
      allowLoudnessBoost: false,
      allowCustomLoopDelay: false,
    };
  }
  return {
    tier: 'free',
    maxScriptChars: STUDIO_TIER_LIMITS.free.maxScriptChars,
    maxSavedScripts: STUDIO_TIER_LIMITS.free.maxSavedScripts,
    allowExtraStyles: false,
    allowPlaybackSpeed: false,
    allowLoudnessBoost: false,
    allowCustomLoopDelay: false,
  };
}

const SAVED_SCRIPTS_PREFIX = 'srabon_studio_saved_scripts_v1';

export function loadSavedStudioScripts(uid?: string | null): SavedStudioScript[] {
  if (typeof window === 'undefined' || !uid) return [];
  try {
    const raw = localStorage.getItem(`${SAVED_SCRIPTS_PREFIX}:${uid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.text === 'string'
      )
      .slice(0, 25);
  } catch {
    return [];
  }
}

export function persistSavedStudioScripts(
  uid: string | null | undefined,
  items: SavedStudioScript[]
): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    localStorage.setItem(`${SAVED_SCRIPTS_PREFIX}:${uid}`, JSON.stringify(items.slice(0, 25)));
  } catch {}
}
