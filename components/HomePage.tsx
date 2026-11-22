/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useState } from 'react';
import {
  AudioLines,
  TrendingUp,
  LayoutGrid,
  Scissors,
  ArrowRight,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  Shield,
  Disc3,
  Mic,
  Crown,
  UserCheck,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { AppViewMode, SalonConfig, UserPlan } from '../types';
import { SALON_SERVICES, formatSalonPrice } from '../utils/salon';
import { FEATURED_VOICE_ALBUMS, STUDIO_MEDIA } from '../utils/studioAlbums';

interface HomePageProps {
  user: User;
  userPlan: UserPlan;
  isAdmin: boolean;
  salonConfig: SalonConfig;
  voicesCount: number;
  favoritesCount: number;
  onNavigate: (mode: AppViewMode) => void;
  onUseInStudio?: (voiceName: string) => void;
  onOpenAdminPanel?: () => void;
  onOpenLegal?: (tab: 'about' | 'privacy' | 'terms' | 'contact') => void;
}

const HomePage: React.FC<HomePageProps> = ({
  user,
  userPlan,
  isAdmin,
  salonConfig,
  voicesCount,
  favoritesCount,
  onNavigate,
  onUseInStudio,
  onOpenAdminPanel,
  onOpenLegal,
}) => {
  const firstName = (user.displayName || user.email?.split('@')[0] || 'Guest').split(' ')[0];
  const minServicePrice = Math.min(
    salonConfig.haircutPrice,
    salonConfig.beardTrimPrice,
    salonConfig.shavePrice
  );
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [salonImgFailed, setSalonImgFailed] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
        {/* Hero Section with Studio Photography */}
        <section className="rounded-3xl bg-gradient-to-br from-white via-[#f8faff] to-indigo-50/70 dark:from-[#0f172a] dark:via-[#111936] dark:to-[#1a1630] border border-indigo-100 dark:border-indigo-900/60 overflow-hidden shadow-md">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between gap-6">
              <div className="space-y-3.5 max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-amber-400">
                  Srabon Go Studio · {isAdmin ? 'Admin' : userPlan === 'pro' ? 'Pro Account' : 'Free Plan'}
                </p>
                <h2
                  className="text-3xl sm:text-4xl lg:text-5xl font-serif font-medium tracking-tight text-slate-900 dark:text-white leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  স্বাগতম, {firstName}
                </h2>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  ভয়েস স্টুডিও, প্রিমিয়াম ভয়েস অ্যালবাম কালেকশন, ট্রেন্ডিং অডিও স্ক্রিপ্ট এবং আলাদা সেলুন অ্যাপয়েন্টমেন্ট বুকিং পেজ—সবকিছু রঙিন ও প্রিমিয়াম অভিজ্ঞতায় এক জায়গায়।
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('studio')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 hover:from-indigo-500 hover:via-blue-500 hover:to-violet-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all whitespace-nowrap shrink-0"
                >
                  <AudioLines size={16} />
                  <span>ভয়েস স্টুডিও খুলুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('voice-clone')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-sm font-semibold shadow-md shadow-teal-600/20 transition-all whitespace-nowrap shrink-0"
                >
                  <Mic size={16} />
                  <span>নিজের ভয়েস ক্লোন টুল (Pro)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('salon')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-sm font-bold shadow-md shadow-amber-500/20 transition-all whitespace-nowrap shrink-0"
                >
                  <Scissors size={16} />
                  <span>সেলুন বুকিং পেজ</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 relative min-h-[220px] lg:min-h-full bg-gradient-to-br from-indigo-900 via-slate-900 to-amber-900 overflow-hidden">
              {!heroImgFailed ? (
                <img
                  src={STUDIO_MEDIA.heroStudio}
                  alt="Srabon Go Luxury Recording & AI Voice Studio"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-amber-300/80">
                  <Disc3 size={48} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3 text-white">
                <div>
                  <p className="text-xs font-medium text-amber-300">
                    Acoustic Voice Console
                  </p>
                  <p className="text-sm font-serif">
                    {voicesCount}টি স্টুডিও ভয়েস · ২৪ kHz WAV
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('carousel')}
                  className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                >
                  3D ক্যারোসেল দেখুন
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Dedicated Premium Tool Banner: Personal Voice Recording & AI Clone Studio */}
        <section className="rounded-3xl bg-gradient-to-r from-indigo-950 via-[#151f42] to-teal-950 text-white border border-indigo-500/35 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300">
                <Crown size={14} />
                <span>Dedicated Premium Tool · Personal Voice Clone</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-white">
                নিজের ভয়েস রেকর্ড করে যেকোনো লেখা বলান
              </h3>
              <p className="text-xs sm:text-sm text-indigo-100/85 leading-relaxed">
                আপনার কণ্ঠ ৩–২৫ সেকেন্ড রেকর্ড (বা অডিও আপলোড) করে সেভ রাখুন। এআই আপনার ভয়েস এনালাইসিস করে Voice DNA প্রোফাইল তৈরি করবে—তারপর যেকোনো বাংলা বা ইংরেজি লেখা ওই প্রোফাইলে বলানো ও WAV ডাউনলোড করা যাবে।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('voice-clone')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/25 transition-all whitespace-nowrap"
              >
                <UserCheck size={17} />
                <span>প্রিমিয়াম টুল চালু করুন</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* Premium Voice Albums Visual Showcase */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-amber-400">
                Curated Studio Editions
              </p>
              <h3 className="text-2xl font-serif font-medium text-slate-900 dark:text-white mt-0.5">
                প্রিমিয়াম ভয়েস অ্যালবাম কালেকশন
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('grid')}
              className="text-xs font-semibold text-indigo-600 dark:text-amber-300 hover:underline underline-offset-4 self-start sm:self-auto whitespace-nowrap"
            >
              সব {voicesCount}টি ভয়েস দেখুন →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURED_VOICE_ALBUMS.map((album) => {
              const primaryVoice = album.featuredVoiceNames[0];
              return (
                <article
                  key={album.id}
                  className={`rounded-3xl border overflow-hidden shadow-sm transition-all flex flex-col justify-between ${album.surfaceTintClass} ${album.borderHoverClass}`}
                >
                  <div>
                    <div className="relative aspect-square w-full overflow-hidden bg-slate-900">
                      <img
                        src={album.coverImg}
                        alt={album.titleEn}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent" />
                      <div className="absolute bottom-3.5 left-4 right-4 text-white">
                        <p className="text-[11px] font-medium text-amber-200">
                          {album.titleEn}
                        </p>
                        <h4 className="text-lg font-serif font-medium leading-snug">
                          {album.titleBn}
                        </h4>
                      </div>
                    </div>

                    <div className="p-5 space-y-2.5">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {album.subtitleBn}
                      </p>
                      <p className={`text-xs font-semibold ${album.accentTextClass}`}>
                        ভয়েস: {album.featuredVoiceNames.join(' · ')}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onUseInStudio) {
                          onUseInStudio(primaryVoice);
                        } else {
                          onNavigate('studio');
                        }
                      }}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${album.buttonBgClass}`}
                    >
                      <AudioLines size={14} />
                      <span>{primaryVoice} দিয়ে বলুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('grid')}
                      className="py-2.5 px-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                    >
                      অ্যালবাম
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Dedicated Separate Page Feature Card: Jagannath gents parlour and salon */}
        <section className="rounded-3xl bg-gradient-to-br from-[#17110d] via-[#1f1712] to-[#0f172a] text-white border border-amber-500/25 overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Top/Left Luxury Interior Photo + Overview */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-stone-900">
                {!salonImgFailed ? (
                  <img
                    src={STUDIO_MEDIA.salonInterior}
                    alt={`${salonConfig.salonName} Interior`}
                    referrerPolicy="no-referrer"
                    onError={() => setSalonImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-[#17110d] via-[#17110d]/35 to-transparent" />
                <div className="absolute bottom-3 left-6 right-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-300">
                  <Scissors size={14} />
                  <span>আলাদা পেজ · Men&apos;s Hair Cutting &amp; Grooming Booking</span>
                </div>
              </div>

              <div className="p-6 sm:p-8 pt-4 flex flex-col justify-between gap-5 flex-1">
                <div className="space-y-3">
                  <h3 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-white">
                    {salonConfig.salonName}
                  </h3>

                  <p className="text-sm text-amber-100/80 leading-relaxed max-w-xl">
                    প্রফেশনাল জেন্টস হেয়ারকাট, বিয়ার্ড স্টাইলিং, হট টাওয়েল শেভ ও ফেসিয়াল সার্ভিসের জন্য অনলাইন স্লট বুক করুন। সব সার্ভিসের বর্তমান রেট এবং বুকিং চার্জ রিয়েল-টাইমে অ্যাডমিন প্যানেল থেকে আপডেট হয়।
                  </p>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-300 pt-1">
                    {salonConfig.openHours && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} className="text-amber-400 shrink-0" />
                        {salonConfig.openHours}
                      </span>
                    )}
                    {salonConfig.address && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={13} className="text-amber-400 shrink-0" />
                        {salonConfig.address}
                      </span>
                    )}
                    {salonConfig.phone && (
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Phone size={13} className="text-amber-400 shrink-0" />
                        {salonConfig.phone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigate('salon')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 text-sm font-bold shadow-md shadow-amber-500/20 transition-all whitespace-nowrap shrink-0"
                  >
                    <span>বুকিং পেজে প্রবেশ করুন</span>
                    <ArrowRight size={16} />
                  </button>

                  {isAdmin && onOpenAdminPanel && (
                    <button
                      type="button"
                      onClick={onOpenAdminPanel}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-amber-400/30 text-amber-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      <Shield size={14} className="text-amber-400" />
                      <span>অ্যাডমিন প্রাইস পরিবর্তন করুন</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Live Price Ledger */}
            <div className="lg:col-span-5 bg-black/35 border-t lg:border-t-0 lg:border-l border-amber-500/20 p-6 sm:p-8 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-200/80">
                    লাইভ রেট লিস্ট
                  </span>
                  <span className="text-xs text-amber-400 font-semibold tabular-nums">
                    শুরু {formatSalonPrice(minServicePrice, salonConfig.currencySymbol)}
                  </span>
                </div>

                <ul className="divide-y divide-amber-500/15 text-sm">
                  {SALON_SERVICES.slice(0, 5).map((service) => (
                    <li
                      key={service.key}
                      className="py-2.5 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-mono text-amber-300/60 mr-2">
                          {service.number}
                        </span>
                        <span className="text-stone-100 font-medium truncate">
                          {service.title}
                        </span>
                      </div>
                      <span className="font-semibold text-amber-400 tabular-nums shrink-0">
                        {formatSalonPrice(
                          salonConfig[service.priceField],
                          salonConfig.currencySymbol
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs text-stone-300">
                <span>অনলাইন বুকিং চার্জ (Booking Fee)</span>
                <span className="font-semibold text-amber-300 tabular-nums">
                  {formatSalonPrice(salonConfig.bookingFee, salonConfig.currencySymbol)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Studio & Library Navigation Bento Grid */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-serif font-medium text-slate-900 dark:text-white">
              অ্যাপের অন্যান্য সেকশন
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {voicesCount}টি ভয়েস · {favoritesCount}টি ফেভারিট
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <button
              type="button"
              onClick={() => onNavigate('studio')}
              className="md:col-span-6 text-left p-6 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/70 dark:from-indigo-950/50 dark:via-[#0f172a] dark:to-blue-950/30 border border-indigo-200/80 dark:border-indigo-800/70 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all group flex flex-col justify-between gap-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-sm">
                  <AudioLines size={19} />
                </div>
                <ArrowRight
                  size={18}
                  className="text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-lg font-serif font-medium text-slate-900 dark:text-white">
                  AI ভয়েস স্টুডিও (TTS Studio)
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  বাংলা, ইংরেজি ও যেকোনো স্ক্রিপ্ট দিয়ে ন্যাচারাল এআই ভয়েস ওভার তৈরি করুন এবং WAV ফাইল ডাউনলোড করুন।
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('ideas')}
              className="md:col-span-3 text-left p-6 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 dark:from-emerald-950/40 dark:via-[#0f172a] dark:to-teal-950/30 border border-emerald-200/80 dark:border-emerald-800/70 hover:border-emerald-400 dark:hover:border-emerald-500 transition-all group flex flex-col justify-between gap-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-sm">
                  <TrendingUp size={19} />
                </div>
                <ArrowRight
                  size={18}
                  className="text-emerald-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-serif font-medium text-slate-900 dark:text-white">
                  ট্রেন্ডিং অডিও আইডিয়া
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  AI দিয়ে নতুন রিলস, শর্টস ও অ্যালার্ম ভয়েস স্ক্রিপ্ট পান।
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('grid')}
              className="md:col-span-3 text-left p-6 rounded-2xl bg-gradient-to-br from-rose-50/90 via-white to-amber-50/60 dark:from-rose-950/35 dark:via-[#0f172a] dark:to-amber-950/25 border border-rose-200/80 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-600 transition-all group flex flex-col justify-between gap-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-sm">
                  <LayoutGrid size={19} />
                </div>
                <ArrowRight
                  size={18}
                  className="text-rose-400 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-serif font-medium text-slate-900 dark:text-white">
                  ভয়েস লাইব্রেরি
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {voicesCount}টি ভয়েস আর্টিস্টের ডেমো শুনুন ও ফেভারিট সেভ করুন।
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* Quiet Footer */}
        <footer className="pt-4 pb-6 border-t border-indigo-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-indigo-500 dark:text-amber-400" />
            <span>Srabon Go · {salonConfig.salonName}</span>
          </div>
          {onOpenLegal && (
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => onOpenLegal('about')} className="hover:text-indigo-700 dark:hover:text-white">
                About
              </button>
              <button type="button" onClick={() => onOpenLegal('privacy')} className="hover:text-indigo-700 dark:hover:text-white">
                Privacy
              </button>
              <button type="button" onClick={() => onOpenLegal('terms')} className="hover:text-indigo-700 dark:hover:text-white">
                Terms
              </button>
              <button type="button" onClick={() => onOpenLegal('contact')} className="hover:text-indigo-700 dark:hover:text-white">
                Contact
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default HomePage;
