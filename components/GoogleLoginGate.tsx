/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  Play,
  Pause,
  ChevronDown,
  Gift,
  AudioLines,
  Sparkles,
  Check,
  ShieldCheck,
  MoreVertical,
  X,
} from 'lucide-react';
import { auth, signInWithGoogle } from '../firebase';
import { reportAppIssue, isBenignAudioInterrupt } from '../utils/appIssues';
import { VOICE_DATA } from '../constants';
import AudioVisualizer from './AudioVisualizer';
import AdBanner from './AdBanner';
import SiteLegalModal, { LegalTab } from './SiteLegalModal';
import { FEATURED_VOICE_ALBUMS, STUDIO_MEDIA, getVoiceAlbumVisual } from '../utils/studioAlbums';
import { localizeGender, localizePitch, localizeTrait, useLanguage } from '../utils/i18n';
import PWAInstallButton, { isOnSalonAppEntry } from './PWAInstallButton';
import SiteReviewsSection from './SiteReviewsSection';
import SocialLinksRow from './SocialLinksRow';
import { SocialLinksConfig } from '../types';
import { DEFAULT_SOCIAL_LINKS } from '../utils/socialLinks';

interface GoogleLoginGateProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  socialLinks?: SocialLinksConfig;
}

const FEATURED_VOICE_NAMES = ['Kore', 'Zephyr', 'Fenrir', 'Aoede', 'Puck', 'Charon'];

const FAQ_ITEMS_BN = [
  {
    q: 'কোন কোন ভাষায় ভয়েস ও অডিও তৈরি করা যাবে?',
    a: 'শ্রাবণ গো বাংলা, ইংরেজি এবং বিশ্বের বিভিন্ন ভাষার স্ক্রিপ্ট প্রাকৃতিক উচ্চারণ ও নির্দিষ্ট টোন (যেমন: সকালের অ্যালার্ম, নিউজ রিডিং বা গল্প বলার ভঙ্গি) অনুযায়ী ভয়েসওভার তৈরি করতে পারে।',
  },
  {
    q: 'বন্ধুদের রেফার করে কীভাবে +১০টি ফ্রি ক্রেডিট পাবেন?',
    a: 'লগইন করার পর উপরের "Refer +10" বাটন থেকে আপনার নিজস্ব রেফার কোড বা লিংক শেয়ার করুন। প্রতিটি নতুন বন্ধু আপনার লিংকে ঢুকে গুগল সাইন-ইন করলে আপনি স্বয়ংক্রিয়ভাবে +১০টি বোনাস ক্রেডিট পাবেন।',
  },
  {
    q: 'দৈনিক ফ্রি কোটা শেষ হলে কী হবে?',
    a: 'প্রতিদিনের ফ্রি সীমা শেষ হয়ে গেলে আপনার জমা থাকা বোনাস রেফার ক্রেডিট থেকে ১টি করে ক্রেডিট স্বয়ংক্রিয়ভাবে ব্যবহার হবে। পাশাপাশি চাইলে যেকোনো সময় প্রো প্ল্যান আনলক করে আনলিমিটেড ব্যবহার করতে পারবেন।',
  },
  {
    q: 'তৈরি করা অডিও কি WAV ফরম্যাটে ডাউনলোড করা যায়?',
    a: 'হ্যাঁ, ভয়েস স্টুডিও ও এআই কাস্টিং রেজাল্ট থেকে প্রতিটি জেনারেটেড অডিও সরাসরি ২৪ kHz ক্রিস্টাল-ক্লিয়ার WAV ফরম্যাটে ডাউনলোড এবং অ্যালার্ম লুপ মোডে শোনা যায়।',
  },
];

const FAQ_ITEMS_EN = [
  {
    q: 'Which languages are supported for speech generation?',
    a: 'Srabon Go creates expressive voiceovers in Bengali, English, and global languages with custom vocal direction such as morning alarm, news anchor, or storytelling narration.',
  },
  {
    q: 'How do I earn +10 free bonus credits per friend referral?',
    a: 'After signing in, open the Refer Friends option from the menu to copy your personal referral code or link. Whenever a new friend joins with Google using your link, you automatically receive +10 bonus credits.',
  },
  {
    q: 'What happens when my daily free quota runs out?',
    a: 'Once your daily free generations are used up, your saved referral bonus credits automatically activate one per generation. You can also upgrade to Monthly or Yearly Pro anytime.',
  },
  {
    q: 'Can I download generated voices as WAV audio files?',
    a: 'Yes! Every speech generation in Voice Studio, Personal Voice Clone, and AI Casting Preview can be exported directly as a crisp 24 kHz WAV file or played in Alarm Loop mode.',
  },
];

