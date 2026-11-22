/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, AudioLines, Heart, Disc3, ArrowLeftRight } from 'lucide-react';
import { Voice } from '../types';
import AudioVisualizer from './AudioVisualizer';
import { isBenignAudioInterrupt } from '../utils/appIssues';
import { getVoiceAlbumVisual } from '../utils/studioAlbums';

interface VoiceCardProps {
  voice: Voice;
  isPlaying: boolean;
  onPlayToggle: (voiceName: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (voiceName: string) => void;
  onUseInStudio?: (voiceName: string) => void;
  compareSlot?: 'A' | 'B' | null;
  onToggleCompare?: (voiceName: string) => void;
}

const VoiceCard: React.FC<VoiceCardProps> = ({
  voice,
  isPlaying,
  onPlayToggle,
  isFavorite = false,
  onToggleFavorite,
  onUseInStudio,
  compareSlot = null,
  onToggleCompare,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onPlayToggleRef = useRef(onPlayToggle);
  onPlayToggleRef.current = onPlayToggle;
  const [imgError, setImgError] = useState(false);

  const visual = getVoiceAlbumVisual(voice);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;

    if (isPlaying) {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (cancelled || isBenignAudioInterrupt(err)) {
            return;
          }
          console.warn('Voice sample playback unavailable:', err);
          onPlayToggleRef.current(voice.name);
        });
      }
    } else {
      audio.pause();
      audio.currentTime = 0;
    }

    return () => {
      cancelled = true;
      audio.pause();
      audio.currentTime = 0;
    };
  }, [isPlaying, voice.audioSampleUrl, voice.name]);

  const handleAudioEnded = () => {
    if (isPlaying) {
      onPlayToggle(voice.name);
    }
  };

  const handleClick = () => {
    onPlayToggle(voice.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`group relative bg-white/95 dark:bg-[#0f172a]/95 border transition-all duration-200 flex flex-col sm:flex-row h-auto sm:h-32 cursor-pointer rounded-2xl overflow-hidden ${
        isPlaying
          ? `${visual.cardBorderActiveClass} shadow-lg`
          : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-sm hover:shadow-md'
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Play sample for ${voice.name}`}
    >
      {/* Album Artwork & Visualizer Area */}
      <div
        className={`relative h-28 sm:h-full w-full sm:w-32 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200/70 dark:border-slate-800 flex items-center justify-center overflow-hidden bg-gradient-to-br ${visual.fallbackGradientClass}`}
      >
        {!imgError ? (
          <img
            src={visual.coverImg}
            alt={`${voice.name} — ${visual.albumLabel}`}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${
              isPlaying ? 'scale-110 brightness-75' : 'group-hover:scale-105'
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            <Disc3 size={28} />
          </div>
        )}

        {/* Measured Scrim for Contrast */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            isPlaying
              ? 'bg-slate-950/60'
              : 'bg-gradient-to-t from-slate-950/65 via-slate-950/20 to-transparent'
          }`}
        />

        {/* Active Visualizer Overlay */}
        <div
          className={`absolute inset-0 z-10 transition-opacity duration-200 ${
            isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <AudioVisualizer
            isPlaying={isPlaying}
            color={
              typeof document !== 'undefined' &&
              document.documentElement.classList.contains('dark')
                ? visual.visualizerColorDark
                : visual.visualizerColorLight
            }
          />
        </div>

        {/* Play Button Overlay */}
        <div
          className={`relative z-20 flex items-center justify-center transition-all duration-200 ${
            isPlaying
              ? 'opacity-90 group-hover:opacity-100'
              : 'opacity-85 sm:opacity-75 group-hover:opacity-100 group-focus:opacity-100'
          }`}
        >
          <div className="h-10 w-10 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/40 transform transition-transform group-hover:scale-105 active:scale-95">
            {isPlaying ? (
              <Pause
                size={15}
                className="text-indigo-700 dark:text-amber-400"
                fill="currentColor"
              />
            ) : (
              <Play
                size={15}
                className="text-indigo-700 dark:text-amber-400 ml-0.5"
                fill="currentColor"
              />
            )}
          </div>
        </div>
      </div>

      {/* Content Area - Right Side */}
      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h3 className="text-lg font-serif font-medium text-slate-900 dark:text-white tracking-tight truncate">
                {voice.name}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                {voice.analysis.gender} · {voice.pitch} · {visual.albumLabel}
              </p>
            </div>

            {onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(voice.name);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                  }
                }}
                className={`p-1.5 rounded-full transition-all transform active:scale-90 shrink-0 ${
                  isFavorite
                    ? 'text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50'
                    : 'text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800'
                }`}
                aria-label={
                  isFavorite
                    ? `Remove ${voice.name} from favorites`
                    : `Add ${voice.name} to favorites`
                }
                aria-pressed={isFavorite}
                title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                <Heart size={15} className={isFavorite ? 'fill-current' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* Description + Compare & Studio quick actions */}
        <div className="flex items-end justify-between gap-2 pt-2">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-snug line-clamp-2 font-light">
            {voice.analysis.characteristics.join(', ')}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleCompare && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCompare(voice.name);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                  }
                }}
                aria-pressed={Boolean(compareSlot)}
                className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all whitespace-nowrap ${
                  compareSlot
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-amber-300'
                }`}
                title={
                  compareSlot
                    ? `Selected as Option ${compareSlot} for comparison (click to remove)`
                    : `Select ${voice.name} to compare side-by-side`
                }
              >
                <ArrowLeftRight size={11} />
                <span>{compareSlot ? `Slot ${compareSlot}` : 'Compare'}</span>
              </button>
            )}
            {onUseInStudio && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUseInStudio(voice.name);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${visual.studioButtonClass}`}
                title={`Speak script with ${voice.name}`}
              >
                <AudioLines size={12} />
                <span>Studio</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={voice.audioSampleUrl}
        onEnded={handleAudioEnded}
        preload="none"
      />
    </div>
  );
};

export default VoiceCard;