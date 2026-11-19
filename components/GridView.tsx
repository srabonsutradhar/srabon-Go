/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Voice } from '../types';
import VoiceCard from './VoiceCard';
import AdBanner from './AdBanner';
import type { LegalTab } from './SiteLegalModal';

interface GridViewProps {
  voices: Voice[];
  playingVoice: string | null;
  onPlayToggle: (voiceName: string) => void;
  favorites?: string[];
  onToggleFavorite?: (voiceName: string) => void;
  onUseInStudio?: (voiceName: string) => void;
  onOpenLegal?: (tab: LegalTab) => void;
}

const GridView: React.FC<GridViewProps> = ({
  voices,
  playingVoice,
  onPlayToggle,
  favorites = [],
  onToggleFavorite,
  onUseInStudio,
  onOpenLegal,
}) => {
  return (
    <div className="w-full h-full overflow-y-auto scrollbar-hide">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {voices.map((voice) => (
                    <VoiceCard 
                        key={voice.name}
                        voice={voice}
                        isPlaying={playingVoice === voice.name}
                        onPlayToggle={onPlayToggle}
                        isFavorite={favorites.includes(voice.name)}
                        onToggleFavorite={onToggleFavorite}
                        onUseInStudio={onUseInStudio}
                    />
                ))}
            </div>

            <AdBanner
              slotId={import.meta.env.VITE_ADSENSE_SLOT_GRID}
              format="auto"
              className="mt-10"
            />

            <footer className="mt-12 pt-6 border-t border-zinc-200/70 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400 dark:text-zinc-500">
              <span>© 2026 Srabon Go — All Rights Reserved</span>
              {onOpenLegal && (
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => onOpenLegal('about')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">About</button>
                  <button type="button" onClick={() => onOpenLegal('privacy')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">Privacy Policy</button>
                  <button type="button" onClick={() => onOpenLegal('terms')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">Terms</button>
                  <button type="button" onClick={() => onOpenLegal('contact')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">Contact</button>
                </div>
              )}
            </footer>
        </div>
    </div>
  );
};

export default GridView;