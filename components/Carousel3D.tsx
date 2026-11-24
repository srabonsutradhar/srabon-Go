/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Voice } from '../types';
import { Play, Pause, ChevronLeft, ChevronRight, AudioLines, Heart, ArrowLeftRight } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import { isBenignAudioInterrupt } from '../utils/appIssues';
import { getVoiceAlbumVisual } from '../utils/studioAlbums';
import {
  useLanguage,
  localizeGender,
  localizePitch,
  localizeTrait,
  localizeAlbumLabel,
} from '../utils/i18n';

interface Carousel3DProps {
  voices: Voice[];
  activeIndex: number;
  onChange: (index: number) => void;
  playingVoice: string | null;
  onPlayToggle: (voiceName: string) => void;
  favorites?: string[];
  onToggleFavorite?: (voiceName: string) => void;
  onUseInStudio?: (voiceName: string) => void;
  compareVoices?: string[];
  onToggleCompare?: (voiceName: string) => void;
  disabled?: boolean;
  isDarkMode?: boolean;
}

const Carousel3D: React.FC<Carousel3DProps> = ({ 
  voices, 
  activeIndex, 
  onChange,
  playingVoice,
  onPlayToggle,
  favorites = [],
  onToggleFavorite,
  onUseInStudio,
  compareVoices = [],
  onToggleCompare,
  disabled = false,
  isDarkMode = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onPlayToggleRef = useRef(onPlayToggle);
  onPlayToggleRef.current = onPlayToggle;
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const { lang, bi } = useLanguage();

  const playingSampleUrl = playingVoice
    ? voices.find((v) => v.name === playingVoice)?.audioSampleUrl || null
    : null;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;
    audio.pause();
    audio.currentTime = 0;

    if (playingVoice && playingSampleUrl) {
      audio.src = playingSampleUrl;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (cancelled || isBenignAudioInterrupt(err)) {
            return;
          }
          console.warn('Carousel sample playback unavailable:', err);
          onPlayToggleRef.current(playingVoice);
        });
      }
    }

    return () => {
      cancelled = true;
      audio.pause();
      audio.currentTime = 0;
    };
  }, [playingVoice, playingSampleUrl]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Only trigger if no modal is open
        if (disabled) return;
        
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowLeft') {
            handlePrev();
        } else if (e.key === 'ArrowRight') {
            handleNext();
        } else if (e.key === 'Enter' || e.key === ' ') {
            // Play active
            const activeVoice = voices[activeIndex];
            if (activeVoice) {
              onPlayToggle(activeVoice.name);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, voices, disabled]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled) return;
    const threshold = 50;
    if (info.offset.x > threshold && activeIndex > 0) {
      onChange(activeIndex - 1);
    } else if (info.offset.x < -threshold && activeIndex < voices.length - 1) {
      onChange(activeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) onChange(activeIndex - 1);
  };

  const handleNext = () => {
    if (activeIndex < voices.length - 1) onChange(activeIndex + 1);
  };

  const handleAudioEnded = () => {
     if (playingVoice) onPlayToggle(playingVoice);
  };

  const visibleRange = 3; 

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      
      <audio ref={audioRef} onEnded={handleAudioEnded} preload="none" />

      {/* Navigation Arrows */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 sm:px-12 z-50 pointer-events-none">
        <button 
            onClick={handlePrev}
            disabled={activeIndex === 0 || disabled}
            className={`p-4 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md shadow-lg border border-white/50 dark:border-zinc-700/50 text-zinc-800 dark:text-zinc-200 transition-all hover:scale-110 active:scale-95 pointer-events-auto ${activeIndex === 0 ? 'opacity-0 cursor-default' : 'opacity-100 hover:bg-white dark:hover:bg-zinc-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={bi('আগের ভয়েস', 'Previous voice')}
        >
            <ChevronLeft size={24} />
        </button>
        <button 
            onClick={handleNext}
            disabled={activeIndex === voices.length - 1 || disabled}
            className={`p-4 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md shadow-lg border border-white/50 dark:border-zinc-700/50 text-zinc-800 dark:text-zinc-200 transition-all hover:scale-110 active:scale-95 pointer-events-auto ${activeIndex === voices.length - 1 ? 'opacity-0 cursor-default' : 'opacity-100 hover:bg-white dark:hover:bg-zinc-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={bi('পরের ভয়েস', 'Next voice')}
        >
            <ChevronRight size={24} />
        </button>
      </div>

      <div 
        ref={containerRef} 
        className="relative w-full h-[70vh] flex items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        <div className="relative w-full h-full flex items-center justify-center transform-style-3d">
          <AnimatePresence initial={false}>
            {voices.map((voice, index) => {
              if (Math.abs(index - activeIndex) > visibleRange) return null;

              const isActive = index === activeIndex;
              const offset = index - activeIndex;
              const isPlaying = playingVoice === voice.name;
              
              const zIndex = 100 - Math.abs(offset);
              const isMobile = windowWidth < 640;
              
              let x = 0;
              if (isMobile) {
                  const mobileSpacing = windowWidth * 0.75;
                  x = offset * mobileSpacing;
              } else {
                  const baseGap = 280; 
                  const stackStep = 45; 
                  if (offset !== 0) {
                      x = Math.sign(offset) * (baseGap + (Math.abs(offset) - 1) * stackStep);
                  }
              }

              const visual = getVoiceAlbumVisual(voice);

              return (
                <motion.div
                  key={voice.name}
                  className={`absolute w-[300px] sm:w-[360px] aspect-[3/4] bg-white dark:bg-[#0f172a] rounded-3xl border overflow-hidden cursor-pointer ${
                    isPlaying
                      ? `${visual.cardBorderActiveClass} shadow-2xl`
                      : isActive
                      ? 'border-indigo-200/80 dark:border-indigo-800/80 shadow-2xl'
                      : 'border-slate-200 dark:border-slate-800 shadow-lg'
                  }`}
                  style={{ zIndex }}
                  initial={{ scale: 0.8, opacity: 0, x: offset * 200 }}
                  animate={{ 
                    scale: isActive ? 1 : 0.85, 
                    opacity: 1, 
                    x,
                    z: isActive ? 0 : -100 - (Math.abs(offset) * 30), 
                    rotateY: offset * -15, 
                    filter: isActive ? 'blur(0px)' : 'blur(0.5px)'
                  }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  onClick={() => {
                      if (disabled) return;
                      if (isActive) {
                          onPlayToggle(voice.name);
                      } else {
                          onChange(index);
                      }
                  }}
                  drag={isActive && !disabled ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={handleDragEnd}
                  whileHover={isActive && !disabled ? { scale: 1.02 } : {}}
                  role="button"
                  tabIndex={isActive && !disabled ? 0 : -1}
                  aria-label={bi(
                    `${voice.name} ভয়েস কার্ড। ${isActive ? 'শুনতে এন্টার চাপুন।' : 'নির্বাচন করতে ক্লিক করুন।'}`,
                    `Voice card for ${voice.name}. ${isActive ? 'Press Enter to play.' : 'Click to select.'}`
                  )}
                >
                  {/* Fader Overlay for Inactive Cards */}
                  <motion.div 
                    animate={{ opacity: isActive ? 0 : 0.55 }}
                    className="absolute inset-0 bg-slate-950/60 dark:bg-slate-950/75 z-40 pointer-events-none"
                  />

                  <div className="h-full flex flex-col relative">
                      <div className={`flex-1 relative bg-gradient-to-br ${visual.fallbackGradientClass} flex items-center justify-center overflow-hidden`}>
                          <img
                            src={visual.coverImg}
                            alt={`${voice.name} album art`}
                            referrerPolicy="no-referrer"
                            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${
                              isPlaying ? 'scale-110 brightness-75' : 'scale-100'
                            }`}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
                          
                          <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                              <AudioVisualizer isPlaying={isPlaying} color={isDarkMode ? visual.visualizerColorDark : visual.visualizerColorLight} />
                          </div>

                          <div className={`relative z-20 flex items-center justify-center transition-all duration-200 ${isPlaying ? 'opacity-95' : 'opacity-85 hover:opacity-100'}`}>
                               <div className="w-16 h-16 rounded-full bg-white/95 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center shadow-xl border border-white/40 transform transition-transform hover:scale-105 active:scale-95">
                                  {isPlaying ? (
                                      <Pause size={26} className="text-indigo-700 dark:text-amber-400 fill-current" />
                                  ) : (
                                      <Play size={26} className="text-indigo-700 dark:text-amber-400 fill-current ml-1" />
                                  )}
                               </div>
                          </div>

                          <div className="absolute bottom-3 left-5 z-20 text-xs font-medium text-white/90 tracking-wide">
                            {localizeAlbumLabel(visual.albumLabel, lang)}
                          </div>
                      </div>

                      <div className="h-[42%] p-6 sm:p-7 flex flex-col justify-between bg-white dark:bg-[#0f172a] relative z-30">
                          <div>
                              <div className="flex items-center justify-between mb-1.5">
                                  <h2 className="text-3xl sm:text-4xl font-serif text-slate-900 dark:text-white tracking-tight">{voice.name}</h2>
                                  <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-indigo-600 dark:text-amber-300">
                                          {localizeGender(voice.analysis.gender, lang)}
                                      </span>
                                      {onToggleFavorite && (
                                        <button
                                          type="button"
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleFavorite(voice.name);
                                          }}
                                          className={`p-1.5 rounded-full border transition-all transform active:scale-90 ${
                                            favorites.includes(voice.name)
                                              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-500 dark:text-rose-400'
                                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400'
                                          }`}
                                          aria-label={favorites.includes(voice.name) ? bi(`${voice.name} পছন্দ থেকে সরান`, `Remove ${voice.name} from favorites`) : bi(`${voice.name} পছন্দে যোগ করুন`, `Add ${voice.name} to favorites`)}
                                          aria-pressed={favorites.includes(voice.name)}
                                          title={favorites.includes(voice.name) ? bi('পছন্দ থেকে সরান', 'Remove from Favorites') : bi('পছন্দে যোগ করুন', 'Add to Favorites')}
                                        >
                                          <Heart size={16} className={favorites.includes(voice.name) ? 'fill-current' : ''} />
                                        </button>
                                      )}
                                  </div>
                              </div>
                              <div className="flex flex-wrap gap-2 mb-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-light">
                                  <span>{bi(`${localizePitch(voice.pitch, lang)} পিচ`, `${localizePitch(voice.pitch, lang)} Pitch`)}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{localizeTrait(voice.analysis.characteristics[0] || '', lang)}</span>
                              </div>
                          </div>
                          
                          <div className="space-y-3">
                              <div className="w-full h-px bg-slate-100 dark:bg-slate-800"></div>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-light leading-relaxed line-clamp-2">
                                    {voice.analysis.characteristics.map((c) => localizeTrait(c, lang)).join(', ')}
                                </p>
                                {isActive && (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {onToggleCompare && (
                                      <button
                                        type="button"
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onToggleCompare(voice.name);
                                        }}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                                          compareVoices.includes(voice.name)
                                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                        }`}
                                        title={bi('পাশাপাশি তুলনা করুন', 'Compare side-by-side')}
                                      >
                                        <ArrowLeftRight size={12} />
                                        <span>
                                          {compareVoices[0] === voice.name
                                            ? bi('স্লট A', 'Slot A')
                                            : compareVoices[1] === voice.name
                                            ? bi('স্লট B', 'Slot B')
                                            : bi('তুলনা', 'Compare')}
                                        </span>
                                      </button>
                                    )}
                                    {onUseInStudio && (
                                      <button
                                        type="button"
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onUseInStudio(voice.name);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                                      >
                                        <AudioLines size={12} />
                                        <span>{bi('বলান', 'Speak')}</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                          </div>
                      </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Carousel3D;