/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { AppViewMode, FilterState, UserPlan } from '../types';
import {
  Search,
  Sparkles,
  ChevronDown,
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
}

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
}) => {
  
  const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, gender: e.target.value });
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, pitch: e.target.value });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  return (
    <div className="relative z-50 w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 transition-colors duration-300">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-16">
            <div className="flex items-center justify-between h-full gap-2 sm:gap-4">
                
                {/* Left: Brand + AI Casting Button */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <button
                        type="button"
                        onClick={() => onViewModeChange('home')}
                        className="flex items-center gap-2 group select-none text-left"
                        title="হোম পেজ"
                    >
                        <div className="w-9 h-9 bg-zinc-900 dark:bg-zinc-100 rounded-xl flex items-center justify-center shadow-lg shadow-zinc-900/10 shrink-0">
                            <Mic size={18} className="text-white dark:text-zinc-900" />
                        </div>
                        <h1 className="hidden md:block text-lg font-bold tracking-tight text-zinc-900 dark:text-white font-display whitespace-nowrap">
                            Srabon Go
                        </h1>
                    </button>

                    <button 
                        onClick={onOpenAiCasting}
                        className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white rounded-full text-xs sm:text-sm font-medium shadow-md transition-all hover:scale-105 active:scale-95 group shrink-0"
                    >
                        <Sparkles size={14} className="text-indigo-300 dark:text-indigo-100 group-hover:text-indigo-200 transition-colors" />
                        <span className="tracking-wide hidden sm:inline">AI Casting Director</span>
                        <span className="tracking-wide sm:hidden">Casting</span>
                    </button>
                </div>

                {/* Right: Search, Filters & Actions */}
                <div className="flex items-center gap-2 justify-end min-w-0 flex-1">
                    
                    {/* Search Input (Desktop/Tablet) */}
                    <div className="relative group hidden sm:block w-full max-w-[180px] md:max-w-[200px] transition-all">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500 group-focus-within:text-zinc-600 dark:group-focus-within:text-zinc-300 transition-colors">
                            <Search size={14} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={filters.search}
                            onChange={handleSearchChange}
                            className="block w-full pl-8 pr-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 border focus:border-indigo-200 dark:focus:border-indigo-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all"
                        />
                    </div>

                    {/* Desktop Filter Dropdowns */}
                    <div className="hidden xl:flex gap-2 shrink-0">
                         <div className="relative group">
                            <select
                                value={filters.gender}
                                onChange={handleGenderChange}
                                className="appearance-none bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-1.5 pl-3 pr-8 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-all"
                            >
                                <option value="All">All Genders</option>
                                {uniqueGenders.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                                <ChevronDown size={12} />
                            </div>
                        </div>

                        <div className="relative group">
                            <select
                                value={filters.pitch}
                                onChange={handlePitchChange}
                                className="appearance-none bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-1.5 pl-3 pr-8 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-all"
                            >
                                <option value="All">All Pitches</option>
                                {uniquePitches.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                                <ChevronDown size={12} />
                            </div>
                        </div>
                    </div>

                    <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1 hidden sm:block shrink-0"></div>

                    {/* Actions Group */}
                    <div className="flex gap-1.5 sm:gap-2 shrink-0">
                        {/* View Toggle */}
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <button
                                type="button"
                                onClick={() => onViewModeChange('home')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 ${viewMode === 'home' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                                title="Home Page"
                                aria-label="Home Page"
                            >
                                <Home size={14} />
                                <span className="hidden sm:inline">Home</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onViewModeChange('studio')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 ${viewMode === 'studio' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                                title="Voice Studio (Custom TTS)"
                            >
                                <AudioLines size={14} />
                                <span className="hidden sm:inline">Studio</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onViewModeChange('ideas')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 ${viewMode === 'ideas' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                                title="AI Trending Audio Ideas"
                                aria-label="AI Trending Audio Ideas"
                            >
                                <TrendingUp size={14} />
                                <span className="hidden sm:inline">Ideas</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onViewModeChange('salon')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 ${viewMode === 'salon' ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400'}`}
                                title="Jagannath gents parlour and salon Booking"
                                aria-label="Jagannath Salon Booking"
                            >
                                <Scissors size={14} />
                                <span className="hidden sm:inline">Salon</span>
                            </button>
                            <button
                                onClick={() => onViewModeChange('carousel')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'carousel' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                                title="Carousel View"
                            >
                                <GalleryHorizontalEnd size={14} />
                            </button>
                            <button
                                onClick={() => onViewModeChange('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                                title="Grid View"
                            >
                                <LayoutGrid size={14} />
                            </button>
                            <button
                                onClick={() => onViewModeChange('favorites')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'favorites' ? 'bg-white dark:bg-zinc-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400'}`}
                                title="Favorites View"
                                aria-label={`Favorites (${favoritesCount})`}
                            >
                                <Heart size={14} className={viewMode === 'favorites' || favoritesCount > 0 ? 'fill-current text-rose-500 dark:text-rose-400' : ''} />
                                <span className="hidden sm:inline">Favorites</span>
                                {favoritesCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300">
                                    {favoritesCount}
                                  </span>
                                )}
                            </button>
                        </div>

                        {/* Pro / Refer Credits / Admin Button */}
                        {onOpenProModal && !isAdmin && (
                          <button
                            type="button"
                            onClick={() => onOpenProModal('refer')}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-semibold transition-colors"
                            title="Refer friends to earn +10 Credits each"
                          >
                            <Gift size={13} />
                            <span className="hidden lg:inline">Refer +10</span>
                            {bonusCredits > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-200/80 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                                {bonusCredits} Cr
                              </span>
                            )}
                          </button>
                        )}
                        {isAdmin && onOpenNotifications && (
                          <button
                            type="button"
                            onClick={onOpenNotifications}
                            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors shrink-0 ${
                              unreadIssuesCount > 0
                                ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                            title="Admin Issue Notification Box"
                            aria-label={`Admin Issue Notification Box (${unreadIssuesCount} unread)`}
                          >
                            <Bell size={14} />
                            {unreadIssuesCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-600 text-white tabular-nums">
                                {unreadIssuesCount > 99 ? '99+' : unreadIssuesCount}
                              </span>
                            )}
                          </button>
                        )}
                        {isAdmin && onOpenAdminPanel ? (
                          <button
                            type="button"
                            onClick={onOpenAdminPanel}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold transition-colors"
                            title="Open Admin Panel"
                          >
                            <Shield size={13} />
                            <span className="hidden md:inline">Admin</span>
                          </button>
                        ) : onOpenProModal ? (
                          <button
                            type="button"
                            onClick={() => onOpenProModal('pro')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                              userPlan === 'pro'
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-amber-300 dark:hover:border-amber-700'
                            }`}
                            title={userPlan === 'pro' ? 'Pro Plan Active' : `Free usage: ${usedToday}/${freeDailyLimit} today • Bonus: ${bonusCredits} Credits`}
                          >
                            <Crown size={13} className="text-amber-500" />
                            <span className="hidden sm:inline">
                              {userPlan === 'pro'
                                ? 'Pro'
                                : `${Math.max(0, freeDailyLimit - usedToday)} Left • Pro`}
                            </span>
                          </button>
                        ) : null}

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                        </button>

                        {/* User Avatar & Sign Out */}
                        {user && (
                          <div className="flex items-center gap-1.5 pl-1">
                            {user.photoURL ? (
                              <img
                                src={user.photoURL}
                                alt={user.displayName || user.email || 'User'}
                                title={`${user.displayName || 'Signed in'}${user.email ? ` (${user.email})` : ''}`}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 object-cover hidden sm:block"
                              />
                            ) : (
                              <div
                                title={user.email || user.displayName || 'Signed in'}
                                className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold hidden sm:flex items-center justify-center"
                              >
                                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                            {onSignOut && (
                              <button
                                onClick={onSignOut}
                                className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/50 transition-colors"
                                title="Sign Out"
                                aria-label="Sign Out"
                              >
                                <LogOut size={14} />
                              </button>
                            )}
                          </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
        
        {/* Mobile Filters Sub-bar */}
        {viewMode !== 'home' && viewMode !== 'studio' && viewMode !== 'ideas' && viewMode !== 'salon' && (
          <div className="xl:hidden border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                   <div className="relative sm:hidden flex-1 min-w-[120px]">
                      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-zinc-400">
                          <Search size={12} />
                      </div>
                      <input
                          type="text"
                          placeholder="Search..."
                          value={filters.search}
                          onChange={handleSearchChange}
                          className="w-full pl-7 pr-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                      />
                   </div>
                   <select
                      value={filters.gender}
                      onChange={handleGenderChange}
                      className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-1 px-3 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0"
                  >
                      <option value="All">All Genders</option>
                      {uniqueGenders.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select
                      value={filters.pitch}
                      onChange={handlePitchChange}
                      className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-1 px-3 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0"
                  >
                      <option value="All">All Pitches</option>
                      {uniquePitches.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
              </div>
          </div>
        )}
    </div>
  );
};

export default FilterBar;