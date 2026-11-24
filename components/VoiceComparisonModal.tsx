/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Play,
  Pause,
  ArrowLeftRight,
  AudioLines,
  ChevronDown,
  Disc3,
  Heart,
  Volume2,
  ListMusic,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Voice } from '../types';
import AudioVisualizer from './AudioVisualizer';
import { getVoiceAlbumVisual } from '../utils/studioAlbums';
import { isBenignAudioInterrupt } from '../utils/appIssues';
import {
  useLanguage,
  localizeGender,
  localizePitch,
  localizeTrait,
  localizeAlbumLabel,
} from '../utils/i18n';

interface VoiceComparisonModalProps {
  voices: Voice[];
  initialVoiceA: string;
  initialVoiceB: string;
  favorites?: string[];
  onToggleFavorite?: (voiceName: string) => void;
  onUseInStudio: (voiceName: string) => void;
  onSyncPair?: (voiceA: string, voiceB: string) => void;
  onClose: () => void;
  isDarkMode?: boolean;
}

type SlotSide = 'A' | 'B';

interface SlotPlaybackState {
  currentTime: number;
  duration: number;
  error: string | null;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const VoiceComparisonModal: React.FC<VoiceComparisonModalProps> = ({
  voices,
  initialVoiceA,
  initialVoiceB,
  favorites = [],
  onToggleFavorite,
  onUseInStudio,
  onSyncPair,
  onClose,
  isDarkMode = false,
}) => {
  const { lang, bi } = useLanguage();
  const safeInitialA = useMemo(() => {
    return voices.find((v) => v.name === initialVoiceA)?.name || voices[0]?.name || '';
  }, [voices, initialVoiceA]);

  const safeInitialB = useMemo(() => {
    const candidate = voices.find(
      (v) => v.name === initialVoiceB && v.name !== safeInitialA
    );
    if (candidate) return candidate.name;
    return voices.find((v) => v.name !== safeInitialA)?.name || safeInitialA;
  }, [voices, initialVoiceB, safeInitialA]);

  const [voiceAName, setVoiceAName] = useState<string>(safeInitialA);
  const [voiceBName, setVoiceBName] = useState<string>(safeInitialB);
  const [playingSlot, setPlayingSlot] = useState<SlotSide | null>(null);
  const [sequenceActive, setSequenceActive] = useState<boolean>(false);
  const [imgErrors, setImgErrors] = useState<{ A: boolean; B: boolean }>({
    A: false,
    B: false,
  });

  const [slotProgress, setSlotProgress] = useState<{
    A: SlotPlaybackState;
    B: SlotPlaybackState;
  }>({
    A: { currentTime: 0, duration: 0, error: null },
    B: { currentTime: 0, duration: 0, error: null },
  });

  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const sequenceTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const onSyncPairRef = useRef(onSyncPair);
  onSyncPairRef.current = onSyncPair;

  const voiceA = useMemo(
    () => voices.find((v) => v.name === voiceAName) || voices[0],
    [voices, voiceAName]
  );
  const voiceB = useMemo(
    () =>
      voices.find((v) => v.name === voiceBName) ||
      voices.find((v) => v.name !== voiceA?.name) ||
      voices[0],
    [voices, voiceBName, voiceA?.name]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (sequenceTimerRef.current !== null) {
        window.clearTimeout(sequenceTimerRef.current);
      }
      audioARef.current?.pause();
      audioBRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    onSyncPairRef.current?.(voiceAName, voiceBName);
  }, [voiceAName, voiceBName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const stopAllAudio = () => {
    if (sequenceTimerRef.current !== null) {
      window.clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
    setSequenceActive(false);
    setPlayingSlot(null);
    [audioARef.current, audioBRef.current].forEach((audio) => {
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
  };

  const playSlot = async (side: SlotSide, keepSequence = false) => {
    if (sequenceTimerRef.current !== null) {
      window.clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
    if (!keepSequence) {
      setSequenceActive(false);
    }

    const targetAudio = side === 'A' ? audioARef.current : audioBRef.current;
    const otherAudio = side === 'A' ? audioBRef.current : audioARef.current;

    if (otherAudio) {
      try {
        otherAudio.pause();
        otherAudio.currentTime = 0;
      } catch {}
    }

    if (!targetAudio) return;

    setSlotProgress((prev) => ({
      ...prev,
      [side]: { ...prev[side], error: null },
    }));

    try {
      if (targetAudio.ended || targetAudio.currentTime >= (targetAudio.duration || 0) - 0.1) {
        targetAudio.currentTime = 0;
      }
      setPlayingSlot(side);
      const p = targetAudio.play();
      if (p !== undefined) {
        await p;
      }
    } catch (err: any) {
      if (!isMountedRef.current || isBenignAudioInterrupt(err)) return;
      setPlayingSlot(null);
      setSequenceActive(false);
      setSlotProgress((prev) => ({
        ...prev,
        [side]: {
          ...prev[side],
          error: bi('এই ভয়েসের অডিও স্যাম্পল লোড করা যায়নি।', 'Could not load audio sample for this voice.'),
        },
      }));
    }
  };

  const handleToggleSlot = (side: SlotSide) => {
    if (playingSlot === side) {
      stopAllAudio();
      return;
    }
    playSlot(side, false);
  };

  const handleToggleAuditionSequence = () => {
    if (sequenceActive || playingSlot !== null) {
      stopAllAudio();
      return;
    }
    if (audioARef.current) audioARef.current.currentTime = 0;
    if (audioBRef.current) audioBRef.current.currentTime = 0;
    setSequenceActive(true);
    playSlot('A', true);
  };

  const handleSwapVoices = () => {
    stopAllAudio();
    const prevA = voiceAName;
    const prevB = voiceBName;
    setVoiceAName(prevB);
    setVoiceBName(prevA);
    setImgErrors({ A: false, B: false });
    setSlotProgress({
      A: { currentTime: 0, duration: 0, error: null },
      B: { currentTime: 0, duration: 0, error: null },
    });
  };

  const handleSelectVoiceForSlot = (side: SlotSide, nextName: string) => {
    stopAllAudio();
    setImgErrors((prev) => ({ ...prev, [side]: false }));
    setSlotProgress((prev) => ({
      ...prev,
      [side]: { currentTime: 0, duration: 0, error: null },
    }));

    if (side === 'A') {
      if (nextName === voiceBName) {
        setVoiceBName(voiceAName);
      }
      setVoiceAName(nextName);
    } else {
      if (nextName === voiceAName) {
        setVoiceAName(voiceBName);
      }
      setVoiceBName(nextName);
    }
  };

  const handleSeek = (side: SlotSide, ratio: number) => {
    const audio = side === 'A' ? audioARef.current : audioBRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const nextTime = Math.max(0, Math.min(audio.duration, ratio * audio.duration));
    audio.currentTime = nextTime;
    setSlotProgress((prev) => ({
      ...prev,
      [side]: { ...prev[side], currentTime: nextTime },
    }));
  };

  const handleAudioEnded = (side: SlotSide) => {
    if (side === 'A' && sequenceActive) {
      setPlayingSlot(null);
      sequenceTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          playSlot('B', true);
        }
      }, 350);
      return;
    }
    setPlayingSlot(null);
    setSequenceActive(false);
  };

  const renderSlotPanel = (side: SlotSide, voice: Voice | undefined) => {
    if (!voice) return null;
    const visual = getVoiceAlbumVisual(voice);
    const isPlayingThis = playingSlot === side;
    const isFav = favorites.includes(voice.name);
    const prog = slotProgress[side];
    const progressPct =
      prog.duration > 0 ? Math.min(100, (prog.currentTime / prog.duration) * 100) : 0;
    const otherName = side === 'A' ? voiceBName : voiceAName;

    return (
      <section
        aria-label={bi(`ভয়েস ${side}: ${voice.name}`, `Voice ${side}: ${voice.name}`)}
        className={`flex flex-col justify-between rounded-2xl border p-5 transition-colors ${
          isPlayingThis
            ? 'bg-indigo-50/60 dark:bg-indigo-950/35 border-indigo-400 dark:border-indigo-600'
            : 'bg-slate-50/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="space-y-4">
          {/* Slot Selector Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {bi(`অপশন ${side}`, `Option ${side}`)} {isPlayingThis ? bi('· চলছে', '· Playing') : ''}
            </span>
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(voice.name)}
                className={`p-1.5 rounded-full border transition-colors ${
                  isFav
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-500'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500'
                }`}
                aria-label={isFav ? bi(`${voice.name} পছন্দ থেকে সরান`, `Remove ${voice.name} from favorites`) : bi(`${voice.name} পছন্দে রাখুন`, `Favorite ${voice.name}`)}
                aria-pressed={isFav}
              >
                <Heart size={14} className={isFav ? 'fill-current' : ''} />
              </button>
            )}
          </div>

          <div className="relative">
            <select
              aria-label={bi(`অপশন ${side}-এর ভয়েস বেছে নিন`, `Select voice for Option ${side}`)}
              value={voice.name}
              onChange={(e) => handleSelectVoiceForSlot(side, e.target.value)}
              className="appearance-none w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white py-2.5 pl-3.5 pr-9 rounded-xl text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
            >
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} — {localizeGender(v.analysis.gender, lang)}, {localizePitch(v.analysis.pitch, lang)}
                  {v.name === otherName ? bi(' (অন্য স্লটে আছে)', ' (Currently other slot)') : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <ChevronDown size={16} />
            </div>
          </div>

          {/* Album Artwork + Waveform Audio Stage */}
          <div className="relative h-36 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 flex items-center justify-center">
            {!imgErrors[side] ? (
              <img
                src={visual.coverImg}
                alt={bi(`${voice.name} স্টুডিও কভার`, `${voice.name} studio cover`)}
                referrerPolicy="no-referrer"
                onError={() => setImgErrors((prev) => ({ ...prev, [side]: true }))}
                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${
                  isPlayingThis ? 'scale-105 brightness-75' : 'brightness-90'
                }`}
              />
            ) : (
              <div
                className={`absolute inset-0 bg-gradient-to-br ${visual.fallbackGradientClass} flex items-center justify-center text-white/70`}
              >
                <Disc3 size={32} />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/20" />

            {isPlayingThis && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                <AudioVisualizer
                  isPlaying={true}
                  color={isDarkMode ? visual.visualizerColorDark : '#ffffff'}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => handleToggleSlot(side)}
              className="relative z-20 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/95 dark:bg-slate-950/90 text-slate-900 dark:text-white border border-white/40 shadow-lg hover:scale-105 active:scale-95 transition-transform text-xs font-semibold whitespace-nowrap"
              aria-label={isPlayingThis ? bi(`${voice.name} বিরতি দিন`, `Pause ${voice.name}`) : bi(`${voice.name} শুনুন`, `Play ${voice.name}`)}
            >
              {isPlayingThis ? (
                <>
                  <Pause size={14} className="text-indigo-600 dark:text-amber-400 fill-current" />
                  <span>{bi('বিরতি দিন', 'Pause Sample')}</span>
                </>
              ) : (
                <>
                  <Play size={14} className="text-indigo-600 dark:text-amber-400 fill-current ml-0.5" />
                  <span>{bi('স্যাম্পল শুনুন', 'Play Sample')}</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive Timeline Scrubber */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <span>{formatTime(prog.currentTime)}</span>
              <span>{prog.duration > 0 ? formatTime(prog.duration) : bi('স্যাম্পল ক্লিপ', 'Sample Clip')}</span>
            </div>
            <div
              role="slider"
              tabIndex={0}
              aria-label={bi(`${voice.name}-এর অডিও অগ্রগতি`, `Audio progress for ${voice.name}`)}
              aria-valuemin={0}
              aria-valuemax={Math.round(prog.duration || 100)}
              aria-valuenow={Math.round(prog.currentTime)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / Math.max(1, rect.width);
                handleSeek(side, ratio);
              }}
              className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden cursor-pointer"
            >
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-amber-500 transition-[width] duration-100"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {prog.error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5 pt-1">
                <AlertCircle size={13} className="shrink-0" />
                <span>{prog.error}</span>
              </p>
            )}
          </div>

          {/* Voice Profile Identity & Unboxed Metadata */}
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
            <h3 className="text-2xl font-serif font-medium text-slate-900 dark:text-white tracking-tight">
              {voice.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {localizeGender(voice.analysis.gender, lang)}
              <span aria-hidden="true" className="mx-1.5">·</span>
              {bi(
                `${localizePitch(voice.analysis.pitch, lang)} পিচ (${localizePitch(voice.pitch, lang)})`,
                `${localizePitch(voice.analysis.pitch, lang)} Pitch (${localizePitch(voice.pitch, lang)})`
              )}
              <span aria-hidden="true" className="mx-1.5">·</span>
              {localizeAlbumLabel(visual.albumLabel, lang)}
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {voice.analysis.characteristics.map((c) => localizeTrait(c, lang)).join(' · ')}
            </p>
          </div>
        </div>

        {/* Choose CTA */}
        <div className="pt-5 mt-5 border-t border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              stopAllAudio();
              onUseInStudio(voice.name);
            }}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all whitespace-nowrap"
          >
            <AudioLines size={15} />
            <span>{bi(`স্টুডিওর জন্য ${voice.name} বেছে নিন`, `Select ${voice.name} for Studio`)}</span>
          </button>
        </div>
      </section>
    );
  };

  const areEqualAttributes =
    voiceA &&
    voiceB && {
      sameGender: voiceA.analysis.gender === voiceB.analysis.gender,
      samePitch: voiceA.analysis.pitch === voiceB.analysis.pitch,
    };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-compare-modal-title"
    >
      <div className="absolute inset-0" onClick={onClose} />

      {/* Hidden HTML5 Audio Elements for Independent A/B Playback */}
      <audio
        ref={audioARef}
        src={voiceA?.audioSampleUrl}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) {
            setSlotProgress((prev) => ({
              ...prev,
              A: { ...prev.A, duration: d },
            }));
          }
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setSlotProgress((prev) => ({
            ...prev,
            A: { ...prev.A, currentTime: t },
          }));
        }}
        onEnded={() => handleAudioEnded('A')}
        onError={() => {
          if (playingSlot === 'A') {
            setPlayingSlot(null);
            setSequenceActive(false);
          }
          setSlotProgress((prev) => ({
            ...prev,
            A: { ...prev.A, error: bi('স্যাম্পল অডিও লোড করা যায়নি।', 'Sample audio failed to load.') },
          }));
        }}
      />
      <audio
        ref={audioBRef}
        src={voiceB?.audioSampleUrl}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) {
            setSlotProgress((prev) => ({
              ...prev,
              B: { ...prev.B, duration: d },
            }));
          }
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setSlotProgress((prev) => ({
            ...prev,
            B: { ...prev.B, currentTime: t },
          }));
        }}
        onEnded={() => handleAudioEnded('B')}
        onError={() => {
          if (playingSlot === 'B') {
            setPlayingSlot(null);
            setSequenceActive(false);
          }
          setSlotProgress((prev) => ({
            ...prev,
            B: { ...prev.B, error: bi('স্যাম্পল অডিও লোড করা যায়নি।', 'Sample audio failed to load.') },
          }));
        }}
      />

      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Modal Header */}
        <header className="px-6 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-amber-400">
              {bi('পাশাপাশি অডিশন', 'Side-by-Side Audition')}
            </p>
            <h2
              id="voice-compare-modal-title"
              className="text-xl sm:text-2xl font-serif font-medium text-slate-900 dark:text-white tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              {bi(
                `ভয়েস প্রোফাইল তুলনা (${voiceA?.name} বনাম ${voiceB?.name})`,
                `Compare Voice Profiles (${voiceA?.name} vs ${voiceB?.name})`
              )}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleAuditionSequence}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                sequenceActive
                  ? 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
              }`}
            >
              <ListMusic size={14} />
              <span>
                {sequenceActive
                  ? bi('A → B অডিশন থামান', 'Stop A → B Audition')
                  : bi('পরপর A → B শুনুন', 'Play A → B Back-to-Back')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSwapVoices}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              title={bi('অপশন A এবং B অদলবদল করুন', 'Swap Option A and Option B')}
            >
              <ArrowLeftRight size={14} />
              <span>{bi('অদলবদল', 'Swap')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopAllAudio();
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
              aria-label={bi('ভয়েস তুলনা বন্ধ করুন', 'Close voice comparison modal')}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Side-by-Side Comparison Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {renderSlotPanel('A', voiceA)}
            {renderSlotPanel('B', voiceB)}
          </div>

          {/* Attribute Comparison Table */}
          {voiceA && voiceB && (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <Volume2 size={14} className="text-indigo-600 dark:text-amber-400" />
                  <span>{bi('সরাসরি বৈশিষ্ট্য তুলনা', 'Direct Attribute Comparison')}</span>
                </div>
                {areEqualAttributes && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {areEqualAttributes.sameGender && areEqualAttributes.samePitch
                      ? bi('একই ধরনের ভোকাল রেঞ্জ — টোন ও বলার ভঙ্গিতে নজর দিন', 'Similar vocal range — focus on timbre & delivery')
                      : bi('ভিন্নধর্মী ভোকাল প্রোফাইল', 'Contrasting vocal profiles')}
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0b1120]">
                      <th className="py-2.5 px-4 font-semibold w-1/4">{bi('বৈশিষ্ট্য', 'Attribute')}</th>
                      <th className="py-2.5 px-4 font-semibold text-indigo-700 dark:text-indigo-300 w-[37.5%]">
                        {bi(`অপশন A · ${voiceA.name}`, `Option A · ${voiceA.name}`)}
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-amber-700 dark:text-amber-300 w-[37.5%]">
                        {bi(`অপশন B · ${voiceB.name}`, `Option B · ${voiceB.name}`)}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-500 dark:text-slate-400">
                        {bi('লিঙ্গ', 'Gender')}
                      </td>
                      <td className="py-2.5 px-4 font-medium">{localizeGender(voiceA.analysis.gender, lang)}</td>
                      <td className="py-2.5 px-4 font-medium">{localizeGender(voiceB.analysis.gender, lang)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-500 dark:text-slate-400">
                        {bi('পিচ রেজিস্টার', 'Pitch Register')}
                      </td>
                      <td className="py-2.5 px-4">
                        {localizePitch(voiceA.analysis.pitch, lang)} ({localizePitch(voiceA.pitch, lang)})
                      </td>
                      <td className="py-2.5 px-4">
                        {localizePitch(voiceB.analysis.pitch, lang)} ({localizePitch(voiceB.pitch, lang)})
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-500 dark:text-slate-400">
                        {bi('মূল টোন', 'Primary Tone')}
                      </td>
                      <td className="py-2.5 px-4">{localizeTrait(voiceA.characteristics[0] || '', lang)}</td>
                      <td className="py-2.5 px-4">{localizeTrait(voiceB.characteristics[0] || '', lang)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-500 dark:text-slate-400">
                        {bi('সম্পূর্ণ প্রোফাইল বৈশিষ্ট্য', 'Full Profile Traits')}
                      </td>
                      <td className="py-2.5 px-4 leading-relaxed">
                        {voiceA.analysis.characteristics.map((c) => localizeTrait(c, lang)).join(', ')}
                      </td>
                      <td className="py-2.5 px-4 leading-relaxed">
                        {voiceB.analysis.characteristics.map((c) => localizeTrait(c, lang)).join(', ')}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-500 dark:text-slate-400">
                        {bi('পছন্দের তালিকা', 'Favorites')}
                      </td>
                      <td className="py-2.5 px-4">
                        {favorites.includes(voiceA.name) ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Check size={13} /> {bi('সংরক্ষিত', 'Saved')}
                          </span>
                        ) : (
                          <span className="text-slate-400">{bi('সংরক্ষিত নয়', 'Not saved')}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {favorites.includes(voiceB.name) ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Check size={13} /> {bi('সংরক্ষিত', 'Saved')}
                          </span>
                        ) : (
                          <span className="text-slate-400">{bi('সংরক্ষিত নয়', 'Not saved')}</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceComparisonModal;
