/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SalonServiceKey } from '../types';
import { translateEnToPt } from './ptTranslations';

export type AppLanguage = 'bn' | 'en' | 'pt';

export const LANGUAGE_STORAGE_KEY = 'srabon_lang';

export function getStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'bn';
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'bn' || saved === 'pt') {
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
  bi: <T>(bnText: T, enText: T, ptText?: T) => T;
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
    setLang(lang === 'bn' ? 'en' : lang === 'en' ? 'pt' : 'bn');
  }, [lang, setLang]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'bn' ? 'bn' : lang === 'pt' ? 'pt' : 'en';
      document.title =
        lang === 'bn'
          ? 'শ্রাবণ গো – এআই ভয়েস স্টুডিও ও টেক্সট-টু-স্পিচ'
          : lang === 'pt'
          ? 'Srabon Go – Estúdio de Voz IA e Texto para Fala Multilíngue'
          : 'Srabon Go – AI Voice Studio & Multilingual Text-to-Speech';
    }
  }, [lang]);

  const bi = useCallback(
    <T,>(bnText: T, enText: T, ptText?: T): T => {
      if (lang === 'bn') return bnText;
      if (lang === 'en') return enText;
      if (ptText !== undefined) return ptText;
      if (typeof enText === 'string') {
        return translateEnToPt(enText) as unknown as T;
      }
      return enText;
    },
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

const GENDER_PT_MAP: Record<string, string> = {
  all: 'Todos os Gêneros',
  male: 'Masculino',
  female: 'Feminino',
};

export function localizeGender(gender: string, lang: AppLanguage): string {
  const key = (gender || '').trim().toLowerCase();
  if (lang === 'bn') {
    return GENDER_BN_MAP[key] || gender;
  }
  if (lang === 'pt') {
    return GENDER_PT_MAP[key] || gender;
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

const PITCH_PT_MAP: Record<string, string> = {
  all: 'Todos os Tons',
  'all pitches': 'Todos os Tons',
  higher: 'Agudo',
  'medium-high': 'Médio-Agudo',
  middle: 'Médio',
  medium: 'Médio',
  'medium-low': 'Médio-Grave',
  'lower middle': 'Médio-Grave',
  lower: 'Grave',
  low: 'Muito Grave',
};

export function localizePitch(pitch: string, lang: AppLanguage): string {
  const key = (pitch || '').trim().toLowerCase();
  if (lang === 'bn') {
    return PITCH_BN_MAP[key] || pitch;
  }
  if (lang === 'pt') {
    return PITCH_PT_MAP[key] || pitch;
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

const TRAIT_PT_MAP: Record<string, string> = {
  bright: 'Brilhante',
  warm: 'Acolhedor',
  clear: 'Claro',
  upbeat: 'Animado',
  firm: 'Firme',
  excitable: 'Empolgante',
  youthful: 'Jovem',
  breezy: 'Descontraído',
  'easy-going': 'Tranquilo',
  breathy: 'Suave com respiro',
  smooth: 'Suave',
  gravelly: 'Grave texturizado',
  informative: 'Informativo',
  soft: 'Macio',
  even: 'Equilibrado',
  mature: 'Maduro',
  forward: 'Direto',
  friendly: 'Amigável',
  casual: 'Casual',
  gentle: 'Gentil',
  lively: 'Vibrante',
  knowledgeable: 'Instruído',
  enthusiastic: 'Entusiasmado',
  'young adult': 'Jovem adulto',
  'clear articulation': 'Articulação clara',
  'general american accent': 'Sotaque americano neutro',
  'american accent': 'Sotaque americano',
  energetic: 'Energético',
  approachable: 'Acessível',
  deep: 'Profundo',
  calm: 'Calmo',
  resonant: 'Ressonante',
  professional: 'Profissional',
  optimistic: 'Otimista',
  inquisitive: 'Curioso',
  'mid-30s': 'Cerca de 35 anos',
  articulate: 'Articulado',
  engaging: 'Envolvente',
  encouraging: 'Encorajador',
  confident: 'Confiante',
  motivating: 'Motivador',
  inviting: 'Convidativo',
  'adult (30s-40s)': 'Adulto (30–40 anos)',
  sophisticated: 'Sofisticado',
  'clear enunciation': 'Dicção nítida',
};

export function localizeTrait(trait: string, lang: AppLanguage): string {
  const key = (trait || '').trim().toLowerCase();
  if (lang === 'bn') {
    return TRAIT_BN_MAP[key] || trait;
  }
  if (lang === 'pt') {
    return TRAIT_PT_MAP[key] || trait;
  }
  return trait;
}

export function localizeAlbumLabel(albumLabel: string, lang: AppLanguage): string {
  const key = (albumLabel || '').trim().toLowerCase();
  if (lang === 'bn') {
    if (key === 'emerald brights') return 'এমেরাল্ড ব্রাইটস';
    if (key === 'golden storyteller') return 'গোল্ডেন স্টোরিটেলার';
    if (key === 'midnight nocturne') return 'মিডনাইট নকটার্ন';
    return albumLabel;
  }
  if (lang === 'pt') {
    if (key === 'emerald brights') return 'Brilhos Esmeralda';
    if (key === 'golden storyteller') return 'Narrador Dourado';
    if (key === 'midnight nocturne') return 'Noturno da Meia-Noite';
    return albumLabel;
  }
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

const STUDIO_PRESET_PT_MAP: Record<string, string> = {
  alarm: 'Alarme Matinal Energético',
  warm: 'Acolhedor e Gentil',
  coach: 'Coach de Estudos Firme',
  calm: 'Calmo e Claro',
  documentary: 'Narrador de Documentário',
  newsroom: 'Âncora de Telejornal',
  podcast: 'Apresentador de Podcast',
  meditation: 'Guia Calmo de Meditação',
};

export function localizeStudioPresetLabel(
  presetId: string,
  fallbackEn: string,
  lang: AppLanguage
): string {
  if (lang === 'bn') {
    return STUDIO_PRESET_BN_MAP[presetId] || fallbackEn;
  }
  if (lang === 'pt') {
    return STUDIO_PRESET_PT_MAP[presetId] || fallbackEn;
  }
  return fallbackEn;
}

const SALON_SERVICE_LOCALE: Record<
  SalonServiceKey,
  {
    enTitle: string;
    bnTitle: string;
    ptTitle: string;
    enDuration: string;
    bnDuration: string;
    ptDuration: string;
    enDescription: string;
    bnDescription: string;
    ptDescription: string;
  }
> = {
  haircut: {
    enTitle: 'Classic & Modern Haircut',
    bnTitle: 'হেয়ার কাটিং ও স্টাইলিং',
    ptTitle: 'Corte Clássico e Moderno',
    enDuration: '30 mins',
    bnDuration: '৩০ মিনিট',
    ptDuration: '30 min',
    enDescription: 'Fade, undercut, crop or classic gents haircut with finishing styling.',
    bnDescription: 'ফেড, আন্ডারকাট, ক্রপ বা ক্লাসিক জেন্টস হেয়ারকাট সাথে ফিনিশিং সেটিং।',
    ptDescription: 'Degradê, undercut, crop ou corte masculino clássico com finalização.',
  },
  beard: {
    enTitle: 'Beard Trim & Line-Up',
    bnTitle: 'দাড়ি সেট ও ট্রিম',
    ptTitle: 'Corte e Alinhamento de Barba',
    enDuration: '20 mins',
    bnDuration: '২০ মিনিট',
    ptDuration: '20 min',
    enDescription: 'Crisp razor line-up, shaping, and soothing beard oil massage.',
    bnDescription: 'নিখুঁত রেজর লাইন-আপ, শেপিং এবং বিয়ার্ড অয়েল ম্যাসাজ।',
    ptDescription: 'Contorno preciso com navalha, modelagem e massagem com óleo para barba.',
  },
  shave: {
    enTitle: 'Royal Hot Towel Shave',
    bnTitle: 'হট টাওয়েল ক্লাসিক শেভ',
    ptTitle: 'Barba Clássica com Toalha Quente',
    enDuration: '25 mins',
    bnDuration: '২৫ মিনিট',
    ptDuration: '25 min',
    enDescription: 'Steam towel treatment, double-blade smooth shave, and cooling after-shave gel.',
    bnDescription: 'স্টিম টাওয়েল, ডাবল-ব্লেড স্মুথ শেভ এবং আফটার-শেভ কুলিং জেল।',
    ptDescription: 'Tratamento com toalha a vapor, barbear suave em lâmina dupla e gel pós-barba.',
  },
  color: {
    enTitle: 'Hair Color & Wash',
    bnTitle: 'হেয়ার কালার ও শ্যাম্পু ওয়াশ',
    ptTitle: 'Coloração e Lavagem Capilar',
    enDuration: '45 mins',
    bnDuration: '৪৫ মিনিট',
    ptDuration: '45 min',
    enDescription: 'Natural black or stylish shade hair color followed by conditioning wash.',
    bnDescription: 'প্রাকৃতিক কালো বা স্টাইলিশ শেড হেয়ার কালার এবং কন্ডিশনিং ওয়াশ।',
    ptDescription: 'Coloração preto natural ou tons modernos seguida de lavagem condicionante.',
  },
  facial: {
    enTitle: 'Gents Facial & Cleanup',
    bnTitle: 'জেন্টস ফেসিয়াল ও স্কিন কেয়ার',
    ptTitle: 'Limpeza de Pele e Facial Masculino',
    enDuration: '40 mins',
    bnDuration: '৪০ মিনিট',
    ptDuration: '40 min',
    enDescription: 'Deep pore cleansing, de-tan scrub, and brightening face mask.',
    bnDescription: 'ডিপ পোর ক্লিনজিং, ডি-ট্যান স্ক্রাব এবং ব্রাইটেনিং ফেস মাস্ক।',
    ptDescription: 'Limpeza profunda dos poros, esfoliação e máscara facial revitalizante.',
  },
  combo: {
    enTitle: 'Full Grooming Combo',
    bnTitle: 'ফুল গ্রুমিং কম্বো প্যাক',
    ptTitle: 'Combo Completo de Cuidados',
    enDuration: '60 mins',
    bnDuration: '৬০ মিনিট',
    ptDuration: '60 min',
    enDescription: 'Haircut + beard trim/shave + shampoo wash + head and face massage.',
    bnDescription: 'হেয়ারকাট + দাড়ি ট্রিম/শেভ + শ্যাম্পু ওয়াশ + হেড ও ফেস ম্যাসাজ।',
    ptDescription: 'Corte + barba/barbear + lavagem com shampoo + massagem capilar e facial.',
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

const SALON_TITLE_BN_FIELD_MAP: Record<
  SalonServiceKey,
  'haircutTitleBn' | 'beardTrimTitleBn' | 'shaveTitleBn' | 'hairColorTitleBn' | 'facialTitleBn' | 'comboTitleBn'
> = {
  haircut: 'haircutTitleBn',
  beard: 'beardTrimTitleBn',
  shave: 'shaveTitleBn',
  color: 'hairColorTitleBn',
  facial: 'facialTitleBn',
  combo: 'comboTitleBn',
};

function hasBengaliChars(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}

function hasLatinChars(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

const SALON_PHRASE_TRANSLATIONS: Array<[string, string]> = [
  ['হেয়ার কাটিং ও স্টাইলিং', 'Hair Cutting & Styling'],
  ['হেয়ার কাটিং', 'Hair Cutting'],
  ['হেয়ার কাট', 'Haircut'],
  ['হেয়ারকাট', 'Haircut'],
  ['দাড়ি সেট ও ট্রিম', 'Beard Set & Trim'],
  ['দাড়ি ট্রিম', 'Beard Trim'],
  ['হট টাওয়েল ক্লাসিক শেভ', 'Hot Towel Classic Shave'],
  ['হট টাওয়েল', 'Hot Towel'],
  ['হেয়ার কালার ও শ্যাম্পু ওয়াশ', 'Hair Color & Shampoo Wash'],
  ['হেয়ার কালার', 'Hair Color'],
  ['শ্যাম্পু ওয়াশ', 'Shampoo Wash'],
  ['জেন্টস ফেসিয়াল ও স্কিন কেয়ার', 'Gents Facial & Skin Care'],
  ['স্কিন কেয়ার', 'Skin Care'],
  ['ফুল গ্রুমিং কম্বো প্যাক', 'Full Grooming Combo Pack'],
  ['ফুল গ্রুমিং', 'Full Grooming'],
  ['হেয়ার স্ট্রেটনিং', 'Hair Straightening'],
  ['হেয়ার স্পা', 'Hair Spa'],
  ['হেড ম্যাসাজ', 'Head Massage'],
  ['ফেস ম্যাসাজ', 'Face Massage'],
  ['বডি ম্যাসাজ', 'Body Massage'],
  ['চারকোল ফেসিয়াল', 'Charcoal Facial'],
  ['গোল্ড ফেসিয়াল', 'Gold Facial'],
  ['হাইড্রা ফেসিয়াল', 'Hydra Facial'],
  ['ডি-ট্যান', 'De-Tan'],
  ['ফেস প্যাক', 'Face Pack'],
  ['ওয়েডিং প্যাকেজ', 'Wedding Package'],
  ['বর সাজ', 'Groom Makeover'],
  ['ক্লিন শেভ', 'Clean Shave'],
  ['লাইন আপ', 'Line-Up'],
  ['মডার্ন হেয়ারকাট', 'Modern Haircut'],
  ['ক্লাসিক হেয়ারকাট', 'Classic Haircut'],
  ['বাচ্চাদের হেয়ারকাট', 'Kids Haircut'],
  ['বেবি কাট', 'Baby Cut'],
  ['সুপার স্পেশাল', 'Super Special'],
];

const SALON_WORD_TRANSLATIONS: Array<[string, string]> = [
  ['স্পেশাল', 'Special'],
  ['প্রিমিয়াম', 'Premium'],
  ['ক্লাসিক', 'Classic'],
  ['মডার্ন', 'Modern'],
  ['রয়েল', 'Royal'],
  ['রাজকীয়', 'Royal'],
  ['ভিআইপি', 'VIP'],
  ['প্যাকেজ', 'Package'],
  ['কম্বো', 'Combo'],
  ['প্যাক', 'Pack'],
  ['সার্ভিস', 'Service'],
  ['স্টাইলিং', 'Styling'],
  ['স্টাইল', 'Style'],
  ['স্টাইলিশ', 'Stylish'],
  ['হেয়ার', 'Hair'],
  ['চুল', 'Hair'],
  ['কাটিং', 'Cutting'],
  ['কাট', 'Cut'],
  ['দাড়ি', 'Beard'],
  ['গোফ', 'Mustache'],
  ['গোঁফ', 'Mustache'],
  ['শেভিং', 'Shaving'],
  ['শেভ', 'Shave'],
  ['ট্রিম', 'Trim'],
  ['সেটিং', 'Setting'],
  ['সেট', 'Set'],
  ['ফেসিয়াল', 'Facial'],
  ['ফেস', 'Face'],
  ['ক্লিনআপ', 'Cleanup'],
  ['ক্লিন', 'Clean'],
  ['কেয়ার', 'Care'],
  ['স্কিন', 'Skin'],
  ['ম্যাসাজ', 'Massage'],
  ['স্পা', 'Spa'],
  ['কালার', 'Color'],
  ['রং', 'Color'],
  ['ডাই', 'Dye'],
  ['হেনা', 'Henna'],
  ['মেহেদি', 'Mehendi'],
  ['ওয়াশ', 'Wash'],
  ['শ্যাম্পু', 'Shampoo'],
  ['টাওয়েল', 'Towel'],
  ['হট', 'Hot'],
  ['স্টিম', 'Steam'],
  ['ফেড', 'Fade'],
  ['আন্ডারকাট', 'Undercut'],
  ['কার্ল', 'Curl'],
  ['স্ট্রেট', 'Straight'],
  ['কেরাটিন', 'Keratin'],
  ['স্মুথনিং', 'Smoothening'],
  ['জেন্টস', 'Gents'],
  ['মেনজ', "Men's"],
  ['বাচ্চাদের', 'Kids'],
  ['শিশু', 'Kids'],
  ['বেবি', 'Baby'],
  ['ব্লিচ', 'Bleach'],
  ['স্ক্রাব', 'Scrub'],
  ['মাস্ক', 'Mask'],
  ['পোলিশ', 'Polish'],
  ['ব্রাইটেনিং', 'Brightening'],
  ['ন্যাচারাল', 'Natural'],
  ['গ্লো', 'Glow'],
  ['গোল্ড', 'Gold'],
  ['ডায়মন্ড', 'Diamond'],
  ['চারকোল', 'Charcoal'],
  ['হার্বাল', 'Herbal'],
  ['জেল', 'Gel'],
  ['অয়েল', 'Oil'],
  ['তেল', 'Oil'],
  ['গ্রুমিং', 'Grooming'],
  ['বুকিং', 'Booking'],
  ['অফার', 'Offer'],
  ['ডিসকাউন্ট', 'Discount'],
  ['ফ্রি', 'Free'],
  ['এক্সট্রা', 'Extra'],
  ['লাক্সারি', 'Luxury'],
  ['সিগনেচার', 'Signature'],
  ['ফুল', 'Full'],
  ['হাফ', 'Half'],
  ['প্লাস', 'Plus'],
  ['এবং', 'and'],
  ['সাথে', 'with'],
  ['ও', '&'],
];

const BN_TO_LATIN_VOWELS: Record<string, string> = {
  'া': 'a',
  'ি': 'i',
  'ী': 'ee',
  'ু': 'u',
  'ূ': 'oo',
  'ৃ': 'ri',
  'ে': 'e',
  'ৈ': 'oi',
  'ো': 'o',
  'ৌ': 'ou',
};

const BN_TO_LATIN_CHARS: Record<string, string> = {
  অ: 'O',
  আ: 'A',
  ই: 'I',
  ঈ: 'Ee',
  উ: 'U',
  ঊ: 'Oo',
  ঋ: 'Ri',
  এ: 'E',
  ঐ: 'Oi',
  ও: 'O',
  ঔ: 'Ou',
  ক: 'k',
  খ: 'kh',
  গ: 'g',
  ঘ: 'gh',
  ঙ: 'ng',
  চ: 'ch',
  ছ: 'chh',
  জ: 'j',
  ঝ: 'jh',
  ঞ: 'n',
  ট: 't',
  ঠ: 'th',
  ড: 'd',
  ঢ: 'dh',
  ণ: 'n',
  ত: 't',
  থ: 'th',
  দ: 'd',
  ধ: 'dh',
  ন: 'n',
  প: 'p',
  ফ: 'f',
  ব: 'b',
  ভ: 'bh',
  ম: 'm',
  য: 'j',
  র: 'r',
  ল: 'l',
  শ: 'sh',
  ষ: 'sh',
  স: 's',
  হ: 'h',
  ড়: 'r',
  ঢ়: 'rh',
  য়: 'y',
  ৎ: 't',
  'ং': 'ng',
  'ঃ': 'h',
  'ঁ': 'n',
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

function transliterateBnWordToEn(word: string): string {
  if (!hasBengaliChars(word)) return word;
  let out = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (ch === '্') {
      continue;
    }
    if (BN_TO_LATIN_VOWELS[ch]) {
      out += BN_TO_LATIN_VOWELS[ch];
      continue;
    }
    if (BN_TO_LATIN_CHARS[ch]) {
      const mapped = BN_TO_LATIN_CHARS[ch];
      out += mapped;
      const isConsonant = /[\u0995-\u09B9\u09DC-\u09DF]/.test(ch);
      const next = word[i + 1];
      if (
        isConsonant &&
        next &&
        next !== '্' &&
        !BN_TO_LATIN_VOWELS[next] &&
        next !== 'ং' &&
        next !== 'ঃ' &&
        next !== 'ঁ' &&
        /[\u0995-\u09B9\u09DC-\u09DF]/.test(next) &&
        i < word.length - 1
      ) {
        out += 'a';
      }
      continue;
    }
    out += ch;
  }
  return out.replace(/^[a-z]/, (c) => c.toUpperCase());
}

const EN_TO_BN_DIGRAPH_CONSONANTS: Array<[string, string]> = [
  ['sh', 'শ'],
  ['ch', 'চ'],
  ['th', 'থ'],
  ['dh', 'ধ'],
  ['kh', 'খ'],
  ['gh', 'ঘ'],
  ['bh', 'ভ'],
  ['ph', 'ফ'],
  ['jh', 'ঝ'],
  ['ng', 'ং'],
];

const EN_TO_BN_SINGLE_CONSONANTS: Record<string, string> = {
  b: 'ব',
  c: 'ক',
  d: 'ড',
  f: 'ফ',
  g: 'গ',
  h: 'হ',
  j: 'জ',
  k: 'ক',
  l: 'ল',
  m: 'ম',
  n: 'ন',
  p: 'প',
  q: 'ক',
  r: 'র',
  s: 'স',
  t: 'ট',
  v: 'ভ',
  w: 'ওয়',
  x: 'ক্স',
  y: 'ইয়',
  z: 'জ',
};

const EN_TO_BN_VOWELS_INDEPENDENT: Array<[string, string]> = [
  ['oo', 'উ'],
  ['ee', 'ই'],
  ['ai', 'এই'],
  ['oi', 'ঐ'],
  ['ou', 'আউ'],
  ['au', 'অ'],
  ['a', 'আ'],
  ['e', 'এ'],
  ['i', 'ই'],
  ['o', 'ও'],
  ['u', 'উ'],
];

const EN_TO_BN_VOWEL_SIGNS: Array<[string, string]> = [
  ['oo', 'ু'],
  ['ee', 'ী'],
  ['ai', 'ে'],
  ['oi', 'ৈ'],
  ['ou', 'ৌ'],
  ['au', 'ো'],
  ['a', 'া'],
  ['e', 'ে'],
  ['i', 'ি'],
  ['o', 'ো'],
  ['u', 'ু'],
];

function transliterateEnWordToBn(word: string): string {
  if (!hasLatinChars(word)) return word;
  const lower = word.toLowerCase();
  let out = '';
  let i = 0;
  let afterConsonant = false;

  while (i < lower.length) {
    const slice2 = lower.slice(i, i + 2);
    const ch = lower[i];

    if (/[0-9]/.test(ch)) {
      const bnDigits = '০১২৩৪৫৬৭৮৯';
      out += bnDigits[Number(ch)] || ch;
      afterConsonant = false;
      i++;
      continue;
    }

    if (!/[a-z]/.test(ch)) {
      out += ch;
      afterConsonant = false;
      i++;
      continue;
    }

    // Vowels
    if ('aeiou'.includes(ch)) {
      const table = afterConsonant ? EN_TO_BN_VOWEL_SIGNS : EN_TO_BN_VOWELS_INDEPENDENT;
      const match = table.find(([pat]) => lower.startsWith(pat, i));
      if (match) {
        out += match[1];
        i += match[0].length;
      } else {
        i++;
      }
      afterConsonant = false;
      continue;
    }

    // Consonants (2-char digraphs first)
    const digraph = EN_TO_BN_DIGRAPH_CONSONANTS.find(([pat]) => slice2 === pat);
    if (digraph) {
      out += digraph[1];
      afterConsonant = digraph[0] !== 'ng';
      i += 2;
      continue;
    }

    out += EN_TO_BN_SINGLE_CONSONANTS[ch] || ch;
    afterConsonant = true;
    i++;
  }

  return out;
}

const SALON_EN_TO_PT_PHRASES: Array<[string, string]> = [
  ['Classic & Modern Haircut', 'Corte Clássico e Moderno'],
  ['Beard Trim & Line-Up', 'Corte e Alinhamento de Barba'],
  ['Royal Hot Towel Shave', 'Barba Clássica com Toalha Quente'],
  ['Hair Color & Wash', 'Coloração e Lavagem Capilar'],
  ['Gents Facial & Cleanup', 'Limpeza de Pele e Facial Masculino'],
  ['Full Grooming Combo', 'Combo Completo de Cuidados'],
  ['Hair Cutting & Styling', 'Corte e Estilização de Cabelo'],
  ['Hair Cutting', 'Corte de Cabelo'],
  ['Modern Haircut', 'Corte Moderno'],
  ['Classic Haircut', 'Corte Clássico'],
  ['Kids Haircut', 'Corte Infantil'],
  ['Beard Set & Trim', 'Acerto e Corte de Barba'],
  ['Beard Trim', 'Aparar Barba'],
  ['Hot Towel Classic Shave', 'Barbear Clássico com Toalha Quente'],
  ['Hot Towel', 'Toalha Quente'],
  ['Hair Color & Shampoo Wash', 'Tintura e Lavagem com Shampoo'],
  ['Hair Color', 'Coloração Capilar'],
  ['Shampoo Wash', 'Lavagem com Shampoo'],
  ['Gents Facial & Skin Care', 'Facial Masculino e Cuidados com a Pele'],
  ['Skin Care', 'Cuidados com a Pele'],
  ['Full Grooming Combo Pack', 'Pacote Combo Completo'],
  ['Full Grooming', 'Cuidados Completos'],
  ['Hair Straightening', 'Alisamento Capilar'],
  ['Hair Spa', 'Spa Capilar'],
  ['Head Massage', 'Massagem Capilar'],
  ['Face Massage', 'Massagem Facial'],
  ['Body Massage', 'Massagem Corporal'],
  ['Charcoal Facial', 'Facial com Carvão'],
  ['Gold Facial', 'Facial Dourado'],
  ['Hydra Facial', 'Hidra Facial'],
  ['Clean Shave', 'Barbear Limpo'],
  ['Line-Up', 'Alinhamento'],
  ['Wedding Package', 'Pacote Noivo'],
  ['Groom Makeover', 'Visual do Noivo'],
];

const SALON_EN_TO_PT_WORDS: Array<[string, string]> = [
  ['Special', 'Especial'],
  ['Premium', 'Premium'],
  ['Classic', 'Clássico'],
  ['Modern', 'Moderno'],
  ['Royal', 'Real'],
  ['Package', 'Pacote'],
  ['Combo', 'Combo'],
  ['Pack', 'Pacote'],
  ['Service', 'Serviço'],
  ['Styling', 'Estilização'],
  ['Style', 'Estilo'],
  ['Stylish', 'Estiloso'],
  ['Haircut', 'Corte de Cabelo'],
  ['Hair', 'Cabelo'],
  ['Cutting', 'Corte'],
  ['Cut', 'Corte'],
  ['Beard', 'Barba'],
  ['Mustache', 'Bigode'],
  ['Shaving', 'Barbear'],
  ['Shave', 'Barba'],
  ['Trim', 'Aparar'],
  ['Cleanup', 'Limpeza'],
  ['Clean', 'Limpo'],
  ['Care', 'Cuidado'],
  ['Skin', 'Pele'],
  ['Massage', 'Massagem'],
  ['Color', 'Cor'],
  ['Wash', 'Lavagem'],
  ['Towel', 'Toalha'],
  ['Hot', 'Quente'],
  ['Steam', 'Vapor'],
  ['Kids', 'Infantil'],
  ['Baby', 'Infantil'],
  ['Gents', 'Masculino'],
  ['Full', 'Completo'],
  ['Plus', 'Plus'],
  ['with', 'com'],
  ['and', 'e'],
];

export function translateSalonServiceText(
  text: string,
  targetLang: AppLanguage
): string {
  const clean = (text || '').trim();
  if (!clean) return '';

  if (targetLang === 'en') {
    if (!hasBengaliChars(clean)) return clean;
    let working = clean;
    for (const [bnPhrase, enPhrase] of SALON_PHRASE_TRANSLATIONS) {
      if (working.includes(bnPhrase)) {
        working = working.split(bnPhrase).join(` ${enPhrase} `);
      }
    }
    for (const [bnWord, enWord] of SALON_WORD_TRANSLATIONS) {
      if (working.includes(bnWord)) {
        working = working.split(bnWord).join(` ${enWord} `);
      }
    }
    const tokens = working.split(/\s+/).filter(Boolean);
    return tokens
      .map((token) => (hasBengaliChars(token) ? transliterateBnWordToEn(token) : token))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (targetLang === 'pt') {
    let working = hasBengaliChars(clean) ? translateSalonServiceText(clean, 'en') : clean;
    for (const [enPhrase, ptPhrase] of SALON_EN_TO_PT_PHRASES) {
      const escaped = enPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      working = working.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ptPhrase);
    }
    for (const [enWord, ptWord] of SALON_EN_TO_PT_WORDS) {
      const escaped = enWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      working = working.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ptWord);
    }
    return working.replace(/\s+/g, ' ').trim();
  }

  // targetLang === 'bn'
  if (!hasLatinChars(clean)) return clean;
  let working = clean;

  const sortedPhrases = [...SALON_PHRASE_TRANSLATIONS].sort(
    (a, b) => b[1].length - a[1].length
  );
  for (const [bnPhrase, enPhrase] of sortedPhrases) {
    const escaped = enPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    working = working.replace(regex, ` ${bnPhrase} `);
  }

  const sortedWords = [...SALON_WORD_TRANSLATIONS].sort(
    (a, b) => b[1].length - a[1].length
  );
  for (const [bnWord, enWord] of sortedWords) {
    const escaped = enWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    working = working.replace(regex, ` ${bnWord} `);
  }

  const tokens = working.split(/\s+/).filter(Boolean);
  return tokens
    .map((token) => (hasLatinChars(token) ? transliterateEnWordToBn(token) : token))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCustomSalonServiceTitle(
  key: SalonServiceKey,
  candidate?: string | null
): boolean {
  const entry = SALON_SERVICE_LOCALE[key];
  const clean = (candidate || '').trim();
  if (clean.length < 2) return false;
  return clean !== entry.enTitle && clean !== entry.bnTitle && clean !== entry.ptTitle;
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
    haircutTitleBn?: string;
    beardTrimTitleBn?: string;
    shaveTitleBn?: string;
    hairColorTitleBn?: string;
    facialTitleBn?: string;
    comboTitleBn?: string;
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
  const enFieldName = SALON_TITLE_FIELD_MAP[key];
  const bnFieldName = SALON_TITLE_BN_FIELD_MAP[key];
  const configTitleEn = (salonConfig?.[enFieldName] || '').trim();
  const configTitleBn = (salonConfig?.[bnFieldName] || '').trim();
  const bookedTitle = (bookingTitleFallback || '').trim();

  const hasCustomEn = isCustomSalonServiceTitle(key, configTitleEn);
  const hasCustomBn = isCustomSalonServiceTitle(key, configTitleBn);

  if (lang === 'bn') {
    const resolvedEn = hasCustomEn
      ? hasLatinChars(configTitleEn)
        ? configTitleEn
        : translateSalonServiceText(configTitleEn, 'en')
      : entry.enTitle;

    if (hasCustomBn) {
      const bnText = hasBengaliChars(configTitleBn)
        ? configTitleBn
        : translateSalonServiceText(configTitleBn, 'bn');
      return {
        primaryTitle: bnText,
        secondaryTitle: resolvedEn !== bnText ? resolvedEn : '',
        duration: entry.bnDuration,
        description: entry.bnDescription,
        isCustom: true,
      };
    }

    if (hasCustomEn) {
      const translatedBn = hasBengaliChars(configTitleEn) && !hasLatinChars(configTitleEn)
        ? configTitleEn
        : translateSalonServiceText(configTitleEn, 'bn');
      return {
        primaryTitle: translatedBn || configTitleEn,
        secondaryTitle: configTitleEn !== translatedBn ? configTitleEn : '',
        duration: entry.bnDuration,
        description: entry.bnDescription,
        isCustom: true,
      };
    }

    if (isCustomSalonServiceTitle(key, bookedTitle)) {
      const translatedBooked = hasBengaliChars(bookedTitle)
        ? bookedTitle
        : translateSalonServiceText(bookedTitle, 'bn');
      return {
        primaryTitle: translatedBooked || bookedTitle,
        secondaryTitle: '',
        duration: entry.bnDuration,
        description: entry.bnDescription,
        isCustom: true,
      };
    }

    return {
      primaryTitle: entry.bnTitle,
      secondaryTitle: entry.enTitle,
      duration: entry.bnDuration,
      description: entry.bnDescription,
      isCustom: false,
    };
  }

  if (lang === 'pt') {
    if (hasCustomEn) {
      const ptText = translateSalonServiceText(configTitleEn, 'pt');
      return {
        primaryTitle: ptText || configTitleEn,
        secondaryTitle: configTitleEn !== ptText ? configTitleEn : '',
        duration: entry.ptDuration,
        description: entry.ptDescription,
        isCustom: true,
      };
    }

    if (hasCustomBn) {
      const ptText = translateSalonServiceText(configTitleBn, 'pt');
      return {
        primaryTitle: ptText || configTitleBn,
        secondaryTitle: '',
        duration: entry.ptDuration,
        description: entry.ptDescription,
        isCustom: true,
      };
    }

    if (isCustomSalonServiceTitle(key, bookedTitle)) {
      const ptBooked = translateSalonServiceText(bookedTitle, 'pt');
      return {
        primaryTitle: ptBooked || bookedTitle,
        secondaryTitle: '',
        duration: entry.ptDuration,
        description: entry.ptDescription,
        isCustom: true,
      };
    }

    return {
      primaryTitle: entry.ptTitle,
      secondaryTitle: entry.enTitle,
      duration: entry.ptDuration,
      description: entry.ptDescription,
      isCustom: false,
    };
  }

  // lang === 'en'
  const resolvedBn = hasCustomBn
    ? hasBengaliChars(configTitleBn)
      ? configTitleBn
      : translateSalonServiceText(configTitleBn, 'bn')
    : entry.bnTitle;

  if (hasCustomEn) {
    const enText =
      !hasCustomBn && hasBengaliChars(configTitleEn) && !hasLatinChars(configTitleEn)
        ? translateSalonServiceText(configTitleEn, 'en')
        : hasBengaliChars(configTitleEn)
        ? translateSalonServiceText(configTitleEn, 'en')
        : configTitleEn;
    return {
      primaryTitle: enText || configTitleEn,
      secondaryTitle: resolvedBn !== enText ? resolvedBn : '',
      duration: entry.enDuration,
      description: entry.enDescription,
      isCustom: true,
    };
  }

  if (hasCustomBn) {
    const translatedEn = translateSalonServiceText(configTitleBn, 'en');
    return {
      primaryTitle: translatedEn || configTitleBn,
      secondaryTitle: configTitleBn !== translatedEn ? configTitleBn : '',
      duration: entry.enDuration,
      description: entry.enDescription,
      isCustom: true,
    };
  }

  if (isCustomSalonServiceTitle(key, bookedTitle)) {
    const translatedBooked = hasBengaliChars(bookedTitle)
      ? translateSalonServiceText(bookedTitle, 'en')
      : bookedTitle;
    return {
      primaryTitle: translatedBooked || bookedTitle,
      secondaryTitle: '',
      duration: entry.enDuration,
      description: entry.enDescription,
      isCustom: true,
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

export function extractTimestampMillis(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) return ts;
  if (ts instanceof Date && !Number.isNaN(ts.getTime())) return ts.getTime();
  if (typeof ts?.toMillis === 'function') {
    const ms = ts.toMillis();
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  }
  if (typeof ts?.toDate === 'function') {
    const d = ts.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
  }
  if (typeof ts?.seconds === 'number' && Number.isFinite(ts.seconds)) {
    return ts.seconds * 1000;
  }
  return null;
}

export function formatBookingCreatedTimestamp(
  createdAt: any,
  lang: AppLanguage
): { dateTimeLabel: string; timeLabel: string } | null {
  const ms = extractTimestampMillis(createdAt);
  if (!ms) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const locale = lang === 'bn' ? 'bn-BD' : lang === 'pt' ? 'pt-BR' : 'en-US';
  const timeLabel = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: lang !== 'pt',
  });
  const dateLabel = date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return {
    dateTimeLabel: `${dateLabel}, ${timeLabel}`,
    timeLabel,
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
  if (lang === 'pt') {
    if (s === 'confirmed') return 'Confirmado';
    if (s === 'completed') return 'Concluído';
    if (s === 'cancelled') return 'Cancelado';
    return 'Pendente';
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
  if (lang === 'pt') {
    if (s === 'approved') return 'Aprovado';
    if (s === 'rejected') return 'Rejeitado';
    return 'Pendente';
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
  const locale = lang === 'bn' ? 'bn-BD' : lang === 'pt' ? 'pt-BR' : 'en-US';
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
  const locale = lang === 'bn' ? 'bn-BD' : lang === 'pt' ? 'pt-BR' : 'en-US';
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
  if (isAdmin) {
    return lang === 'bn'
      ? 'অ্যাডমিন আনলিমিটেড'
      : lang === 'pt'
      ? 'Admin Ilimitado'
      : 'Admin Unlimited';
  }
  if (plan === 'pro') {
    if (packageType === 'yearly') {
      return lang === 'bn' ? 'ইয়ারলি প্রো' : lang === 'pt' ? 'Pro Anual' : 'Yearly Pro';
    }
    return lang === 'bn' ? 'মান্থলি প্রো' : lang === 'pt' ? 'Pro Mensal' : 'Monthly Pro';
  }
  return lang === 'bn' ? 'ফ্রি' : lang === 'pt' ? 'Gratuito' : 'Free';
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
