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
import { reportAppIssue } from '../utils/appIssues';
import { VOICE_DATA } from '../constants';
import AudioVisualizer from './AudioVisualizer';
import AdBanner from './AdBanner';
import SiteLegalModal, { LegalTab } from './SiteLegalModal';

interface GoogleLoginGateProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const FEATURED_VOICE_NAMES = ['Kore', 'Zephyr', 'Fenrir', 'Aoede', 'Puck', 'Charon'];

const FAQ_ITEMS = [
  {
    q: 'কোন কোন ভাষায় ভয়েস ও অডিও তৈরি করা যাবে?',
    a: 'Srabon Go বাংলা, ইংরেজি এবং বিশ্বের বিভিন্ন ভাষার স্ক্রিপ্ট প্রাকৃতিক উচ্চারণ ও নির্দিষ্ট টোন (যেমন: সকালের অ্যালার্ম, নিউজ রিডিং বা গল্প বলার ভঙ্গি) অনুযায়ী ভয়েসওভার তৈরি করতে পারে।',
  },
  {
    q: 'বন্ধুদের রেফার করে কীভাবে +১০টি ফ্রি ক্রেডিট পাবেন?',
    a: 'লগইন করার পর উপরের "Refer +10" বাটন থেকে আপনার নিজস্ব রেফার কোড বা লিংক শেয়ার করুন। প্রতিটি নতুন বন্ধু আপনার লিংকে ঢুকে গুগল সাইন-ইন করলে আপনি স্বয়ংক্রিয়ভাবে +১০টি বোনাস ক্রেডিট পাবেন।',
  },
  {
    q: 'দৈনিক ফ্রি কোটা শেষ হলে কী হবে?',
    a: 'প্রতিদিনের ফ্রি সীমা শেষ হয়ে গেলে আপনার জমা থাকা বোনাস রেফার ক্রেডিট থেকে ১টি করে ক্রেডিট স্বয়ংক্রিয়ভাবে ব্যবহার হবে। পাশাপাশি চাইলে যেকোনো সময় Pro প্ল্যান আনলক করে আনলিমিটেড ব্যবহার করতে পারবেন।',
  },
  {
    q: 'তৈরি করা অডিও কি WAV ফরম্যাটে ডাউনলোড করা যায়?',
    a: 'হ্যাঁ, Voice Studio ও AI Casting রেজাল্ট থেকে প্রতিটি জেনারেটেড অডিও সরাসরি ২৪ kHz ক্রিস্টাল-ক্লিয়ার WAV ফরম্যাটে ডাউনলোড এবং Alarm Loop মোডে শোনা যায়।',
  },
];

