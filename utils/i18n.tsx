/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SalonServiceKey } from '../types';

export type AppLanguage = 'bn' | 'en';

export const LANGUAGE_STORAGE_KEY = 'srabon_lang';

export function getStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'bn';
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'bn') {
      return saved;
    }
  } catch {
    // Ignore storage access errors in restricted iframes
  }
  return 'bn';
}

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (next: AppLanguage) => void;
  toggleLang: () => void;
  bi: <T>(bnText: T, enText: T) => T;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'bn',
  setLang: () => {},
  toggleLang: () => {},
  bi: <T,>(bnText: T) => bnText,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLanguage>(() => getStoredLanguage());

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      } catch {
        // Ignore storage write errors
      }
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'bn' ? 'en' : 'bn');
  }, [lang, setLang]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
      document.title =
        lang === 'bn'
          ? 'শ্রাবণ গো – এআই ভয়েস স্টুডিও ও টেক্সট-টু-স্পিচ'
          : 'Srabon Go – AI Voice Studio & Multilingual Text-to-Speech';
    }
  }, [lang]);

  const bi = useCallback(
    <T,>(bnText: T, enText: T): T => (lang === 'bn' ? bnText : enText),
    [lang]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, toggleLang, bi }),
    [lang, setLang, toggleLang, bi]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

const GENDER_BN_MAP: Record<string, string> = {
  all: 'সব লিঙ্গ',
  male: 'পুরুষ',
  female: 'নারী',
};

const GENDER_EN_MAP: Record<string, string> = {
  all: 'All Genders',
  male: 'Male',
  female: 'Female',
};

export function localizeGender(gender: string, lang: AppLanguage): string {
  const key = (gender || '').trim().toLowerCase();
  if (lang === 'bn') {
    return GENDER_BN_MAP[key] || gender;
  }
  return GENDER_EN_MAP[key] || gender;
}

const PITCH_BN_MAP: Record<string, string> = {
  all: 'সব পিচ',
  'all pitches': 'সব পিচ',
  higher: 'উচ্চ স্বর',
  'medium-high': 'মাঝারি-উচ্চ',
  middle: 'মধ্যম',
  medium: 'মাঝারি',
  'medium-low': 'মাঝারি-নিম্ন',
  'lower middle': 'নিম্ন-মধ্যম',
  lower: 'নিম্ন স্বর',
  low: 'গভীর নিম্ন',
};

const PITCH_EN_MAP: Record<string, string> = {
  all: 'All Pitches',
  'all pitches': 'All Pitches',
  higher: 'Higher',
  'medium-high': 'Medium-High',
  middle: 'Middle',
  medium: 'Medium',
  'medium-low': 'Medium-Low',
  'lower middle': 'Lower middle',
  lower: 'Lower',
  low: 'Low',
};

export function localizePitch(pitch: string, lang: AppLanguage): string {
  const key = (pitch || '').trim().toLowerCase();
  if (lang === 'bn') {
    return PITCH_BN_MAP[key] || pitch;
  }
  return PITCH_EN_MAP[key] || pitch;
}

const TRAIT_BN_MAP: Record<string, string> = {
  bright: 'উজ্জ্বল',
  warm: 'উষ্ণ',
  clear: 'স্পষ্ট',
  upbeat: 'প্রাণবন্ত',
  firm: 'দৃঢ়',
  excitable: 'উচ্ছ্বসিত',
  youthful: 'তারুণ্যদীপ্ত',
  breezy: 'স্বচ্ছন্দ',
  'easy-going': 'সহজ-সরল',
  breathy: 'কোমল শ্বাসময়',
  smooth: 'মসৃণ',
  gravelly: 'গম্ভীর রুক্ষ',
  informative: 'তথ্যবহুল',
  soft: 'নরম',
  even: 'সুষম',
  mature: 'পরিণত',
  forward: 'সাবলীল',
  friendly: 'বন্ধুত্বপূর্ণ',
  casual: 'স্বাভাবিক',
  gentle: 'সৌম্য',
  lively: 'সজীব',
  knowledgeable: 'জ্ঞানী',
  enthusiastic: 'উৎসাহী',
  'young adult': 'তরুণ প্রাপ্তবয়স্ক',
  'clear articulation': 'স্পষ্ট উচ্চারণ',
  'general american accent': 'সাধারণ আমেরিকান উচ্চারণ',
  'american accent': 'আমেরিকান উচ্চারণ',
  energetic: 'উদ্যমী',
  approachable: 'আপনজনসুলভ',
  deep: 'গভীর',
  calm: 'শান্ত',
  resonant: 'গাম্ভীর্যপূর্ণ',
  professional: 'পেশাদার',
  optimistic: 'আশাবাদী',
  inquisitive: 'কৌতূহলী',
  'mid-30s': 'মধ্য-৩০',
  articulate: 'সুবক্তা',
  engaging: 'আকর্ষণীয়',
  encouraging: 'অনুপ্রেরণামূলক',
  confident: 'আত্মবিশ্বাসী',
  motivating: 'উদ্বুদ্ধকারী',
  inviting: 'আমন্ত্রণমূলক',
  'adult (30s-40s)': 'প্রাপ্তবয়স্ক (৩০-৪০)',
  sophisticated: 'মার্জিত',
  'clear enunciation': 'নিখুঁত উচ্চারণ',
};

