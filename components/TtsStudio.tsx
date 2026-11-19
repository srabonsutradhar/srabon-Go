/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Loader2,
  Download,
  Repeat,
  Sparkles,
  Volume2,
  AlertCircle,
  ChevronDown,
  RotateCcw,
  Sun,
  Check,
} from 'lucide-react';
import { Voice } from '../types';
import AudioVisualizer from './AudioVisualizer';
import AdBanner from './AdBanner';
import {
  decodeBase64,
  decodeAudioToBuffer,
  createWavBlob,
  generateTtsAudio,
} from '../utils/audio';

interface TtsStudioProps {
  voices: Voice[];
  selectedVoiceName: string;
  onSelectVoice: (voiceName: string) => void;
  onBeforeGenerate?: () => Promise<boolean>;
}

const DEFAULT_SCRIPT =
  'সকাল হয়ে গেছে, আর ঘুম নয়! দ্রুত ঘুম থেকে উঠুন, আজকের পড়ার সময় শুরু হয়ে গেছে।';

const SCRIPT_PRESETS = [
  {
    id: 'morning-study-bn',
    label: 'সকালের পড়া (Wake-Up)',
    text: 'সকাল হয়ে গেছে, আর ঘুম নয়! দ্রুত ঘুম থেকে উঠুন, আজকের পড়ার সময় শুরু হয়ে গেছে।',
    style: 'Energetic, bright, motivating morning wake-up announcement in clear Bengali',
  },
  {
    id: 'gentle-morning-bn',
    label: 'শুভ সকাল (Gentle)',
    text: 'শুভ সকাল! নতুন ভোরের আলো ফুটেছে, এখনই উঠে পড়ার টেবিলে বসে পড়ুন।',
    style: 'Warm, gentle, encouraging morning greeting in Bengali',
  },
  {
    id: 'focus-reminder-bn',
    label: 'মনোযোগ রিমাইন্ডার',
    text: 'বিরতি শেষ! চলুন আবার পূর্ণ মনোযোগ দিয়ে আজকের অধ্যায়টা শেষ করি।',
    style: 'Clear, calm, focused study coach in Bengali',
  },
  {
    id: 'english-alarm',
    label: 'Morning Study (EN)',
    text: "Good morning! It's time to wake up, grab some water, and start today's study session.",
    style: 'Upbeat, energizing morning study coach',
  },
];

const STYLE_PRESETS = [
  {
    id: 'alarm',
    label: 'Energetic Morning Alarm',
    value: 'Energetic, bright, motivating morning wake-up announcement with crisp articulation',
  },
  {
    id: 'warm',
    label: 'Warm & Gentle',
    value: 'Warm, soothing, encouraging mentor tone',
  },
  {
    id: 'coach',
    label: 'Firm Study Coach',
    value: 'Firm, confident, disciplined coach urging immediate action',
  },
  {
    id: 'calm',
    label: 'Calm & Clear',
    value: 'Natural, calm, steady conversational narrator',
  },
];