const GoogleLoginGate: React.FC<GoogleLoginGateProps> = ({ isDarkMode, toggleTheme }) => {
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
    audio.pause();
    audio.currentTime = 0;

    if (playingVoice) {
      const target = VOICE_DATA.find((v) => v.name === playingVoice);
      if (target) {
        audio.src = target.audioSampleUrl;
        audio.play().catch((err) => {
          console.error('Sample playback failed:', err);
          setPlayingVoice(null);
        });
      }
    }
  }, [playingVoice]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

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
        setError('লগইন পপআপ বন্ধ করা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। (Sign-in popup was closed.)');
      } else if (code === 'auth/cancelled-popup-request' || rawMessage.includes('Pending promise was never set')) {
        setError('লগইন প্রক্রিয়াটি সম্পূর্ণ হয়নি। অনুগ্রহ করে আবার "Continue with Google" বাটনে ক্লিক করুন।');
      } else if (code === 'auth/popup-blocked') {
        setError('ব্রাউজারে পপআপ ব্লক করা আছে। অনুগ্রহ করে পপআপ অনুমতি দিন। (Please allow popups to sign in.)');
      } else if (
        code === 'auth/web-storage-unsupported' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        setError('এই ব্রাউজারে তৃতীয়-পক্ষ কুকি/স্টোরেজ বন্ধ আছে। অনুগ্রহ করে Chrome বা Safari-তে সরাসরি ওপেন করে আবার চেষ্টা করুন।');
      } else if (code === 'auth/network-request-failed') {
        setError('ইন্টারনেট সংযোগ দুর্বল থাকায় লগইন সম্পন্ন হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        reportAppIssue({
          source: 'GoogleSignIn',
          severity: 'error',
          message: `Unauthorized domain for Firebase Auth: ${host}`,
          details: 'Add this hostname in Firebase Console > Authentication > Settings > Authorized domains.',
        });
        setError('লগইন সম্পন্ন করা যায়নি। অনুগ্রহ করে পরে আবার চেষ্টা করুন।');
      } else {
        reportAppIssue({
          source: 'GoogleSignIn',
          severity: 'error',
          message: rawMessage || 'Google sign-in failed',
          details: code ? `Firebase Auth code: ${code}` : undefined,
        });
        setError('লগইন সম্পন্ন করা যায়নি। অনুগ্রহ করে পরে আবার চেষ্টা করুন।');
      }
    } finally {
      signingInRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#fcfcfc] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans relative transition-colors duration-300">
      <audio
        ref={audioRef}
        onEnded={() => setPlayingVoice(null)}
        preload="none"
      />

      {/* Top Navigation Bar (Clean 3-Zone Contract) */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap shrink-0"
          >
            Srabon Go
          </a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600 dark:text-zinc-400"
          >
            <a
              href="#features"
              className="hover:text-zinc-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <a
              href="#voices"
              className="hover:text-zinc-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Voice Library
            </a>
            <a
              href="#pricing"
              className="hover:text-zinc-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Plans &amp; Refer
            </a>
            <a
              href="#faq"
              className="hover:text-zinc-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              FAQ
            </a>
          </nav>

          {/* Zone 3: Primary Action + Clean 3-Dot Menu */}
          <div ref={headerMenuRef} className="relative flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-indigo-600 text-white text-xs sm:text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHeaderMenu((prev) => !prev)}
              aria-expanded={showHeaderMenu}
              aria-haspopup="menu"
              aria-label="অন্যান্য অপশন"
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
                    Features
                  </a>
                  <a
                    href="#voices"
                    onClick={() => setShowHeaderMenu(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Voice Library
                  </a>
                  <a
                    href="#pricing"
                    onClick={() => setShowHeaderMenu(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Plans &amp; Refer
                  </a>
                  <a
                    href="#faq"
                    onClick={() => setShowHeaderMenu(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    FAQ
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
                  <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
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
                  {loading ? 'Signing in...' : 'Sign In with Google'}
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
                <span>AI Voice Studio</span>
                <span aria-hidden="true">·</span>
                <span>30 Studio Voices</span>
                <span aria-hidden="true">·</span>
                <span>Bengali &amp; Global TTS</span>
              </div>

              <h1
                className="text-4xl sm:text-5xl lg:text-[52px] font-serif font-medium tracking-tight text-zinc-900 dark:text-white leading-[1.12]"
                style={{ textWrap: 'balance' }}
              >
                Speak any script in natural Bengali and global voices.
              </h1>

              <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl">
                প্রাকৃতিক কণ্ঠে বাংলা ও ইংরেজি ভয়েসওভার তৈরি করুন, পছন্দের ভয়েস কাস্টিং করুন এবং ক্রিস্টাল-ক্লিয়ার WAV অডিও ডাউনলোড করুন। বন্ধুদের রেফার করে প্রতিদিন ফ্রি কোটার সাথে প্রতি রেফারে +১০ ক্রেডিট জিতুন।
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
                  className="inline-flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-sm shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all active:scale-[0.99] whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                  <span>{loading ? 'Signing in with Google...' : 'Continue with Google'}</span>
                </button>

                <a
                  href="#voices"
                  className="inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 font-medium text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <AudioLines size={16} />
                  <span>Listen to Voice Samples</span>
                </a>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Secured by Google Sign-In · Daily free quota included · Instant referral rewards</span>
              </div>
            </div>

            {/* Right: Interactive Live Voice Preview Console */}
            <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                    Live Studio Voice Preview
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Click any voice below to audition sample audio before signing in
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                  {VOICE_DATA.length} voices
                </span>
              </div>

              {/* Waveform Box */}
              <div className="h-28 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative flex items-center justify-center">
                {playingVoice ? (
                  <AudioVisualizer
                    isPlaying={true}
                    color={isDarkMode ? '#a5b4fc' : '#18181b'}
                  />
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    Select a voice sample below to visualize playback
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
                            {voice.analysis.gender} · {voice.pitch} pitch
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {voice.analysis.characteristics.join(', ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSample(voice.name)}
                        aria-label={active ? `Pause ${voice.name}` : `Play ${voice.name}`}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {active ? <Pause size={13} /> : <Play size={13} />}
                        <span>{active ? 'Stop' : 'Preview'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4-Column Key Platform Metrics Strip */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-b border-zinc-200 dark:border-zinc-800 py-6">
            <div>
              <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                30
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Studio Voices Across Pitches
              </p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                24 kHz
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Direct WAV Audio Export
              </p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                +10 Cr
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Bonus Credits per Friend Referral
              </p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                Multi-Lang
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Bengali, English &amp; Global Scripts
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
              Everything needed for voice synthesis, casting, and sharing.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
              Built for creators, educators, and daily study routines with synchronized cloud preferences.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <article className="md:col-span-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <AudioLines size={15} />
                  <span>01. Multilingual Text-to-Speech Studio</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-serif font-medium text-zinc-900 dark:text-white">
                  Custom Vocal Direction &amp; Alarm Loop
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl">
                  Write scripts in Bengali, English, or any language, pair them with delivery tone instructions (e.g., energetic morning wake-up, warm mentor, or calm narrator), preview waveforms in real time, and download ready-to-use WAV files.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <span>Quick Bengali &amp; English presets</span>
                <span aria-hidden="true">·</span>
                <span>Continuous Alarm Loop playback</span>
                <span aria-hidden="true">·</span>
                <span>Zero-latency WAV export</span>
              </div>
            </article>

            <article className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Sparkles size={15} />
                  <span>02. AI Casting Director</span>
                </div>
                <h3 className="text-xl font-serif font-medium text-zinc-900 dark:text-white">
                  Instant Character Matching
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Describe the speaker persona or paste dialogue—AI selects the best 3 voices and writes a full Director System Prompt with sample playback.
                </p>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                3D Carousel, Filter Grid &amp; Cloud Favorites
              </p>
            </article>

            <article className="md:col-span-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Gift size={15} />
                  <span>03. Refer &amp; Earn Program</span>
                </div>
                <h3 className="text-xl font-serif font-medium text-zinc-900 dark:text-white">
                  Invite friends and get +10 bonus credits per sign-in
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Every member gets a personal referral code and shareable link. When a friend joins with Google using your link, 10 bonus credits are credited automatically and activate whenever your daily free limit is reached.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="px-5 py-3 rounded-xl bg-zinc-900 dark:bg-indigo-600 text-white text-xs sm:text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0"
              >
                Get Your Referral Link
              </button>
            </article>
          </div>
        </section>

        {/* Voice Library Preview Grid */}
        <section id="voices" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-zinc-200/70 dark:border-zinc-800/70">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-4xl font-serif font-medium text-zinc-900 dark:text-white">
                Explore Voice Personalities
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Audition 6 featured voices now—sign in to unlock all {VOICE_DATA.length} voices, 3D Carousel, and custom TTS Studio.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4 whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Open Full Library →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredVoices.map((voice) => {
              const active = playingVoice === voice.name;
              return (
                <div
                  key={voice.name}
                  className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
                        {voice.name}
                      </h3>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {voice.analysis.gender} · {voice.pitch}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {voice.analysis.characteristics.join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSample(voice.name)}
                    className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {active ? <Pause size={14} /> : <Play size={14} />}
                    <span>{active ? 'Stop Sample' : 'Play Sample'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Plans & Referral Section */}
        <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-zinc-200/70 dark:border-zinc-800/70">
          <div className="max-w-2xl mb-10 space-y-2">
            <h2 className="text-2xl sm:text-4xl font-serif font-medium text-zinc-900 dark:text-white">
              Start Free, Earn Credits, or Go Unlimited
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
              Use daily free credits, grow your balance by inviting friends (+10 per friend), or upgrade to Pro anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    For creators getting started
                  </p>
                  <h3 className="text-2xl font-serif font-medium text-zinc-900 dark:text-white mt-1">
                    Free + Refer &amp; Earn
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    0 BDT · Daily quota reset + bonus referral credits
                  </p>
                </div>
                <ul className="space-y-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Daily free AI TTS &amp; Voice Casting generations</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>+10 Bonus Credits for every friend who signs in with your link</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Full access to all 30 voice previews, Favorites &amp; WAV downloads</span>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 px-5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Start Free with Google
              </button>
            </div>

            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    For high-volume voice studios
                  </p>
                  <h3 className="text-2xl font-serif font-medium text-zinc-900 dark:text-white mt-1">
                    Srabon Go Pro
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    Simple bKash / Nagad verification inside your account
                  </p>
                </div>
                <ul className="space-y-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>Unlimited daily Voice Studio TTS generations</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>Unlimited AI Casting Director prompts &amp; character matches</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>In-app TrxID request &amp; fast admin activation</span>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 px-5 rounded-xl bg-zinc-900 dark:bg-indigo-600 text-white text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors"
              >
                Sign In to Upgrade
              </button>
            </div>
          </div>
        </section>

        {/* FAQ Accordion */}
        <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-zinc-200/70 dark:border-zinc-800/70">
          <div className="mb-8 space-y-2">
            <h2 className="text-2xl sm:text-4xl font-serif font-medium text-zinc-900 dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Quick answers about Voice Studio, referral credits, and downloads.
            </p>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-t border-b border-zinc-200 dark:border-zinc-800">
            {FAQ_ITEMS.map((item, idx) => {
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
            <span className="text-base font-bold text-zinc-900 dark:text-white">
              Srabon Go
            </span>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Multilingual AI Voice Studio &amp; Casting Library · © 2026 Srabon Go — All Rights Reserved
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <button
              type="button"
              onClick={() => setLegalTab('about')}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('privacy')}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('terms')}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('contact')}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Contact
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