export function localizeTrait(trait: string, lang: AppLanguage): string {
  const key = (trait || '').trim().toLowerCase();
  if (lang === 'bn') {
    return TRAIT_BN_MAP[key] || trait;
  }
  return trait;
}

export function localizeAlbumLabel(albumLabel: string, lang: AppLanguage): string {
  if (lang !== 'bn') return albumLabel;
  const key = (albumLabel || '').trim().toLowerCase();
  if (key === 'emerald brights') return 'এমেরাল্ড ব্রাইটস';
  if (key === 'golden storyteller') return 'গোল্ডেন স্টোরিটেলার';
  if (key === 'midnight nocturne') return 'মিডনাইট নকটার্ন';
  return albumLabel;
}

const STUDIO_PRESET_BN_MAP: Record<string, string> = {
  alarm: 'উদ্যমী মর্নিং অ্যালার্ম',
  warm: 'উষ্ণ ও সৌম্য',
  coach: 'দৃঢ় স্টাডি কোচ',
  calm: 'শান্ত ও স্পষ্ট',
  documentary: 'ডকুমেন্টারি বর্ণনাকারী',
  newsroom: 'নিউজরুম অ্যাঙ্কর',
  podcast: 'পডকাস্ট উপস্থাপক',
  meditation: 'ধ্যানমগ্ন শান্ত গাইড',
};

export function localizeStudioPresetLabel(
  presetId: string,
  fallbackEn: string,
  lang: AppLanguage
): string {
  if (lang === 'bn') {
    return STUDIO_PRESET_BN_MAP[presetId] || fallbackEn;
  }
  return fallbackEn;
}

const SALON_SERVICE_LOCALE: Record<
  SalonServiceKey,
  {
    enTitle: string;
    bnTitle: string;
    enDuration: string;
    bnDuration: string;
    enDescription: string;
    bnDescription: string;
  }
> = {
  haircut: {
    enTitle: 'Classic & Modern Haircut',
    bnTitle: 'হেয়ার কাটিং ও স্টাইলিং',
    enDuration: '30 mins',
    bnDuration: '৩০ মিনিট',
    enDescription: 'Fade, undercut, crop or classic gents haircut with finishing styling.',
    bnDescription: 'ফেড, আন্ডারকাট, ক্রপ বা ক্লাসিক জেন্টস হেয়ারকাট সাথে ফিনিশিং সেটিং।',
  },
  beard: {
    enTitle: 'Beard Trim & Line-Up',
    bnTitle: 'দাড়ি সেট ও ট্রিম',
    enDuration: '20 mins',
    bnDuration: '২০ মিনিট',
    enDescription: 'Crisp razor line-up, shaping, and soothing beard oil massage.',
    bnDescription: 'নিখুঁত রেজর লাইন-আপ, শেপিং এবং বিয়ার্ড অয়েল ম্যাসাজ।',
  },
  shave: {
    enTitle: 'Royal Hot Towel Shave',
    bnTitle: 'হট টাওয়েল ক্লাসিক শেভ',
    enDuration: '25 mins',
    bnDuration: '২৫ মিনিট',
    enDescription: 'Steam towel treatment, double-blade smooth shave, and cooling after-shave gel.',
    bnDescription: 'স্টিম টাওয়েল, ডাবল-ব্লেড স্মুথ শেভ এবং আফটার-শেভ কুলিং জেল।',
  },
  color: {
    enTitle: 'Hair Color & Wash',
    bnTitle: 'হেয়ার কালার ও শ্যাম্পু ওয়াশ',
    enDuration: '45 mins',
    bnDuration: '৪৫ মিনিট',
    enDescription: 'Natural black or stylish shade hair color followed by conditioning wash.',
    bnDescription: 'প্রাকৃতিক কালো বা স্টাইলিশ শেড হেয়ার কালার এবং কন্ডিশনিং ওয়াশ।',
  },
  facial: {
    enTitle: 'Gents Facial & Cleanup',
    bnTitle: 'জেন্টস ফেসিয়াল ও স্কিন কেয়ার',
    enDuration: '40 mins',
    bnDuration: '৪০ মিনিট',
    enDescription: 'Deep pore cleansing, de-tan scrub, and brightening face mask.',
    bnDescription: 'ডিপ পোর ক্লিনজিং, ডি-ট্যান স্ক্রাব এবং ব্রাইটেনিং ফেস মাস্ক।',
  },
  combo: {
    enTitle: 'Full Grooming Combo',
    bnTitle: 'ফুল গ্রুমিং কম্বো প্যাক',
    enDuration: '60 mins',
    bnDuration: '৬০ মিনিট',
    enDescription: 'Haircut + beard trim/shave + shampoo wash + head and face massage.',
    bnDescription: 'হেয়ারকাট + দাড়ি ট্রিম/শেভ + শ্যাম্পু ওয়াশ + হেড ও ফেস ম্যাসাজ।',
  },
};