const FAQ_ITEMS_PT = [
  {
    q: 'Quais idiomas são suportados para geração de voz?',
    a: 'O Srabon Go cria narrações naturais em bengali, inglês, português e outros idiomas globais com direcionamento vocal personalizado, como alarme matinal, âncora de notícias ou narração de histórias.',
  },
  {
    q: 'Como ganho +10 créditos bônus por cada amigo indicado?',
    a: 'Após fazer login, abra a opção Indicar Amigos no menu para copiar seu código ou link pessoal. Sempre que um novo amigo entrar com o Google pelo seu link, você recebe +10 créditos bônus automaticamente.',
  },
  {
    q: 'O que acontece quando minha cota diária gratuita acaba?',
    a: 'Quando o limite diário gratuito é atingido, seus créditos bônus de indicação são ativados automaticamente (1 por geração). Você também pode assinar o plano Pro Mensal ou Anual a qualquer momento.',
  },
  {
    q: 'Posso baixar as vozes geradas em formato WAV?',
    a: 'Sim! Cada áudio gerado no Estúdio de Voz, Clone de Voz Pessoal e Casting IA pode ser exportado diretamente em arquivo WAV nítido de 24 kHz ou reproduzido no modo Loop de Alarme.',
  },
];

const GoogleLoginGate: React.FC<GoogleLoginGateProps> = ({
  isDarkMode,
  toggleTheme,
  socialLinks = DEFAULT_SOCIAL_LINKS,
}) => {
  const { lang, setLang, bi } = useLanguage();
  const isSalonEntry =
    isOnSalonAppEntry() ||
    (typeof window !== 'undefined' &&
      (new URLSearchParams(window.location.search).get('app') === 'salon' ||
        new URLSearchParams(window.location.search).get('page') === 'salon' ||
        window.location.hash === '#salon'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const signingInRef = useRef(false);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showHeaderMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHeaderMenu(false);
    };
    const onOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [showHeaderMenu]);

  const featuredVoices = FEATURED_VOICE_NAMES.map((name) =>
    VOICE_DATA.find((v) => v.name === name)
  ).filter((v): v is (typeof VOICE_DATA)[number] => Boolean(v));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;
    audio.pause();
    audio.currentTime = 0;

    if (playingVoice) {
      const target = VOICE_DATA.find((v) => v.name === playingVoice);
      if (target) {
        audio.src = target.audioSampleUrl;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (cancelled || isBenignAudioInterrupt(err)) {
              return;
            }
            console.warn('Sample playback unavailable:', err);
            setPlayingVoice((curr) => (curr === playingVoice ? null : curr));
          });
        }
      }
    }

    return () => {
      cancelled = true;
      audio.pause();
    };
  }, [playingVoice]);

  const handleToggleSample = (voiceName: string) => {
    setPlayingVoice((curr) => (curr === voiceName ? null : voiceName));
  };

  const handleGoogleSignIn = async () => {
    if (loading || signingInRef.current) return;
    signingInRef.current = true;
    setLoading(true);
    setError(null);

    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (auth.currentUser) {
        return;
      }
      const code = err?.code || '';
      const rawMessage = typeof err?.message === 'string' ? err.message : '';
      if (code === 'auth/popup-closed-by-user') {
        setError(bi(
          'লগইন পপআপ বন্ধ করা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
          'Sign-in popup was closed. Please try again.'
        ));
      } else if (code === 'auth/cancelled-popup-request' || rawMessage.includes('Pending promise was never set')) {
        setError(bi(
          'লগইন প্রক্রিয়াটি সম্পূর্ণ হয়নি। অনুগ্রহ করে আবার "গুগল দিয়ে চালিয়ে যান" বাটনে ক্লিক করুন।',
          'Sign-in was interrupted. Please click "Continue with Google" again.'
        ));
      } else if (code === 'auth/popup-blocked') {
        setError(bi(
          'ব্রাউজারে পপআপ ব্লক করা আছে। অনুগ্রহ করে পপআপ অনুমতি দিন।',
          'Popup was blocked by your browser. Please allow popups to sign in.'
        ));
      } else if (
        code === 'auth/web-storage-unsupported' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        setError(bi(
          'এই ব্রাউজারে তৃতীয়-পক্ষ কুকি/স্টোরেজ বন্ধ আছে। অনুগ্রহ করে Chrome বা Safari-তে সরাসরি ওপেন করে আবার চেষ্টা করুন।',
          'Third-party cookies/storage are disabled. Please open directly in Chrome or Safari and try again.'
        ));
      } else if (code === 'auth/network-request-failed') {
        setError(bi(
          'ইন্টারনেট সংযোগ দুর্বল থাকায় লগইন সম্পন্ন হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
          'Network error during sign-in. Please check your connection and try again.'
        ));
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        reportAppIssue({
          source: 'GoogleSignIn',
          severity: 'error',
          message: `Unauthorized domain for Firebase Auth: ${host}`,
          details: 'Add this hostname in Firebase Console > Authentication > Settings > Authorized domains.',
        });
        setError(bi(
          'লগইন সম্পন্ন করা যায়নি। অনুগ্রহ করে পরে আবার চেষ্টা করুন।',
          'Could not complete sign-in right now. Please try again later.'
        ));
      } else {
        reportAppIssue({
          source: 'GoogleSignIn',
          severity: 'error',
          message: rawMessage || 'Google sign-in failed',
          details: code ? `Firebase Auth code: ${code}` : undefined,
        });
        setError(bi(
          'লগইন সম্পন্ন করা যায়নি। অনুগ্রহ করে পরে আবার চেষ্টা করুন।',
          'Could not complete sign-in right now. Please try again later.'
        ));
      }
    } finally {
      signingInRef.current = false;
      setLoading(false);
    }
  };

  const faqItems =
    lang === 'bn' ? FAQ_ITEMS_BN : lang === 'pt' ? FAQ_ITEMS_PT : FAQ_ITEMS_EN;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f4f6fb] via-[#f8fafc] to-[#eef2ff] dark:from-[#070b14] dark:via-[#0b1120] dark:to-[#11152b] text-slate-900 dark:text-slate-100 font-sans relative transition-colors duration-300">
      <audio
        ref={audioRef}
        onEnded={() => setPlayingVoice(null)}
        preload="none"
      />

      {/* Top Navigation Bar (Clean 3-Zone Contract) */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-[#0b1120]/90 backdrop-blur-xl border-b border-indigo-100/80 dark:border-indigo-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-700 via-blue-700 to-amber-600 dark:from-indigo-300 dark:via-sky-300 dark:to-amber-300 bg-clip-text text-transparent whitespace-nowrap shrink-0"
          >
            {isSalonEntry
              ? bi('জগন্নাথ সেলুন · শ্রাবণ গো', 'Jagannath Salon · Srabon Go')
              : bi('শ্রাবণ গো', 'Srabon Go')}
          </a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            aria-label={bi('প্রধান নেভিগেশন', 'Primary')}
            className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-medium text-zinc-600 dark:text-zinc-400"
          >
            <a
              href="#features"
              className="hover:text-zinc-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {bi('সুবিধাসমূহ', 'Features')}
            </a>
            <a
              href="#voices"
              className="hover:text-zinc-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {bi('ভয়েস লাইব্রেরি', 'Voice Library')}
            </a>
            <a
              href="#pricing"
              className="hover:text-zinc-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {bi('প্ল্যান ও রেফার', 'Plans & Refer')}
            </a>
            <a
              href="#site-reviews-section"
              className="hover:text-zinc-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {bi('রিভিউ', 'Reviews', 'Avaliações')}
            </a>
            <a
              href="#faq"
              className="hover:text-zinc-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {bi('প্রশ্নোত্তর', 'FAQ')}
            </a>
          </nav>

          {/* Zone 3: Language Switch + Primary Action + Clean 3-Dot Menu */}
          <div ref={headerMenuRef} className="relative flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label={bi('ভাষা পরিবর্তন করুন', 'Switch language')}
              className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0"
            >
              <button
                type="button"
                onClick={() => setLang('bn')}
                aria-pressed={lang === 'bn'}
                aria-label="বাংলা ভাষা নির্বাচন করুন"
                className={`min-h-[36px] px-2.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  lang === 'bn'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
                aria-label="Switch language to English"
                className={`min-h-[36px] px-2.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  lang === 'en'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('pt')}
                aria-pressed={lang === 'pt'}
                aria-label="Mudar idioma para Português"
                className={`min-h-[36px] px-2.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  lang === 'pt'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                PT
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-indigo-500/20 transition-all whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{bi('সাইন ইন', 'Sign In')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHeaderMenu((prev) => !prev)}
              aria-expanded={showHeaderMenu}
              aria-haspopup="menu"
              aria-label={bi('অন্যান্য অপশন', 'More options')}
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              {showHeaderMenu ? <X size={18} /> : <MoreVertical size={18} />}
            </button>

            {showHeaderMenu && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] w-60 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-2 space-y-1 z-50"
              >
                <div className="md:hidden space-y-1">
                  <a
                    href="#features"
                    onClick={() => setShowHeaderMenu(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {bi('সুবিধাসমূহ', 'Features')}
                  </a>
                  <a
                    href="#voices"
                    onClick={() => setShowHeaderMenu(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {bi('ভয়েস লাইব্রেরি', 'Voice Library')}
                  </a>
                  <a
                    href="#pricing"
                    onClick={() => setShowHeaderMenu(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {bi('প্ল্যান ও রেফার', 'Plans & Refer')}
                  </a>
                  <a
                    href="#site-reviews-section"
                    onClick={() => setShowHeaderMenu(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {bi('রিভিউ', 'Reviews', 'Avaliações')}
                  </a>
                  <a
                    href="#faq"
                    onClick={() => setShowHeaderMenu(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {bi('প্রশ্নোত্তর', 'FAQ')}
                  </a>
                  <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    toggleTheme();
                    setShowHeaderMenu(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                >
                  {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
                  <span>{isDarkMode ? bi('লাইট মোড', 'Light Mode') : bi('ডার্ক মোড', 'Dark Mode')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowHeaderMenu(false);
                    handleGoogleSignIn();
                  }}
                  disabled={loading}
                  className="sm:hidden w-full px-3 py-2.5 rounded-xl bg-zinc-900 dark:bg-indigo-600 text-white text-sm font-semibold text-center"
                >
                  {loading
                    ? bi('সাইন ইন হচ্ছে...', 'Signing in...')
                    : bi('গুগল দিয়ে সাইন ইন', 'Sign In with Google')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Left: Proposition & Google Sign-In CTA */}
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {isSalonEntry ? (
                  <>
                    <span>{bi('জগন্নাথ মেনজ সেলুন', "Jagannath Men's Salon")}</span>
                    <span aria-hidden="true">·</span>
                    <span>{bi('লাইভ সিরিয়াল ও কিউ', 'Live Serial & Queue')}</span>
                    <span aria-hidden="true">·</span>
                    <span>{bi('সরাসরি বুকিং', 'Direct Booking')}</span>
                  </>
                ) : (
                  <>
                    <span>{bi('এআই ভয়েস স্টুডিও', 'AI Voice Studio')}</span>
                    <span aria-hidden="true">·</span>
                    <span>{bi('৩০টি স্টুডিও ভয়েস', '30 Studio Voices')}</span>
                    <span aria-hidden="true">·</span>
                    <span>{bi('বাংলা ও বিশ্বমানের TTS', 'Bengali & Global TTS')}</span>
                  </>
                )}
              </div>

              <h1
                className="text-4xl sm:text-5xl lg:text-[52px] font-serif font-medium tracking-tight text-zinc-900 dark:text-white leading-[1.12]"
                style={{ textWrap: 'balance' }}
              >
                {isSalonEntry
                  ? bi(
                      'সেলুন বুকিং ও লাইভ সিরিয়াল অ্যাপে স্বাগতম।',
                      'Welcome to the Salon Booking & Live Serial App.'
                    )
                  : bi(
                      'প্রাকৃতিক বাংলা ও ইংরেজি কণ্ঠে যেকোনো লেখা শোনান।',
                      'Speak any script in natural Bengali and global voices.'
                    )}
              </h1>

              <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl">
                {isSalonEntry
                  ? bi(
                      'গুগল দিয়ে সাইন-ইন করলেই সরাসরি সেলুন বুকিং, লাইভ সিরিয়াল নাম্বার, ৫ মিনিট আগের নোটিফিকেশন এবং ডিজিটাল কমপ্লিট সিগনেচার পেজে চলে যাবেন।',
                      'Sign in with Google to jump straight into Jagannath Salon booking, live serial queue tracking, 5-minute turn alerts, and digital completion signatures.'
                    )
                  : bi(
                      'প্রাকৃতিক কণ্ঠে বাংলা ও ইংরেজি ভয়েসওভার তৈরি করুন, পছন্দের ভয়েস কাস্টিং করুন এবং ক্রিস্টাল-ক্লিয়ার WAV অডিও ডাউনলোড করুন। বন্ধুদের রেফার করে প্রতিদিন ফ্রি কোটার সাথে প্রতি রেফারে +১০ ক্রেডিট জিতুন।',
                      'Generate lifelike Bengali and global voiceovers, cast the right voice with AI, and export crystal-clear WAV audio. Earn +10 bonus credits for every friend referral on top of your daily free quota.'
                    )}
              </p>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-300 text-xs max-w-md"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 hover:from-indigo-500 hover:via-blue-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.99] whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC04"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                  )}
                  <span>
                    {loading
                      ? bi('গুগল দিয়ে সাইন ইন হচ্ছে...', 'Signing in with Google...')
                      : bi('গুগল দিয়ে চালিয়ে যান', 'Continue with Google')}
                  </span>
                </button>

                <a
                  href="#voices"
                  className="inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-300 font-semibold text-sm hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap shrink-0"
                >
                  <AudioLines size={16} />
                  <span>{bi('ভয়েস স্যাম্পল শুনুন', 'Listen to Voice Samples')}</span>
                </a>

                <PWAInstallButton variant="hero" appTarget={isSalonEntry ? 'salon' : 'studio'} />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  {bi(
                    'গুগল সাইন-ইনে সুরক্ষিত · দৈনিক ফ্রি কোটা · তাৎক্ষণিক রেফারেল পুরস্কার',
                    'Secured by Google Sign-In · Daily free quota included · Instant referral rewards'
                  )}
                </span>
              </div>
            </div>

            {/* Right: Interactive Live Voice Preview Console with Studio Art */}
            <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 border border-indigo-100 dark:border-indigo-900/60 overflow-hidden shadow-md">
              <div className="relative h-40 w-full overflow-hidden bg-slate-900">
                <img
                  src={STUDIO_MEDIA.heroStudio}
                  alt={bi('শ্রাবণ গো এআই ভয়েস স্টুডিও কনসোল', 'Srabon Go AI Voice Studio Console')}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
                <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between gap-4 text-white">
                  <div>
                    <h2 className="text-base font-semibold">
                      {bi('লাইভ স্টুডিও ভয়েস প্রিভিউ', 'Live Studio Voice Preview')}
                    </h2>
                    <p className="text-xs text-amber-200/90">
                      {bi(
                        'সাইন-ইন করার আগেই নিচের যেকোনো কণ্ঠ শুনে দেখুন',
                        'Click any voice below to audition sample audio before signing in'
                      )}
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-indigo-200">
                    {VOICE_DATA.length} {bi('টি ভয়েস', 'voices')}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Waveform Box */}
                <div className="h-24 rounded-xl bg-gradient-to-r from-indigo-950 via-slate-900 to-teal-950 border border-indigo-800/50 overflow-hidden relative flex items-center justify-center">
                  {playingVoice ? (
                    <AudioVisualizer
                      isPlaying={true}
                      color="#fbbf24"
                    />
                  ) : (
                    <p className="text-xs text-indigo-200/80">
                      {bi(
                        'ওয়েভফর্ম দেখতে নিচের যেকোনো ভয়েস স্যাম্পল নির্বাচন করুন',
                        'Select a voice sample below to visualize playback'
                      )}
                    </p>
                  )}
                </div>

              {/* 4 Playable Voice Rows */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {featuredVoices.slice(0, 4).map((voice) => {
                  const active = playingVoice === voice.name;
                  return (
                    <div
                      key={voice.name}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                            {voice.name}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {localizeGender(voice.analysis.gender, lang)} · {localizePitch(voice.pitch, lang)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {voice.analysis.characteristics.map((c) => localizeTrait(c, lang)).join(', ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSample(voice.name)}
                        aria-label={active ? `${bi('থামান', 'Pause')} ${voice.name}` : `${bi('শুনুন', 'Play')} ${voice.name}`}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {active ? <Pause size={13} /> : <Play size={13} />}
                        <span>{active ? bi('থামান', 'Stop') : bi('শুনুন', 'Preview')}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          </div>

          {/* 4-Column Key Platform Metrics Strip */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-b border-zinc-200 dark:border-zinc-800 py-6">
            <div>
              <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                {bi('৩০', '30')}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {bi('বিভিন্ন পিচের স্টুডিও ভয়েস', 'Studio Voices Across Pitches')}
              </p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                24 kHz
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {bi('সরাসরি WAV অডিও এক্সপোর্ট', 'Direct WAV Audio Export')}
              </p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                {bi('+১০ ক্রেডিট', '+10 Cr')}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {bi('প্রতি বন্ধু রেফারে বোনাস ক্রেডিট', 'Bonus Credits per Friend Referral')}
              </p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                {bi('বহুভাষিক', 'Multi-Lang')}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {bi('বাংলা, ইংরেজি ও বৈশ্বিক স্ক্রিপ্ট', 'Bengali, English & Global Scripts')}
              </p>
            </div>
          </div>
        </section>

        {/* Capabilities Bento Section */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="max-w-2xl mb-10 space-y-2">
            <h2
              className="text-2xl sm:text-4xl font-serif font-medium text-zinc-900 dark:text-white"
              style={{ textWrap: 'balance' }}
            >
              {bi(
                'ভয়েস সিন্থেসিস, কাস্টিং এবং শেয়ারিংয়ের জন্য প্রয়োজনীয় সবকিছু।',
                'Everything needed for voice synthesis, casting, and sharing.'
              )}
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
              {bi(
                'নির্মাতা, শিক্ষক এবং দৈনন্দিন অধ্যয়নের রুটিনের জন্য ক্লাউড-সিঙ্ক সুবিধাসহ তৈরি।',
                'Built for creators, educators, and daily study routines with synchronized cloud preferences.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <article className="md:col-span-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <AudioLines size={15} />
                  <span>{bi('০১. বহুভাষিক টেক্সট-টু-স্পিচ স্টুডিও', '01. Multilingual Text-to-Speech Studio')}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-serif font-medium text-zinc-900 dark:text-white">
                  {bi('কাস্টম ভোকাল ডিরেকশন ও অ্যালার্ম লুপ', 'Custom Vocal Direction & Alarm Loop')}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl">
                  {bi(
                    'বাংলা, ইংরেজি বা যেকোনো ভাষায় স্ক্রিপ্ট লিখুন, পছন্দের ভঙ্গি (যেমন: সকালের অ্যালার্ম, স্নেহময় মেন্টর বা শান্ত বর্ণনাকারী) যুক্ত করুন, লাইভ ওয়েভফর্ম দেখুন এবং তৈরি WAV ফাইল ডাউনলোড করুন।',
                    'Write scripts in Bengali, English, or any language, pair them with delivery tone instructions (e.g., energetic morning wake-up, warm mentor, or calm narrator), preview waveforms in real time, and download ready-to-use WAV files.'
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <span>{bi('দ্রুত বাংলা ও ইংরেজি প্রিসেট', 'Quick Bengali & English presets')}</span>
                <span aria-hidden="true">·</span>
                <span>{bi('টানা অ্যালার্ম লুপ প্লেব্যাক', 'Continuous Alarm Loop playback')}</span>
                <span aria-hidden="true">·</span>
                <span>{bi('তাৎক্ষণিক WAV এক্সপোর্ট', 'Zero-latency WAV export')}</span>
              </div>
            </article>

            <article className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Sparkles size={15} />
                  <span>{bi('০২. এআই কাস্টিং ডিরেক্টর', '02. AI Casting Director')}</span>
                </div>
                <h3 className="text-xl font-serif font-medium text-zinc-900 dark:text-white">
                  {bi('তাৎক্ষণিক চরিত্র অনুযায়ী কণ্ঠ নির্বাচন', 'Instant Character Matching')}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {bi(
                    'বক্তার ধরন বা সংলাপ লিখলেই এআই সেরা ৩টি ভয়েস বেছে নেয় এবং নমুনা অডিওসহ পূর্ণ ডিরেক্টর সিস্টেম প্রম্পট তৈরি করে দেয়।',
                    'Describe the speaker persona or paste dialogue—AI selects the best 3 voices and writes a full Director System Prompt with sample playback.'
                  )}
                </p>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                {bi('3D ক্যারোসেল, ফিল্টার গ্রিড ও ক্লাউড ফেভারিটস', '3D Carousel, Filter Grid & Cloud Favorites')}
              </p>
            </article>

            <article className="md:col-span-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Gift size={15} />
                  <span>{bi('০৩. রেফার ও আয় প্রোগ্রাম', '03. Refer & Earn Program')}</span>
                </div>
                <h3 className="text-xl font-serif font-medium text-zinc-900 dark:text-white">
                  {bi(
                    'বন্ধুদের আমন্ত্রণ জানান এবং প্রতি সাইন-ইনে +১০ বোনাস ক্রেডিট পান',
                    'Invite friends and get +10 bonus credits per sign-in'
                  )}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {bi(
                    'প্রতিটি সদস্য নিজের আলাদা রেফারেল কোড ও শেয়ারযোগ্য লিংক পান। আপনার লিংকে কেউ গুগল দিয়ে যোগ দিলে স্বয়ংক্রিয়ভাবে ১০টি বোনাস ক্রেডিট যুক্ত হয় এবং দৈনিক সীমা শেষে ব্যবহৃত হয়।',
                    'Every member gets a personal referral code and shareable link. When a friend joins with Google using your link, 10 bonus credits are credited automatically and activate whenever your daily free limit is reached.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="px-5 py-3 rounded-xl bg-zinc-900 dark:bg-indigo-600 text-white text-xs sm:text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0"
              >
                {bi('আপনার রেফারেল লিংক নিন', 'Get Your Referral Link')}
              </button>
            </article>
          </div>
        </section>

        {/* Voice Library & Premium Albums Preview Grid */}
        <section id="voices" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-indigo-100 dark:border-slate-800/80 space-y-12">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-amber-400">
                  {bi('বাছাইকৃত ভয়েস অ্যালবাম', 'Curated Voice Albums')}
                </p>
                <h2 className="text-2xl sm:text-4xl font-serif font-medium text-slate-900 dark:text-white">
                  {bi('প্রিমিয়াম ভয়েস অ্যালবাম ও স্যাম্পল', 'Premium Voice Albums & Samples')}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {bi(
                    `অ্যালবাম আর্টসহ ৬টি জনপ্রিয় কণ্ঠস্বর এখান থেকেই শুনুন—সাইন-ইন করে আনলক করুন সব ${VOICE_DATA.length}টি ভয়েস।`,
                    `Preview 6 popular voices with studio artwork right here—sign in to unlock all ${VOICE_DATA.length} voices.`
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="text-sm font-semibold text-indigo-600 dark:text-amber-300 hover:underline underline-offset-4 whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                {bi('সম্পূর্ণ লাইব্রেরি খুলুন →', 'Open Full Library →')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {FEATURED_VOICE_ALBUMS.map((album) => {
                const leadVoice = album.featuredVoiceNames[0];
                const isAlbumPlaying = playingVoice === leadVoice;
                return (
                  <div
                    key={album.id}
                    className={`rounded-2xl border overflow-hidden shadow-sm flex flex-col justify-between ${album.surfaceTintClass} ${album.borderHoverClass}`}
                  >
                    <div>
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900">
                        <img
                          src={album.coverImg}
                          alt={bi(album.titleBn, album.titleEn)}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4 text-white">
                          <p className="text-xs font-medium text-amber-200">
                            {bi(album.titleEn, album.titleBn)}
                          </p>
                          <h3 className="text-lg font-serif font-medium">
                            {bi(album.titleBn, album.titleEn)}
                          </h3>
                        </div>
                      </div>
                      <div className="p-5 space-y-2">
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {bi(album.subtitleBn, album.subtitleEn)}
                        </p>
                        <p className={`text-xs font-semibold ${album.accentTextClass}`}>
                          {album.featuredVoiceNames.join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div className="px-5 pb-5">
                      <button
                        type="button"
                        onClick={() => handleToggleSample(leadVoice)}
                        className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all ${album.buttonBgClass}`}
                      >
                        {isAlbumPlaying ? <Pause size={14} /> : <Play size={14} />}
                        <span>
                          {isAlbumPlaying
                            ? bi(`${leadVoice} থামান`, `Stop ${leadVoice}`)
                            : bi(`${leadVoice} শুনে দেখুন`, `Audition ${leadVoice}`)}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredVoices.map((voice) => {
              const active = playingVoice === voice.name;
              const visual = getVoiceAlbumVisual(voice);
              return (
                <div
                  key={voice.name}
                  className="rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                >
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-900">
                    <img
                      src={visual.coverImg}
                      alt={`${voice.name} ${bi('অ্যালবাম কভার', 'cover')}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/35 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleToggleSample(voice.name)}
                        aria-label={active ? `${bi('থামান', 'Stop')} ${voice.name}` : `${bi('চালান', 'Play')} ${voice.name}`}
                        className="w-9 h-9 rounded-full bg-white/95 text-indigo-700 flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                      >
                        {active ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-base font-serif font-medium text-slate-900 dark:text-white truncate">
                        {voice.name}
                      </h3>
                      <span className="text-xs font-medium text-indigo-600 dark:text-amber-300 shrink-0">
                        {localizeGender(voice.analysis.gender, lang)} · {localizePitch(voice.pitch, lang)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {voice.analysis.characteristics.map((c) => localizeTrait(c, lang)).join(', ')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Plans & Referral Section */}
        <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-zinc-200/70 dark:border-zinc-800/70">
          <div className="max-w-2xl mb-10 space-y-2">
            <h2 className="text-2xl sm:text-4xl font-serif font-medium text-zinc-900 dark:text-white">
              {bi('ফ্রি দিয়ে শুরু করুন, ক্রেডিট আয় করুন বা আনলিমিটেড নিন', 'Start Free, Earn Credits, or Go Unlimited')}
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
              {bi(
                'দৈনিক ফ্রি ক্রেডিট ব্যবহার করুন, বন্ধুদের আমন্ত্রণ জানিয়ে ব্যালেন্স বাড়ান (+১০ প্রতি বন্ধু) অথবা যেকোনো সময় প্রো-তে আপগ্রেড করুন।',
                'Use daily free credits, grow your balance by inviting friends (+10 per friend), or upgrade to Pro anytime.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {bi('নতুন নির্মাতাদের জন্য আদর্শ', 'For creators getting started')}
                  </p>
                  <h3 className="text-2xl font-serif font-medium text-zinc-900 dark:text-white mt-1">
                    {bi('ফ্রি + রেফার ও বোনাস', 'Free + Refer & Earn')}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {bi('০ টাকা · দৈনিক কোটা রিসেট + বোনাস রেফারেল ক্রেডিট', '0 BDT · Daily quota reset + bonus referral credits')}
                  </p>
                </div>
                <ul className="space-y-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{bi('প্রতিদিন ফ্রি এআই TTS ও ভয়েস কাস্টিং ব্যবহারের সুযোগ', 'Daily free AI TTS & Voice Casting generations')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{bi('আপনার লিংকে প্রতিটি নতুন বন্ধু সাইন-ইন করলে +১০ বোনাস ক্রেডিট', '+10 Bonus Credits for every friend who signs in with your link')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{bi('৩০টি ভয়েস প্রিভিউ, ফেভারিটস ও WAV ডাউনলোডের পূর্ণ সুবিধা', 'Full access to all 30 voice previews, Favorites & WAV downloads')}</span>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 px-5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {bi('গুগল দিয়ে ফ্রি শুরু করুন', 'Start Free with Google')}
              </button>
            </div>

            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {bi('মান্থলি (৩০ দিন) ও ইয়ারলি (৩৬৫ দিন) প্রো', 'Monthly (30d) & Yearly (365d) Pro')}
                  </p>
                  <h3 className="text-2xl font-serif font-medium text-zinc-900 dark:text-white mt-1">
                    {bi('শ্রাবণ গো প্রো', 'Srabon Go Pro')}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {bi('অ্যাকাউন্টের ভেতর থেকেই সহজ বিকাশ / নগদ ভেরিফিকেশন', 'Simple bKash / Nagad verification inside your account')}
                  </p>
                </div>
                <ul className="space-y-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>{bi('মান্থলি (৩০ দিন): আনলিমিটেড দৈনিক TTS, ২,৫০০ অক্ষর ও ৩টি সেভড স্ক্রিপ্ট', 'Monthly (30d): Unlimited daily TTS, 2,500 chars & 3 saved scripts')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>{bi('ইয়ারলি (৩৬৫ দিন): ৫,০০০ অক্ষর, স্পিড/বুস্ট অডিও, কাস্টম লুপ ও +৪ প্রো স্টাইল', 'Yearly (365d): 5,000 chars, Speed/Boost audio, custom loop & +4 Pro styles')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>{bi('অ্যাপের ভেতরেই TrxID রিকোয়েস্ট ও দ্রুত অ্যাডমিন অনুমোদন', 'In-app TrxID request & fast admin activation')}</span>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 px-5 rounded-xl bg-zinc-900 dark:bg-indigo-600 text-white text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors"
              >
                {bi('আপগ্রেড করতে সাইন ইন করুন', 'Sign In to Upgrade')}
              </button>
            </div>
          </div>
        </section>

        {/* Public Star Ratings & Customer Reviews Section (Visible Before Login) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-zinc-200/70 dark:border-zinc-800/70">
          <SiteReviewsSection
            user={null}
            isAdmin={false}
            onRequireSignIn={handleGoogleSignIn}
          />
        </div>

        {/* FAQ Accordion */}
        <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-zinc-200/70 dark:border-zinc-800/70">
          <div className="mb-8 space-y-2">
            <h2 className="text-2xl sm:text-4xl font-serif font-medium text-zinc-900 dark:text-white">
              {bi('সচরাচর জিজ্ঞাসিত প্রশ্নোত্তর', 'Frequently Asked Questions')}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {bi('ভয়েস স্টুডিও, রেফারেল ক্রেডিট ও অডিও ডাউনলোড সম্পর্কিত দ্রুত উত্তর।', 'Quick answers about Voice Studio, referral credits, and downloads.')}
            </p>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-t border-b border-zinc-200 dark:border-zinc-800">
            {faqItems.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 text-left text-sm sm:text-base font-medium text-zinc-900 dark:text-white py-1"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-zinc-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-2.5 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <AdBanner
            slotId={import.meta.env.VITE_ADSENSE_SLOT_DEFAULT}
            format="horizontal"
            className="mt-10"
          />
        </section>
      </main>

      {/* Full Website Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
              {bi('শ্রাবণ গো', 'Srabon Go')}
            </span>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {bi(
                'বহুভাষিক এআই ভয়েস স্টুডিও ও কাস্টিং লাইব্রেরি · © ২০২৬ শ্রাবণ গো — সর্বস্বত্ব সংরক্ষিত',
                'Multilingual AI Voice Studio & Casting Library · © 2026 Srabon Go — All Rights Reserved'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <SocialLinksRow socialLinks={socialLinks} variant="footer" />
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">|</span>
            <button
              type="button"
              onClick={() => setLegalTab('about')}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {bi('পরিচিতি', 'About')}
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('privacy')}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {bi('গোপনীয়তা নীতি', 'Privacy Policy')}
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('terms')}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {bi('ব্যবহারের শর্তাবলি', 'Terms of Service')}
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('contact')}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {bi('যোগাযোগ', 'Contact')}
            </button>
          </div>
        </div>
      </footer>

      {legalTab && (
        <SiteLegalModal initialTab={legalTab} onClose={() => setLegalTab(null)} />
      )}
    </div>
  );
};

export default GoogleLoginGate;
