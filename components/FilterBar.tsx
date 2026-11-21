/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { AppViewMode, FilterState, UserPlan } from '../types';
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
} from 'lucide-react';
import type { User } from 'firebase/auth';

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
}

const VIEW_LABELS: Record<AppViewMode, string> = {
  home: 'Home',
  studio: 'Voice Studio',
  salon: 'Salon',
  ideas: 'Ideas',
  carousel: '3D Voices',
  grid: 'Voices',
  favorites: 'Favorites',
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
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const totalAlerts = unreadChatCount + (isAdmin ? unreadIssuesCount : 0);

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
    { mode: 'home', label: 'Home' },
    { mode: 'studio', label: 'Voice Studio' },
    { mode: 'salon', label: 'Salon' },
    { mode: 'ideas', label: 'Ideas' },
    { mode: 'grid', label: 'Voices' },
  ];

  const allMenuViews: {
    mode: AppViewMode;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { mode: 'home', label: 'Home', icon: <Home size={16} /> },
    { mode: 'studio', label: 'Voice Studio', icon: <AudioLines size={16} /> },
    { mode: 'salon', label: 'Jagannath Salon', icon: <Scissors size={16} /> },
    { mode: 'ideas', label: 'AI Ideas', icon: <TrendingUp size={16} /> },
    { mode: 'grid', label: 'Voice Grid', icon: <LayoutGrid size={16} /> },
    {
      mode: 'carousel',
      label: '3D Carousel',
      icon: <GalleryHorizontalEnd size={16} />,
    },
    {
      mode: 'favorites',
      label: 'Favorites',
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
    <header className="relative z-50 w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Clean Brand Wordmark (+ quiet mobile page indicator) */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
            title="হোম পেজ"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-zinc-900 dark:bg-zinc-100 rounded-xl flex items-center justify-center shrink-0">
              <Mic size={17} className="text-white dark:text-zinc-900" />
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-white font-display whitespace-nowrap">
              Srabon Go
            </span>
          </button>
          <span
            aria-hidden="true"
            className="lg:hidden text-zinc-300 dark:text-zinc-700 text-sm"
          >
            ·
          </span>
          <span className="lg:hidden text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate max-w-[110px]">
            {VIEW_LABELS[viewMode]}
          </span>
        </div>

        {/* Zone 2: Clean Desktop Navigation Links (hidden on smaller screens, moved into 3-dot menu) */}
        <nav
          aria-label="Primary"
          className="hidden lg:flex items-center gap-7 text-sm font-medium"
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

        {/* Zone 3: Single Clean Three-Dot Menu Icon Containing All Other Options */}
        <div
          ref={menuContainerRef}
          className="relative flex items-center justify-end shrink-0"
        >
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label="সকল অপশন খুলুন (Open options menu)"
            title="সকল অপশন (Options)"
            className={`relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border transition-colors ${
              isMenuOpen
                ? 'bg-zinc-900 dark:bg-indigo-600 border-zinc-900 dark:border-indigo-500 text-white'
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            {isMenuOpen ? <X size={18} /> : <MoreVertical size={18} />}
            {!isMenuOpen && totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {totalAlerts > 99 ? '99+' : totalAlerts}
              </span>
            )}
          </button>

          {/* Three-Dot Dropdown Drawer */}
          {isMenuOpen && (
            <div
              role="menu"
              aria-label="অ্যাপ্লিকেশন অপশন মেনু"
              className="absolute right-0 top-[calc(100%+10px)] w-[min(92vw,360px)] max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl divide-y divide-zinc-100 dark:divide-zinc-800 animate-fade-in z-[90]"
            >
              {/* User Account Summary */}
              {user && (
                <div className="p-4 flex items-center gap-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || user.email || 'User'}
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
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                      {user.displayName || 'Srabon Go User'}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {user.email}
                    </p>
                    <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 mt-0.5 tabular-nums">
                      {isAdmin
                        ? 'Admin Access'
                        : userPlan === 'pro'
                        ? 'Pro Plan Active'
                        : `${Math.max(0, freeDailyLimit - usedToday)}/${freeDailyLimit} Free Left · ${bonusCredits} Cr`}
                    </p>
                  </div>
                </div>
              )}

              {/* Search & Voice Filters */}
              <div className="p-4 space-y-2.5">
                <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  ভয়েস খুঁজুন ও ফিল্টার
                </p>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Search size={14} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search voices..."
                    value={filters.search}
                    onChange={handleSearchChange}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filters.gender}
                    onChange={handleGenderChange}
                    aria-label="Filter by gender"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-2 px-2.5 rounded-xl text-xs font-medium focus:outline-none"
                  >
                    <option value="All">All Genders</option>
                    {uniqueGenders.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filters.pitch}
                    onChange={handlePitchChange}
                    aria-label="Filter by pitch"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-2 px-2.5 rounded-xl text-xs font-medium focus:outline-none"
                  >
                    <option value="All">All Pitches</option>
                    {uniquePitches.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pages & Views Navigation */}
              <div className="p-4 space-y-2">
                <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  পেজ ও ভিউ
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {allMenuViews.map((item) => {
                    const active = viewMode === item.mode;
                    return (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => handleNavigate(item.mode)}
                        className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between gap-2 transition-colors text-left ${
                          active
                            ? 'bg-zinc-900 dark:bg-indigo-600 text-white'
                            : 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.badge !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums shrink-0 ${
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

              {/* Tools, Chat, Pro, Admin & Theme */}
              <div className="p-2.5 space-y-1">
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
                    <span>AI Casting Director</span>
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
                      <span>চ্যাট লিস্ট ও মতামত</span>
                    </span>
                    {unreadChatCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white tabular-nums">
                        {unreadChatCount > 99 ? '99+' : unreadChatCount}
                      </span>
                    )}
                  </button>
                )}

                {onOpenProModal && !isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenProModal('refer');
                      }}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <Gift size={16} className="text-indigo-500 shrink-0" />
                        <span>Refer Friends (+10 Credits)</span>
                      </span>
                      {bonusCredits > 0 && (
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                          {bonusCredits} Cr
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenProModal('pro');
                      }}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <Crown size={16} className="text-amber-500 shrink-0" />
                        <span>
                          {userPlan === 'pro'
                            ? 'Pro Plan Active'
                            : 'Upgrade to Pro'}
                        </span>
                      </span>
                      {userPlan !== 'pro' && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {Math.max(0, freeDailyLimit - usedToday)} left
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
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Bell size={16} className="text-rose-500 shrink-0" />
                      <span>Admin Notifications</span>
                    </span>
                    {unreadIssuesCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white tabular-nums">
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
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Shield size={16} className="text-indigo-500 shrink-0" />
                      <span>Admin Panel</span>
                    </span>
                  </button>
                )}

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
                      {isDarkMode ? 'Light Mode চালু করুন' : 'Dark Mode চালু করুন'}
                    </span>
                  </span>
                </button>

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
                    <span>Sign Out</span>
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