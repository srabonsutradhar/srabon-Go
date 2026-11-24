/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import { SocialLinksConfig } from '../types';

export const DEFAULT_SOCIAL_LINKS: SocialLinksConfig = {
  facebookUrl: 'https://www.facebook.com/srabongo',
  instagramUrl: 'https://www.instagram.com/srabongo',
  linkedinUrl: 'https://www.linkedin.com/company/srabongo',
  youtubeUrl: '',
};

const STRICT_HTTPS_REGEX = /^https:\/\/[a-zA-Z0-9._~:/?#@!$&()*+,;=%-]+$/;

export function isValidHttpsSocialUrl(url: string): boolean {
  if (!url) return true;
  if (url.length > 300) return false;
  return STRICT_HTTPS_REGEX.test(url);
}

export function normalizeSocialUrlInput(raw: string): {
  value: string;
  valid: boolean;
} {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { value: '', valid: true };
  }
  const withProto = /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, 'https://')
    : `https://${trimmed}`;
  if (withProto.length > 300 || !STRICT_HTTPS_REGEX.test(withProto)) {
    return { value: withProto, valid: false };
  }
  return { value: withProto, valid: true };
}

export function sanitizeSocialLinksConfig(raw: any): SocialLinksConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SOCIAL_LINKS };
  }
  const pick = (val: unknown, fallback: string): string => {
    if (typeof val !== 'string') return fallback;
    const trimmed = val.trim().slice(0, 300);
    if (trimmed === '') return '';
    return STRICT_HTTPS_REGEX.test(trimmed) ? trimmed : fallback;
  };
  return {
    facebookUrl: pick(raw.facebookUrl, DEFAULT_SOCIAL_LINKS.facebookUrl),
    instagramUrl: pick(raw.instagramUrl, DEFAULT_SOCIAL_LINKS.instagramUrl),
    linkedinUrl: pick(raw.linkedinUrl, DEFAULT_SOCIAL_LINKS.linkedinUrl),
    youtubeUrl: pick(raw.youtubeUrl, DEFAULT_SOCIAL_LINKS.youtubeUrl),
    updatedAt: raw.updatedAt,
  };
}
