/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React from 'react';
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
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { AppViewMode, SalonConfig, UserPlan } from '../types';
import { SALON_SERVICES, formatSalonPrice } from '../utils/salon';

interface HomePageProps {
  user: User;
  userPlan: UserPlan;
  isAdmin: boolean;
  salonConfig: SalonConfig;
  voicesCount: number;
  favoritesCount: number;
  onNavigate: (mode: AppViewMode) => void;
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
  onOpenAdminPanel,
  onOpenLegal,
}) => {
  const firstName = (user.displayName || user.email?.split('@')[0] || 'Guest').split(' ')[0];
  const minServicePrice = Math.min(
    salonConfig.haircutPrice,
    salonConfig.beardTrimPrice,
    salonConfig.shavePrice
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* Hero Section */}
        <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-10 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Srabon Go Hub · {isAdmin ? 'Admin' : userPlan === 'pro' ? 'Pro Account' : 'Free Plan'}
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-medium tracking-tight text-zinc-900 dark:text-white leading-tight">
                স্বাগতম, {firstName}
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                ভয়েস স্টুডিও, ট্রেন্ডিং অডিও স্ক্রিপ্ট আইডিয়া এবং আলাদা সেলুন অ্যাপয়েন্টমেন্ট বুকিং পেজ—সবকিছু এক জায়গায়।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('salon')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Scissors size={16} />
                <span>সেলুন বুকিং পেজে যান</span>
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('studio')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <AudioLines size={16} />
                <span>ভয়েস স্টুডিও খুলুন</span>
              </button>
            </div>
          </div>
        </section>

        {/* Dedicated Separate Page Feature Card: Jagannath gents parlour and salon */}
        <section className="rounded-3xl bg-zinc-950 dark:bg-zinc-900 text-white border border-zinc-800 overflow-hidden shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left overview */}
            <div className="lg:col-span-7 p-6 sm:p-9 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-widest text-amber-400">
                  <Scissors size={14} />
                  <span>আলাদা পেজ · Men&apos;s Hair Cutting &amp; Grooming Booking</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-white">
                  {salonConfig.salonName}
                </h3>

                <p className="text-sm text-zinc-300 leading-relaxed max-w-xl">
                  প্রফেশনাল জেন্টস হেয়ারকাট, বিয়ার্ড স্টাইলিং, হট টাওয়েল শেভ ও ফেসিয়াল সার্ভিসের জন্য অনলাইন স্লট বুক করুন। সব সার্ভিসের বর্তমান রেট এবং বুকিং চার্জ রিয়েল-টাইমে অ্যাডমিন প্যানেল থেকে আপডেট হয়।
                </p>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400 pt-1">
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

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('salon')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  <span>বুকিং পেজে প্রবেশ করুন</span>
                  <ArrowRight size={16} />
                </button>

                {isAdmin && onOpenAdminPanel && (
                  <button
                    type="button"
                    onClick={onOpenAdminPanel}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Shield size={14} className="text-amber-400" />
                    <span>অ্যাডমিন প্রাইস পরিবর্তন করুন</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Live Price Ledger */}
            <div className="lg:col-span-5 bg-zinc-900/90 dark:bg-zinc-950/70 border-t lg:border-t-0 lg:border-l border-zinc-800 p-6 sm:p-8 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    লাইভ রেট লিস্ট
                  </span>
                  <span className="text-xs text-amber-400 font-semibold tabular-nums">
                    শুরু {formatSalonPrice(minServicePrice, salonConfig.currencySymbol)}
                  </span>
                </div>

                <ul className="divide-y divide-zinc-800/80 text-sm">
                  {SALON_SERVICES.slice(0, 5).map((service) => (
                    <li
                      key={service.key}
                      className="py-2.5 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-mono text-zinc-500 mr-2">
                          {service.number}
                        </span>
                        <span className="text-zinc-200 font-medium truncate">
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

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                <span>অনলাইন বুকিং চার্জ (Booking Fee)</span>
                <span className="font-semibold text-white tabular-nums">
                  {formatSalonPrice(salonConfig.bookingFee, salonConfig.currencySymbol)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Studio & Library Navigation Bento Grid */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-serif font-medium text-zinc-900 dark:text-white">
              অ্যাপের অন্যান্য সেকশন
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {voicesCount}টি ভয়েস · {favoritesCount}টি ফেভারিট
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <button
              type="button"
              onClick={() => onNavigate('studio')}
              className="md:col-span-6 text-left p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors group flex flex-col justify-between gap-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <AudioLines size={19} />
                </div>
                <ArrowRight
                  size={18}
                  className="text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-lg font-serif font-medium text-zinc-900 dark:text-white">
                  AI ভয়েস স্টুডিও (TTS Studio)
                </h4>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  বাংলা, ইংরেজি ও যেকোনো স্ক্রিপ্ট দিয়ে ন্যাচারাল এআই ভয়েস ওভার তৈরি করুন এবং WAV ফাইল ডাউনলোড করুন।
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('ideas')}
              className="md:col-span-3 text-left p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors group flex flex-col justify-between gap-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <TrendingUp size={19} />
                </div>
                <ArrowRight
                  size={18}
                  className="text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-serif font-medium text-zinc-900 dark:text-white">
                  ট্রেন্ডিং অডিও আইডিয়া
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  AI দিয়ে নতুন রিলস, শর্টস ও অ্যালার্ম ভয়েস স্ক্রিপ্ট পান।
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('grid')}
              className="md:col-span-3 text-left p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors group flex flex-col justify-between gap-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                  <LayoutGrid size={19} />
                </div>
                <ArrowRight
                  size={18}
                  className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-serif font-medium text-zinc-900 dark:text-white">
                  ভয়েস লাইব্রেরি
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {voicesCount}টি ভয়েস আর্টিস্টের ডেমো শুনুন ও ফেভারিট সেভ করুন।
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* Quiet Footer */}
        <footer className="pt-4 pb-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-indigo-500" />
            <span>Srabon Go · {salonConfig.salonName}</span>
          </div>
          {onOpenLegal && (
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => onOpenLegal('about')} className="hover:text-zinc-900 dark:hover:text-white">
                About
              </button>
              <button type="button" onClick={() => onOpenLegal('privacy')} className="hover:text-zinc-900 dark:hover:text-white">
                Privacy
              </button>
              <button type="button" onClick={() => onOpenLegal('terms')} className="hover:text-zinc-900 dark:hover:text-white">
                Terms
              </button>
              <button type="button" onClick={() => onOpenLegal('contact')} className="hover:text-zinc-900 dark:hover:text-white">
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