const TtsStudio: React.FC<TtsStudioProps> = ({
  voices,
  selectedVoiceName,
  onSelectVoice,
  onBeforeGenerate,
}) => {
  const [text, setText] = useState(DEFAULT_SCRIPT);
  const [style, setStyle] = useState(STYLE_PRESETS[0].value);
  const [isLooping, setIsLooping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedKey, setCachedKey] = useState<string | null>(null);
  const [cachedBytes, setCachedBytes] = useState<Uint8Array | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const isLoopingRef = useRef(isLooping);
  const activeRunIdRef = useRef(0);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPlayback();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  const currentVoice =
    voices.find((v) => v.name === selectedVoiceName) || voices[0];

  const requestKey = `${selectedVoiceName}::${style.trim()}::${text.trim()}`;

  const clearLoopTimer = () => {
    if (loopTimerRef.current !== null) {
      window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  };

  const stopPlayback = () => {
    activeRunIdRef.current += 1;
    clearLoopTimer();
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
      } catch {}
      sourceNodeRef.current = null;
    }
    if (isMountedRef.current) {
      setIsPlaying(false);
    }
  };

  const playBytes = async (bytes: Uint8Array, runId: number) => {
    if (!isMountedRef.current || activeRunIdRef.current !== runId) return;

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({ sampleRate: 24000 });
    } else if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const audioBuffer = await decodeAudioToBuffer(
      bytes,
      audioContextRef.current,
      24000
    );

    if (!isMountedRef.current || activeRunIdRef.current !== runId) return;

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      if (!isMountedRef.current || activeRunIdRef.current !== runId) return;
      if (isLoopingRef.current) {
        loopTimerRef.current = window.setTimeout(() => {
          if (isMountedRef.current && activeRunIdRef.current === runId && isLoopingRef.current) {
            playBytes(bytes, runId).catch((err) => {
              console.error('Loop replay error:', err);
              if (isMountedRef.current) setIsPlaying(false);
            });
          }
        }, 1200);
      } else {
        setIsPlaying(false);
      }
    };

    sourceNodeRef.current = source;
    source.start();
    setIsPlaying(true);
  };

  const handleGenerateAndPlay = async () => {
    if (isLoading) return;
    if (isPlaying) {
      stopPlayback();
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setError('Please enter text to speak.');
      return;
    }

    const runId = ++activeRunIdRef.current;
    setError(null);

    if (cachedBytes && cachedKey === requestKey) {
      try {
        await playBytes(cachedBytes, runId);
      } catch (err: any) {
        console.error('Playback error:', err);
        setError(err?.message || 'Playback failed. Please try again.');
        setIsPlaying(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      if (onBeforeGenerate) {
        const allowed = await onBeforeGenerate();
        if (!allowed) return;
      }

      const { audioData } = await generateTtsAudio({
        text: trimmed,
        voiceName: currentVoice?.name || 'Kore',
        style: style.trim(),
      });

      if (!isMountedRef.current || activeRunIdRef.current !== runId) return;

      const bytes = decodeBase64(audioData);
      setCachedBytes(bytes);
      setCachedKey(requestKey);

      await playBytes(bytes, runId);
    } catch (err: any) {
      console.error('TTS Studio Error:', err);
      if (isMountedRef.current && activeRunIdRef.current === runId) {
        setError(err?.message || 'Failed to generate speech. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleDownloadWav = async () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    let bytesToDownload = cachedBytes && cachedKey === requestKey ? cachedBytes : null;
    if (!bytesToDownload) {
      setIsLoading(true);
      setError(null);
      try {
        if (onBeforeGenerate) {
          const allowed = await onBeforeGenerate();
          if (!allowed) return;
        }

        const { audioData } = await generateTtsAudio({
          text: trimmed,
          voiceName: currentVoice?.name || 'Kore',
          style: style.trim(),
        });
        bytesToDownload = decodeBase64(audioData);
        if (isMountedRef.current) {
          setCachedBytes(bytesToDownload);
          setCachedKey(requestKey);
        }
      } catch (err: any) {
        console.error('Download TTS Error:', err);
        if (isMountedRef.current) {
          setError(err?.message || 'Failed to generate audio for download.');
        }
        return;
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    }

    const blob = createWavBlob(bytesToDownload, 24000);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-${(currentVoice?.name || 'voice').toLowerCase()}-speech.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    window.setTimeout(() => {
      if (isMountedRef.current) setDownloaded(false);
    }, 2000);
  };

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xl overflow-hidden">
          {/* Top Studio Banner */}
          <div className="px-6 sm:px-8 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-indigo-50/60 via-white to-amber-50/40 dark:from-indigo-950/30 dark:via-zinc-900 dark:to-zinc-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Sun size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">
                  Voice Studio • Multilingual TTS
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-zinc-900 dark:text-white">
                Speak any script aloud
              </h2>
            </div>

            {/* Active Voice Quick Pill */}
            {currentVoice && (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm self-start sm:self-auto">
                <div className={`w-2 h-2 rounded-full ${isPlaying ? 'animate-google-colors' : 'bg-indigo-500'}`} />
                <div className="text-xs">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {currentVoice.name}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-500 mx-1.5">•</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {currentVoice.analysis.gender}, {currentVoice.pitch}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            {/* Left Column: Script & Delivery Style */}
            <div className="lg:col-span-7 space-y-5">
              {/* Quick Presets */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Quick Scripts
                </span>
                <div className="flex flex-wrap gap-2">
                  {SCRIPT_PRESETS.map((preset) => {
                    const isActive = text.trim() === preset.text;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          stopPlayback();
                          setText(preset.text);
                          setStyle(preset.style);
                          setError(null);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isActive
                            ? 'bg-zinc-900 dark:bg-indigo-600 text-white border-zinc-900 dark:border-indigo-500 shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Script Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="tts-script-input"
                    className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                  >
                    Script Text (বাংলা, English, or any language)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      stopPlayback();
                      setText(DEFAULT_SCRIPT);
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    title="Reset to morning study prompt"
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                </div>

                <textarea
                  id="tts-script-input"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError(null);
                  }}
                  rows={4}
                  placeholder="Enter or paste text in Bengali, English, or any language..."
                  className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 p-4 text-lg sm:text-xl leading-relaxed text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-400 dark:focus:border-indigo-600 transition-all resize-none"
                />
                <div className="flex justify-between items-center text-xs text-zinc-400 dark:text-zinc-500 px-1">
                  <span>Supports expressive multilingual synthesis</span>
                  <span>{text.length} chars</span>
                </div>
              </div>

              {/* Delivery Style Direction */}
              <div className="space-y-2.5">
                <label
                  htmlFor="tts-style-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                >
                  Delivery Tone & Style
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_PRESETS.map((preset) => {
                    const selected = style === preset.value;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setStyle(preset.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  id="tts-style-input"
                  type="text"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  placeholder="Optional vocal direction (e.g. Cheerful morning host)..."
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                />
              </div>
            </div>

            {/* Right Column: Voice Selection, Visualizer, Play & Alarm Controls */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-5">
              {/* Voice Picker Card */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
                <label
                  htmlFor="studio-voice-select"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                >
                  Select Voice Talent
                </label>
                <div className="relative">
                  <select
                    id="studio-voice-select"
                    value={currentVoice?.name || ''}
                    onChange={(e) => {
                      stopPlayback();
                      onSelectVoice(e.target.value);
                    }}
                    disabled={isLoading}
                    className="appearance-none w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white py-2.5 pl-3.5 pr-10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 cursor-pointer"
                  >
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} — {v.analysis.gender}, {v.pitch} ({v.characteristics[0]})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
                {currentVoice && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {currentVoice.analysis.characteristics.join(' • ')}
                  </p>
                )}
              </div>

              {/* Acoustic Waveform Stage */}
              <div
                onClick={handleGenerateAndPlay}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleGenerateAndPlay();
                  }
                }}
                aria-label={isPlaying ? 'Stop speech playback' : 'Generate and play speech'}
                className={`relative h-36 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 overflow-hidden flex items-center justify-center transition-colors ${
                  isLoading ? 'cursor-wait' : 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                <div
                  className="absolute inset-0 opacity-[0.05] dark:opacity-[0.1]"
                  style={{
                    backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
                    backgroundSize: '10px 10px',
                  }}
                />

                {isLoading ? (
                  <div className="flex flex-col items-center gap-2 text-indigo-600 dark:text-indigo-400 z-10">
                    <Loader2 size={28} className="animate-spin" />
                    <span className="text-xs font-medium tracking-wide">
                      Synthesizing speech...
                    </span>
                  </div>
                ) : isPlaying ? (
                  <div className="w-full h-full z-10">
                    <AudioVisualizer
                      isPlaying={true}
                      color={
                        document.documentElement.classList.contains('dark')
                          ? '#a5b4fc'
                          : '#18181b'
                      }
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-500 z-10">
                    <div className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center">
                      <Volume2 size={20} className="text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <span className="text-xs font-medium">
                      Click to generate & listen
                    </span>
                  </div>
                )}

                {error && (
                  <div className="absolute inset-0 bg-white/95 dark:bg-zinc-950/95 p-4 flex items-center justify-center gap-2 text-red-600 dark:text-red-400 text-xs text-center z-20">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGenerateAndPlay}
                  disabled={isLoading || !text.trim()}
                  className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-[0.99] shadow-lg ${
                    isPlaying
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 shadow-none'
                      : 'bg-zinc-900 dark:bg-indigo-600 text-white hover:bg-zinc-800 dark:hover:bg-indigo-500 shadow-zinc-900/10 dark:shadow-indigo-900/30'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : isPlaying ? (
                    <Square size={18} className="fill-current" />
                  ) : (
                    <Play size={18} className="fill-current" />
                  )}
                  <span>
                    {isLoading
                      ? 'Generating Audio...'
                      : isPlaying
                      ? 'Stop Speaking'
                      : 'Generate & Speak'}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsLooping((prev) => !prev)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors ${
                      isLooping
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                    }`}
                    title="Repeat continuously like a wake-up alarm"
                  >
                    <Repeat size={14} />
                    <span>{isLooping ? 'Alarm Loop On' : 'Alarm Loop'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadWav}
                    disabled={isLoading || !text.trim()}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloaded ? (
                      <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Download size={14} />
                    )}
                    <span>{downloaded ? 'Saved WAV' : 'Download WAV'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 pt-1">
                  <Sparkles size={12} className="text-indigo-500" />
                  <span>Powered by Gemini 3.8 Flash Lite TTS</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AdBanner
          slotId={import.meta.env.VITE_ADSENSE_SLOT_STUDIO}
          format="horizontal"
          className="mt-6"
        />

        <p className="mt-6 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          © 2026 Srabon Go — All Rights Reserved
        </p>
      </div>
    </div>
  );
};

export default TtsStudio;
