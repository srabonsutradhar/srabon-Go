/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { Voice } from '../types';
import VoiceCard from './VoiceCard';
import AdBanner from './AdBanner';
import type { LegalTab } from './SiteLegalModal';
import { useLanguage } from '../utils/i18n';

interface GridViewProps {
  voices: Voice[];
  playingVoice: string | null;
  onPlayToggle: (voiceName: string) => void;
  favorites?: string[];
  onToggleFavorite?: (voiceName: string) => void;
  onUseInStudio?: (voiceName: string) => void;
  onOpenLegal?: (tab: LegalTab) => void;
  compareVoices?: string[];
  onToggleCompare?: (voiceName: string) => void;
  onClearCompare?: () => void;
  onOpenCompare?: () => void;
}

const GridView: React.FC<GridViewProps> = ({
  voices,
  playingVoice,
  onPlayToggle,
  favorites = [],
  onToggleFavorite,
  onUseInStudio,
  onOpenLegal,
  compareVoices = [],
  onToggleCompare,
  onClearCompare,
  onOpenCompare,
}) => {
  const { bi } = useLanguage();

  return (
    <div className="w-full h-full overflow-y-auto scrollbar-hide">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
            {/* Side-by-Side Comparison Bar */}
            {onOpenCompare && (
              <div className="rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                  <ArrowLeftRight size={16} className="text-indigo-600 dark:text-amber-400 shrink-0" />
                  {compareVoices.length === 0 ? (
                    <span>
                      {bi(
                        <>যেকোনো দুটি ভয়েস কার্ডের <strong>তুলনা</strong> বাটনে ক্লিক করে পাশাপাশি অডিশন করুন।</>,
                        <>Select any two voices using <strong>Compare</strong> on a card to audition them side-by-side.</>
                      )}
                    </span>
                  ) : compareVoices.length === 1 ? (
                    <span>
                      {bi(
                        <><strong>অপশন A:</strong> {compareVoices[0]} — আরও ১টি ভয়েস বেছে নিন, অথবা এখনই তুলনা খুলুন।</>,
                        <><strong>Option A:</strong> {compareVoices[0]} — pick 1 more voice, or open comparison now.</>
                      )}
                    </span>
                  ) : (
                    <span>
                      {bi(
                        <><strong>প্রস্তুত:</strong> {compareVoices[0]} বনাম {compareVoices[1]}</>,
                        <><strong>Ready:</strong> {compareVoices[0]} vs {compareVoices[1]}</>
                      )}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {compareVoices.length > 0 && onClearCompare && (
                    <button
                      type="button"
                      onClick={onClearCompare}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      <X size={13} />
                      <span>{bi('মুছুন', 'Clear')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenCompare}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                  >
                    <ArrowLeftRight size={13} />
                    <span>
                      {compareVoices.length === 2
                        ? bi(
                            `তুলনা করুন: ${compareVoices[0]} বনাম ${compareVoices[1]}`,
                            `Compare ${compareVoices[0]} vs ${compareVoices[1]}`
                          )
                        : bi('ভয়েস তুলনা খুলুন', 'Open Voice Comparison')}
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {voices.map((voice) => {
                    const idx = compareVoices.indexOf(voice.name);
                    const compareSlot = idx === 0 ? 'A' : idx === 1 ? 'B' : null;
                    return (
                      <VoiceCard 
                          key={voice.name}
                          voice={voice}
                          isPlaying={playingVoice === voice.name}
                          onPlayToggle={onPlayToggle}
                          isFavorite={favorites.includes(voice.name)}
                          onToggleFavorite={onToggleFavorite}
                          onUseInStudio={onUseInStudio}
                          compareSlot={compareSlot}
                          onToggleCompare={onToggleCompare}
                      />
                    );
                })}
            </div>

            <AdBanner
              slotId={import.meta.env.VITE_ADSENSE_SLOT_GRID}
              format="auto"
              className="mt-10"
            />

            <footer className="mt-12 pt-6 border-t border-zinc-200/70 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400 dark:text-zinc-500">
              <span>{bi('© ২০২৬ শ্রাবণ গো — সর্বস্বত্ব সংরক্ষিত', '© 2026 Srabon Go — All Rights Reserved')}</span>
              {onOpenLegal && (
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => onOpenLegal('about')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">{bi('আমাদের সম্পর্কে', 'About')}</button>
                  <button type="button" onClick={() => onOpenLegal('privacy')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">{bi('গোপনীয়তা নীতি', 'Privacy Policy')}</button>
                  <button type="button" onClick={() => onOpenLegal('terms')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">{bi('শর্তাবলী', 'Terms')}</button>
                  <button type="button" onClick={() => onOpenLegal('contact')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">{bi('যোগাযোগ', 'Contact')}</button>
                </div>
              )}
            </footer>
        </div>
    </div>
  );
};

export default GridView;