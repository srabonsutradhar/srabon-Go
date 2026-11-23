/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { Search, Sparkles, SlidersHorizontal, Loader2, X, Check, LayoutGrid, GalleryHorizontalEnd } from 'lucide-react';
import { FilterState } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage, localizeGender, localizePitch } from '../utils/i18n';

interface ControlBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onAiSearch: (query: string) => void;
  isAiLoading: boolean;
  uniqueGenders: string[];
  uniquePitches: string[];
  hasActiveAiResult: boolean;
  onClearAiResult: () => void;
  viewMode: 'carousel' | 'grid';
  onViewModeChange: (mode: 'carousel' | 'grid') => void;
}

const ControlBar: React.FC<ControlBarProps> = ({
  filters,
  onFilterChange,
  onAiSearch,
  isAiLoading,
  uniqueGenders,
  uniquePitches,
  hasActiveAiResult,
  onClearAiResult,
  viewMode,
  onViewModeChange
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const { lang, bi } = useLanguage();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isFiltersOpen) {
      setIsFiltersOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      if (filters.search.length > 5) {
         onAiSearch(filters.search);
      }
    }
  };

  return (
    <div className="fixed bottom-8 left-0 right-0 z-50 flex flex-col items-center justify-end px-4 pointer-events-none">
      
      {/* Filters Popover */}
      <AnimatePresence>
        {isFiltersOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xl rounded-2xl p-4 w-full max-w-sm pointer-events-auto"
          >
             <div className="space-y-4">
                <div>
                   <label className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 block">{bi('লিঙ্গ', 'Gender')}</label>
                   <div className="flex flex-wrap gap-2">
                      <button 
                        type="button"
                        onClick={() => onFilterChange({...filters, gender: 'All'})}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.gender === 'All' ? 'bg-zinc-900 dark:bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                      >
                        {bi('সব', 'All')}
                      </button>
                      {uniqueGenders.map(g => (
                        <button 
                            type="button"
                            key={g}
                            onClick={() => onFilterChange({...filters, gender: g})}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.gender === g ? 'bg-zinc-900 dark:bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                        >
                            {localizeGender(g, lang)}
                        </button>
                      ))}
                   </div>
                </div>
                <div>
                   <label className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 block">{bi('পিচ', 'Pitch')}</label>
                   <div className="flex flex-wrap gap-2">
                      <button 
                        type="button"
                        onClick={() => onFilterChange({...filters, pitch: 'All'})}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.pitch === 'All' ? 'bg-zinc-900 dark:bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                      >
                        {bi('সব', 'All')}
                      </button>
                      {uniquePitches.map(p => (
                        <button 
                            type="button"
                            key={p}
                            onClick={() => onFilterChange({...filters, pitch: p})}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.pitch === p ? 'bg-zinc-900 dark:bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                        >
                            {localizePitch(p, lang)}
                        </button>
                      ))}
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Bar */}
      <div className="pointer-events-auto flex items-center gap-2 p-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-zinc-200/80 dark:border-zinc-700/80 shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-full w-full max-w-xl transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)]">
        
        {/* View Mode Toggle */}
        <button
          type="button"
          onClick={() => onViewModeChange(viewMode === 'carousel' ? 'grid' : 'carousel')}
          className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-all text-zinc-500 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
          title={viewMode === 'carousel' ? bi('গ্রিড ভিউতে যান', 'Switch to Grid View') : bi('ক্যারোসেল ভিউতে যান', 'Switch to Carousel View')}
          aria-label={viewMode === 'carousel' ? bi('গ্রিড ভিউতে যান', 'Switch to Grid View') : bi('ক্যারোসেল ভিউতে যান', 'Switch to Carousel View')}
        >
          {viewMode === 'carousel' ? <LayoutGrid size={18} /> : <GalleryHorizontalEnd size={18} />}
        </button>

        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

        {/* Filter Toggle */}
        <button
          type="button"
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-all ${isFiltersOpen ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          aria-label={bi('ফিল্টার খুলুন', 'Toggle filters')}
        >
          <SlidersHorizontal size={18} />
        </button>

        {/* Input */}
        <div className="flex-1 relative h-full flex items-center">
            <input 
                type="text" 
                value={filters.search}
                onChange={(e) => onFilterChange({...filters, search: e.target.value})}
                onKeyDown={handleKeyDown}
                placeholder={hasActiveAiResult ? bi('সুপারিশকৃত ভয়েস দেখানো হচ্ছে...', 'Viewing recommendations...') : bi('বৈশিষ্ট্য, পিচ বা ভয়েস খুঁজুন...', 'Search characteristics, pitch...')}
                className="w-full bg-transparent border-none focus:ring-0 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 font-medium text-base h-full py-2 px-2"
            />
            {hasActiveAiResult && (
                <button type="button" onClick={onClearAiResult} aria-label={bi('ফলাফল মুছুন', 'Clear AI result')} className="absolute right-0 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300">
                    <X size={14} />
                </button>
            )}
        </div>

        {/* AI Action Button */}
        <button
            type="button"
            onClick={() => onAiSearch(filters.search)}
            disabled={isAiLoading || (!filters.search && !hasActiveAiResult)}
            className={`h-10 px-4 rounded-full flex items-center gap-2 font-medium text-sm transition-all duration-300 whitespace-nowrap ${
                isAiLoading 
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-wait' 
                : hasActiveAiResult
                    ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60'
                    : filters.search.length > 0 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95' 
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
        >
            {isAiLoading ? (
                <Loader2 size={18} className="animate-spin" />
            ) : hasActiveAiResult ? (
                <>
                    <Check size={18} />
                    <span>{bi('মিলেছে', 'Matched')}</span>
                </>
            ) : (
                <>
                    <Sparkles size={18} className={filters.search.length > 0 ? "text-yellow-200" : ""} />
                    <span>{bi('এআই ম্যাচ', 'AI Match')}</span>
                </>
            )}
        </button>

      </div>
    </div>
  );
};

export default ControlBar;