const SALON_TITLE_FIELD_MAP: Record<
  SalonServiceKey,
  'haircutTitle' | 'beardTrimTitle' | 'shaveTitle' | 'hairColorTitle' | 'facialTitle' | 'comboTitle'
> = {
  haircut: 'haircutTitle',
  beard: 'beardTrimTitle',
  shave: 'shaveTitle',
  color: 'hairColorTitle',
  facial: 'facialTitle',
  combo: 'comboTitle',
};

export function isCustomSalonServiceTitle(
  key: SalonServiceKey,
  candidate?: string | null
): boolean {
  const entry = SALON_SERVICE_LOCALE[key];
  const clean = (candidate || '').trim();
  if (clean.length < 2) return false;
  return clean !== entry.enTitle && clean !== entry.bnTitle;
}

export function localizeSalonService(
  key: SalonServiceKey,
  lang: AppLanguage,
  salonConfig?: {
    haircutTitle?: string;
    beardTrimTitle?: string;
    shaveTitle?: string;
    hairColorTitle?: string;
    facialTitle?: string;
    comboTitle?: string;
  } | null,
  bookingTitleFallback?: string | null
): {
  primaryTitle: string;
  secondaryTitle: string;
  duration: string;
  description: string;
  isCustom: boolean;
} {
  const entry = SALON_SERVICE_LOCALE[key];
  const fieldName = SALON_TITLE_FIELD_MAP[key];
  const configTitle = (salonConfig?.[fieldName] || '').trim();
  const bookedTitle = (bookingTitleFallback || '').trim();

  if (isCustomSalonServiceTitle(key, configTitle)) {
    return {
      primaryTitle: configTitle,
      secondaryTitle: '',
      duration: lang === 'bn' ? entry.bnDuration : entry.enDuration,
      description: lang === 'bn' ? entry.bnDescription : entry.enDescription,
      isCustom: true,
    };
  }

  if (isCustomSalonServiceTitle(key, bookedTitle)) {
    return {
      primaryTitle: bookedTitle,
      secondaryTitle: '',
      duration: lang === 'bn' ? entry.bnDuration : entry.enDuration,
      description: lang === 'bn' ? entry.bnDescription : entry.enDescription,
      isCustom: true,
    };
  }

  if (lang === 'bn') {
    return {
      primaryTitle: entry.bnTitle,
      secondaryTitle: entry.enTitle,
      duration: entry.bnDuration,
      description: entry.bnDescription,
      isCustom: false,
    };
  }
  return {
    primaryTitle: entry.enTitle,
    secondaryTitle: entry.bnTitle,
    duration: entry.enDuration,
    description: entry.enDescription,
    isCustom: false,
  };
}

export function localizeBookingStatus(status: string, lang: AppLanguage): string {
  const s = (status || '').toLowerCase();
  if (lang === 'bn') {
    if (s === 'confirmed') return 'নিশ্চিত';
    if (s === 'completed') return 'সম্পন্ন';
    if (s === 'cancelled') return 'বাতিল';
    return 'অপেক্ষমাণ';
  }
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'completed') return 'Completed';
  if (s === 'cancelled') return 'Cancelled';
  return 'Pending';
}

export function localizeUpgradeStatus(status: string, lang: AppLanguage): string {
  const s = (status || '').toLowerCase();
  if (lang === 'bn') {
    if (s === 'approved') return 'অনুমোদিত';
    if (s === 'rejected') return 'বাতিল';
    return 'অপেক্ষমাণ';
  }
  if (s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  return 'Pending';
}

export function localizeDate(
  timestamp: number | Date | undefined | null,
  lang: AppLanguage,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  return date.toLocaleDateString(
    locale,
    options || { day: 'numeric', month: 'short', year: 'numeric' }
  );
}

export function localizeDateTime(
  timestamp: number | Date | undefined | null,
  lang: AppLanguage
): string {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  return date.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function localizePlanLabel(
  plan: string,
  packageType: string | null | undefined,
  isAdmin: boolean,
  lang: AppLanguage
): string {
  if (isAdmin) return lang === 'bn' ? 'অ্যাডমিন আনলিমিটেড' : 'Admin Unlimited';
  if (plan === 'pro') {
    if (packageType === 'yearly') {
      return lang === 'bn' ? 'ইয়ারলি প্রো' : 'Yearly Pro';
    }
    return lang === 'bn' ? 'মান্থলি প্রো' : 'Monthly Pro';
  }
  return lang === 'bn' ? 'ফ্রি' : 'Free';
}

/**
 * Safely copy text to clipboard inside standard browsers and sandboxed iframes
 * without ever throwing an unhandled Promise rejection.
 */
export async function copyTextSafely(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below when Clipboard API is blocked by iframe Permissions-Policy
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
