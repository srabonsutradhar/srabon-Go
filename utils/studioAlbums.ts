/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import heroVoiceStudioImg from '../src/assets/images/hero_voice_studio_1795344171901.jpg';
import salonGroomingAtelierImg from '../src/assets/images/salon_grooming_atelier_1795344171933.jpg';
import albumWarmStorytellerImg from '../src/assets/images/album_warm_storyteller_1795344171987.jpg';
import albumBrightMelodicImg from '../src/assets/images/album_bright_melodic_1795344171531.jpg';
import albumCalmNocturneImg from '../src/assets/images/album_calm_nocturne_1795344171448.jpg';
import { Voice } from '../types';

export const STUDIO_MEDIA = {
  heroStudio: heroVoiceStudioImg,
  salonInterior: salonGroomingAtelierImg,
  warmStorytellerAlbum: albumWarmStorytellerImg,
  brightMelodicAlbum: albumBrightMelodicImg,
  calmNocturneAlbum: albumCalmNocturneImg,
} as const;

export interface VoiceAlbumEdition {
  id: 'warm-storyteller' | 'bright-melodic' | 'calm-nocturne';
  titleBn: string;
  titleEn: string;
  subtitleBn: string;
  coverImg: string;
  featuredVoiceNames: string[];
  accentTextClass: string;
  surfaceTintClass: string;
  borderHoverClass: string;
  buttonBgClass: string;
}

export const FEATURED_VOICE_ALBUMS: VoiceAlbumEdition[] = [
  {
    id: 'warm-storyteller',
    titleBn: 'গোল্ডেন স্টোরিটেলার অ্যালবাম',
    titleEn: 'Golden Storyteller Edition',
    subtitleBn: 'গল্প বলা, ডকুমেন্টারি ও গভীর ভয়েসওভারের জন্য উষ্ণ ও সমৃদ্ধ কণ্ঠস্বর।',
    coverImg: albumWarmStorytellerImg,
    featuredVoiceNames: ['Charon', 'Fenrir', 'Orus'],
    accentTextClass: 'text-amber-700 dark:text-amber-300',
    surfaceTintClass:
      'bg-gradient-to-br from-amber-50/90 via-white to-orange-50/60 dark:from-[#1b150e] dark:via-[#111525] dark:to-[#17120c]',
    borderHoverClass:
      'border-amber-200/90 dark:border-amber-800/60 hover:border-amber-400 dark:hover:border-amber-500',
    buttonBgClass:
      'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-600/20',
  },
  {
    id: 'bright-melodic',
    titleBn: 'ব্রাইট মর্নিং ও মেলোডিক অ্যালবাম',
    titleEn: 'Emerald Morning Brights',
    subtitleBn: 'সকালের অ্যালার্ম, পড়াশোনার রিমাইন্ডার ও প্রাণবন্ত রিলসের জন্য স্পষ্ট উজ্জ্বল কণ্ঠ।',
    coverImg: albumBrightMelodicImg,
    featuredVoiceNames: ['Zephyr', 'Kore', 'Leda', 'Puck'],
    accentTextClass: 'text-teal-700 dark:text-teal-300',
    surfaceTintClass:
      'bg-gradient-to-br from-teal-50/90 via-white to-sky-50/60 dark:from-[#0c1b20] dark:via-[#0f172a] dark:to-[#0c1a24]',
    borderHoverClass:
      'border-teal-200/90 dark:border-teal-800/60 hover:border-teal-400 dark:hover:border-teal-500',
    buttonBgClass:
      'bg-teal-600 hover:bg-teal-500 text-white shadow-sm shadow-teal-600/20',
  },
  {
    id: 'calm-nocturne',
    titleBn: 'মিডনাইট কাম ও ফোকাস অ্যালবাম',
    titleEn: 'Midnight Calm & Focus',
    subtitleBn: 'শান্ত বর্ণনা, টিউটোরিয়াল ও রাতের নিরিবিলি অধ্যয়নের জন্য কোমল সুরেলা কণ্ঠ।',
    coverImg: albumCalmNocturneImg,
    featuredVoiceNames: ['Aoede', 'Callirrhoe'],
    accentTextClass: 'text-indigo-700 dark:text-indigo-300',
    surfaceTintClass:
      'bg-gradient-to-br from-indigo-50/90 via-white to-rose-50/50 dark:from-[#12142b] dark:via-[#0f1526] dark:to-[#1e1222]',
    borderHoverClass:
      'border-indigo-200/90 dark:border-indigo-800/60 hover:border-indigo-400 dark:hover:border-indigo-500',
    buttonBgClass:
      'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20',
  },
];

export interface VoiceVisualTheme {
  coverImg: string;
  albumLabel: string;
  cardBorderActiveClass: string;
  fallbackGradientClass: string;
  studioButtonClass: string;
  visualizerColorLight: string;
  visualizerColorDark: string;
}

export function getVoiceAlbumVisual(voice: Voice): VoiceVisualTheme {
  const pitchLower = `${voice.pitch} ${voice.analysis.pitch}`.toLowerCase();
  const traitsLower = [
    ...voice.characteristics,
    ...voice.analysis.characteristics,
  ]
    .join(' ')
    .toLowerCase();

  if (
    pitchLower.includes('high') ||
    traitsLower.includes('bright') ||
    traitsLower.includes('youthful') ||
    traitsLower.includes('upbeat') ||
    traitsLower.includes('energetic')
  ) {
    return {
      coverImg: albumBrightMelodicImg,
      albumLabel: 'Emerald Brights',
      cardBorderActiveClass:
        'border-teal-300 dark:border-teal-600 ring-2 ring-teal-200/70 dark:ring-teal-900/50',
      fallbackGradientClass: 'from-teal-700 via-cyan-700 to-blue-800',
      studioButtonClass:
        'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 dark:hover:text-white',
      visualizerColorLight: '#ffffff',
      visualizerColorDark: '#5eead4',
    };
  }

  if (
    pitchLower.includes('low') ||
    traitsLower.includes('deep') ||
    traitsLower.includes('warm') ||
    traitsLower.includes('firm') ||
    traitsLower.includes('resonant')
  ) {
    return {
      coverImg: albumWarmStorytellerImg,
      albumLabel: 'Golden Storyteller',
      cardBorderActiveClass:
        'border-amber-300 dark:border-amber-600 ring-2 ring-amber-200/70 dark:ring-amber-900/50',
      fallbackGradientClass: 'from-amber-700 via-orange-700 to-stone-900',
      studioButtonClass:
        'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-600 hover:text-white dark:hover:bg-amber-600 dark:hover:text-white',
      visualizerColorLight: '#fde68a',
      visualizerColorDark: '#fbbf24',
    };
  }

  return {
    coverImg: albumCalmNocturneImg,
    albumLabel: 'Midnight Nocturne',
    cardBorderActiveClass:
      'border-indigo-300 dark:border-indigo-500 ring-2 ring-indigo-200/70 dark:ring-indigo-900/50',
    fallbackGradientClass: 'from-indigo-800 via-blue-900 to-rose-900',
    studioButtonClass:
      'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white',
    visualizerColorLight: '#e0e7ff',
    visualizerColorDark: '#a5b4fc',
  };
}
