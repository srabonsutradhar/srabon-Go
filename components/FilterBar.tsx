/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { AppViewMode, FilterState, SocialLinksConfig, UserPlan } from '../types';
import {
  Search,
  Sparkles,
  Mic,
  LayoutGrid,
  GalleryHorizontalEnd,
  Sun,
  Moon,
  AudioLines,
  Heart,
  LogOut,
  Crown,
  Shield,
  Gift,
  TrendingUp,
  Home,
  Scissors,
  Bell,
  MessageSquare,
  MoreVertical,
  X,
  UserCheck,
  ArrowLeftRight,
  Languages,
  Star,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { localizeGender, localizePitch, useLanguage } from '../utils/i18n';
import { DEFAULT_SOCIAL_LINKS } from '../utils/socialLinks';
import PWAInstallButton from './PWAInstallButton';
import SocialLinksRow from './SocialLinksRow';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  uniqueGenders: string[];
  uniquePitches: string[];
  onOpenAiCasting: () => void;
  viewMode: AppViewMode;
  onViewModeChange: (mode: AppViewMode) => void;
  favoritesCount: number;
  isDarkMode: boolean;
  toggleTheme: () => void;
  user?: User | null;
  onSignOut?: () => void;
  userPlan?: UserPlan;
  usedToday?: number;
  freeDailyLimit?: number;
  bonusCredits?: number;
  isAdmin?: boolean;
  onOpenProModal?: (tab?: 'refer' | 'pro') => void;
  onOpenAdminPanel?: () => void;
  unreadIssuesCount?: number;
  onOpenNotifications?: () => void;
  unreadChatCount?: number;
  onOpenChat?: () => void;
  onOpenVoiceCompare?: () => void;
  compareCount?: number;
  socialLinks?: SocialLinksConfig;
}

const VIEW_LABELS_BN: Record<AppViewMode, string> = {
  home: 'হোম',
  studio: 'ভয়েস স্টুডিও',
  'voice-clone': 'আমার ভয়েস প্রো',
  salon: 'সেলুন',
  ideas: 'আইডিয়া',
  carousel: '3D ভয়েস',
  grid: 'ভয়েসসমূহ',
  favorites: 'পছন্দ',
};

const VIEW_LABELS_EN: Record<AppViewMode, string> = {
  home: 'Home',
  studio: 'Voice Studio',
  'voice-clone': 'My Voice Pro',
  salon: 'Salon',
  ideas: 'Ideas',
  carousel: '3D Voices',
  grid: 'Voices',
  favorites: 'Favorites',
};

const VIEW_LABELS_PT: Record<AppViewMode, string> = {
  home: 'Início',
  studio: 'Estúdio de Voz',
  'voice-clone': 'Minha Voz Pro',
  salon: 'Salão',
  ideas: 'Ideias',
  carousel: 'Vozes 3D',
  grid: 'Vozes',
  favorites: 'Favoritos',
};

const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  uniqueGenders,
  uniquePitches,
  onOpenAiCasting,
  viewMode,
  onViewModeChange,
  favoritesCount,
  isDarkMode,
  toggleTheme,
  user,
  onSignOut,
  userPlan = 'free',
  usedToday = 0,
  freeDailyLimit = 5,
  bonusCredits = 0,
  isAdmin = false,
  onOpenProModal,
  onOpenAdminPanel,
  unreadIssuesCount = 0,
  onOpenNotifications,
  unreadChatCount = 0,
  onOpenChat,
  onOpenVoiceCompare,
  compareCount = 0,
  socialLinks = DEFAULT_SOCIAL_LINKS,
}) => {
  const { lang, setLang, toggleLang, bi } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const totalAlerts = unreadChatCount + (isAdmin ? unreadIssuesCount : 0);
  const viewLabels = lang === 'bn' ? VIEW_LABELS_BN : lang === 'pt' ? VIEW_LABELS_PT : VIEW_LABELS_EN;

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, gender: e.target.value });
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, pitch: e.target.value });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  const handleNavigate = (mode: AppViewMode) => {
    onViewModeChange(mode);
    setIsMenuOpen(false);
  };

  const primaryDesktopNav: { mode: AppViewMode; label: string }[] = [
    { mode: 'home', label: bi('হোম', 'Home') },
    { mode: 'studio', label: bi('ভয়েস স্টুডিও', 'Voice Studio') },
    { mode: 'voice-clone', label: bi('আমার ভয়েস (Pro)', 'My Voice (Pro)') },
    { mode: 'salon', label: bi('সেলুন', 'Salon') },
    { mode: 'ideas', label: bi('আইডিয়া', 'Ideas') },
    { mode: 'grid', label: bi('ভয়েসসমূহ', 'Voices') },
  ];

  const allMenuViews: {
    mode: AppViewMode;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { mode: 'home', label: bi('হোম', 'Home'), icon: <Home size={16} /> },
    { mode: 'studio', label: bi('ভয়েস স্টুডিও', 'Voice Studio'), icon: <AudioLines size={16} /> },
    {
      mode: 'voice-clone',
      label: bi('আমার ভয়েস (Pro)', 'My Voice (Pro)'),
      icon: <UserCheck size={16} className="text-amber-500" />,
    },
    { mode: 'salon', label: bi('জগন্নাথ সেলুন', 'Jagannath Salon'), icon: <Scissors size={16} /> },
    { mode: 'ideas', label: bi('এআই আইডিয়া', 'AI Ideas'), icon: <TrendingUp size={16} /> },
    { mode: 'grid', label: bi('ভয়েস গ্রিড', 'Voice Grid'), icon: <LayoutGrid size={16} /> },
    {
      mode: 'carousel',
      label: bi('3D ক্যারোসেল', '3D Carousel'),
      icon: <GalleryHorizontalEnd size={16} />,
    },
    {
      mode: 'favorites',
      label: bi('পছন্দসমূহ', 'Favorites'),
      icon: (
        <Heart
          size={16}
          className={
            viewMode === 'favorites' || favoritesCount > 0
              ? 'fill-current text-rose-500'
              : ''
          }
        />
      ),
      badge: favoritesCount > 0 ? favoritesCount : undefined,
    },
  ];

  return (
    <header className="relative z-50 w-full bg-white/85 dark:bg-[#0b1120]/90 backdrop-blur-xl border-b border-indigo-100/80 dark:border-indigo-950/80 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Clean Brand Wordmark (+ quiet mobile page indicator) */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
            title={bi('হোম পেজ', 'Home Page')}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-indigo-600 via-blue-600 to-amber-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20">
              <Mic size={17} className="text-white" />
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white font-display whitespace-nowrap">
              {bi('শ্রাবণ গো', 'Srabon Go')}
            </span>
          </button>
          <span
            aria-hidden="true"
            className="lg:hidden text-indigo-300 dark:text-indigo-700 text-sm"
          >
            ·
          </span>
          <span className="lg:hidden text-xs font-medium text-indigo-600 dark:text-amber-300 truncate max-w-[100px]">
            {viewLabels[viewMode]}
          </span>
        </div>

        {/* Zone 2: Clean Desktop Navigation Links (hidden on smaller screens, moved into 3-dot menu) */}
        <nav
          aria-label={bi('প্রধান নেভিগেশন', 'Primary')}
          className="hidden lg:flex items-center gap-6 text-sm font-medium"
        >
          {primaryDesktopNav.map((item) => {
            const active =
              viewMode === item.mode ||
              (item.mode === 'grid' &&
                (viewMode === 'carousel' || viewMode === 'favorites'));
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => handleNavigate(item.mode)}
                className={`whitespace-nowrap shrink-0 transition-colors underline-offset-8 ${
                  active
                    ? 'text-zinc-900 dark:text-white font-semibold underline decoration-2 decoration-indigo-600 dark:decoration-indigo-400'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:underline'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Instant বাংলা | EN Toggle + Clean Three-Dot Menu Icon */}
        <div
          ref={menuContainerRef}
          className="relative flex items-center justify-end gap-2 shrink-0"
        >
          <div
            role="group"
            aria-label={bi('ভাষা পরিবর্তন করুন', 'Switch language')}
            className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/70 shrink-0"
          >
            <button
              type="button"
              onClick={() => setLang('bn')}
              aria-pressed={lang === 'bn'}
              aria-label="বাংলা ভাষা নির্বাচন করুন"
              className={`min-h-[38px] px-2 sm:px-2.5 rounded-[10px] text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                lang === 'bn'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
              aria-label="Switch language to English"
              className={`min-h-[38px] px-2 sm:px-2.5 rounded-[10px] text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                lang === 'en'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('pt')}
              aria-pressed={lang === 'pt'}
              aria-label="Mudar idioma para Português"
              className={`min-h-[38px] px-2 sm:px-2.5 rounded-[10px] text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                lang === 'pt'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              PT
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label={bi('সকল অপশন খুলুন', 'Open options menu')}
            title={bi('সকল অপশন', 'Options')}
            className={`relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border transition-colors shrink-0 ${
              isMenuOpen
                ? 'bg-gradient-to-br from-indigo-600 to-blue-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20'
                : 'bg-indigo-50/80 dark:bg-slate-900 border-indigo-200/80 dark:border-indigo-900/70 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-slate-800'
            }`}
          >
            {isMenuOpen ? <X size={18} /> : <MoreVertical size={18} />}
            {!isMenuOpen && totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1.5 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                {totalAlerts > 99 ? '99+' : totalAlerts}
              </span>
            )}
          </button>

          {/* Three-Dot Dropdown Drawer */}
          {isMenuOpen && (
            <div
              role="menu"
              aria-label={bi('অ্যাপ্লিকেশন অপশন মেনু', 'Application options menu')}
              className="absolute right-0 top-[calc(100%+10px)] w-[min(92vw,390px)] max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl divide-y divide-zinc-100 dark:divide-zinc-800 animate-fade-in z-[90]"
            >
              {/* User Account Summary */}
              {user && (
                <div className="p-4 flex items-center gap-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || user.email || bi('ব্যবহারকারী', 'User')}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-sm font-bold flex items-center justify-center shrink-0">
                      {(user.displayName || user.email || 'U')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                      {user.displayName || bi('শ্রাবণ গো ব্যবহারকারী', 'Srabon Go User')}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {user.email}
                    </p>
                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 tabular-nums leading-relaxed">
                      {isAdmin
                        ? bi('অ্যাডমিন অ্যাক্সেস', 'Admin Access')
                        : userPlan === 'pro'
                        ? bi('প্রো প্ল্যান সক্রিয়', 'Pro Plan Active')
                        : bi(
                            `আজ ফ্রি বাকি: ${Math.max(0, freeDailyLimit - usedToday)}/${freeDailyLimit} · ${bonusCredits} ক্রেডিট`,
                            `${Math.max(0, freeDailyLimit - usedToday)}/${freeDailyLimit} Free Left · ${bonusCredits} Cr`
                          )}
                    </p>
                  </div>
                </div>
              )}

              {/* Search & Voice Filters */}
              <div className="p-4 space-y-2.5">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {bi('ভয়েস খুঁজুন ও ফিল্টার', 'Search & Filter Voices')}
                </p>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Search size={14} />
                  </div>
                  <input
                    type="text"
                    placeholder={bi('ভয়েসের নাম বা ধরন লিখুন...', 'Search voices...')}
                    value={filters.search}
                    onChange={handleSearchChange}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filters.gender}
                    onChange={handleGenderChange}
                    aria-label={bi('লিঙ্গ অনুযায়ী ফিল্টার', 'Filter by gender')}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-2 px-2.5 rounded-xl text-xs font-medium focus:outline-none"
                  >
                    <option value="All">{bi('সব লিঙ্গ', 'All Genders')}</option>
                    {uniqueGenders.map((g) => (
                      <option key={g} value={g}>
                        {localizeGender(g, lang)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filters.pitch}
                    onChange={handlePitchChange}
                    aria-label={bi('পিচ অনুযায়ী ফিল্টার', 'Filter by pitch')}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-2 px-2.5 rounded-xl text-xs font-medium focus:outline-none"
                  >
                    <option value="All">{bi('সব পিচ', 'All Pitches')}</option>
                    {uniquePitches.map((p) => (
                      <option key={p} value={p}>
                        {localizePitch(p, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pages & Views Navigation */}
              <div className="p-4 space-y-2.5">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {bi('পেজ ও ভিউ', 'Pages & Views')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {allMenuViews.map((item) => {
                    const active = viewMode === item.mode;
                    return (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => handleNavigate(item.mode)}
                        className={`min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between gap-2 transition-colors text-left leading-snug ${
                          active
                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.badge !== undefined && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-bold tabular-nums shrink-0 ${
                              active
                                ? 'bg-white/20 text-white'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tools, Chat, Pro, Admin, Language & Theme */}
              <div className="p-2.5 space-y-1">
                {onOpenVoiceCompare && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenVoiceCompare();
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <ArrowLeftRight size={16} className="text-amber-500 shrink-0" />
                      <span>{bi('ভয়েস তুলনা করুন (A বনাম B)', 'Compare Voices (A vs B)')}</span>
                    </span>
                    {compareCount > 0 && (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                        {compareCount}/2
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenAiCasting();
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Sparkles size={16} className="text-indigo-500 shrink-0" />
                    <span>{bi('এআই কাস্টিং ডিরেক্টর', 'AI Casting Director')}</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (viewMode !== 'home') {
                      onViewModeChange('home');
                    }
                    window.setTimeout(() => {
                      document
                        .getElementById('site-reviews-section')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 90);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Star size={16} className="text-amber-500 fill-amber-400 shrink-0" />
                    <span>{bi('রিভিউ ও ফিডব্যাক', 'Reviews & Feedback')}</span>
                  </span>
                </button>

                {onOpenChat && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenChat();
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <MessageSquare
                        size={16}
                        className="text-emerald-600 dark:text-emerald-400 shrink-0"
                      />
                      <span>{bi('চ্যাট', 'Chat')}</span>
                    </span>
                    {unreadChatCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white tabular-nums">
                        {unreadChatCount > 99 ? '99+' : unreadChatCount}
                      </span>
                    )}
                  </button>
                )}

                <PWAInstallButton
                  variant="menu"
                  onActionTaken={() => setIsMenuOpen(false)}
                />

                {onOpenProModal && !isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenProModal('refer');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <Gift size={16} className="text-indigo-500 shrink-0" />
                        <span>{bi('বন্ধুদের রেফার (+১০ ক্রেডিট)', 'Refer Friends (+10 Credits)')}</span>
                      </span>
                      {bonusCredits > 0 && (
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                          {bonusCredits} {bi('ক্রেডিট', 'Cr')}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenProModal('pro');
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <Crown size={16} className="text-amber-500 shrink-0" />
                        <span>
                          {userPlan === 'pro'
                            ? bi('প্রো প্ল্যান সক্রিয়', 'Pro Plan Active')
                            : bi('প্রো প্ল্যানে আপগ্রেড করুন', 'Upgrade to Pro')}
                        </span>
                      </span>
                      {userPlan !== 'pro' && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {Math.max(0, freeDailyLimit - usedToday)} {bi('বাকি', 'left')}
                        </span>
                      )}
                    </button>
                  </>
                )}

                {isAdmin && onOpenNotifications && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenNotifications();
                    }}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Bell size={16} className="text-rose-500 shrink-0" />
                      <span>{bi('অ্যাডমিন নোটিফিকেশন', 'Admin Notifications')}</span>
                    </span>
                    {unreadIssuesCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white tabular-nums">
                        {unreadIssuesCount > 99 ? '99+' : unreadIssuesCount}
                      </span>
                    )}
                  </button>
                )}

                {isAdmin && onOpenAdminPanel && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenAdminPanel();
                    }}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Shield size={16} className="text-indigo-500 shrink-0" />
                      <span>{bi('অ্যাডমিন প্যানেল', 'Admin Panel')}</span>
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleLang}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Languages size={16} className="text-indigo-500 shrink-0" />
                    <span>
                      {bi(
                        'ভাষা: বাংলা (English / Português)',
                        'Language: English (Português / বাংলা)',
                        'Idioma: Português (বাংলা / English)'
                      )}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    {isDarkMode ? (
                      <Sun size={16} className="text-amber-400 shrink-0" />
                    ) : (
                      <Moon size={16} className="text-zinc-600 shrink-0" />
                    )}
                    <span>
                      {isDarkMode
                        ? bi('লাইট মোড চালু করুন', 'Switch to Light Mode')
                        : bi('ডার্ক মোড চালু করুন', 'Switch to Dark Mode')}
                    </span>
                  </span>
                </button>

                <SocialLinksRow
                  socialLinks={socialLinks}
                  variant="drawer"
                  onLinkClick={() => setIsMenuOpen(false)}
                />

                {user && onSignOut && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <LogOut size={16} className="shrink-0" />
                    <span>{bi('সাইন আউট করুন', 'Sign Out')}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default FilterBar;