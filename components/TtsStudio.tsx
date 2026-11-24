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
  TrendingUp,
  Crown,
  CheckCircle2,
  CalendarDays,
  Shield,
  Lock,
  Bookmark,
  Trash2,
  Gauge,
  Zap,
  Timer,
  Mic,
  UserCheck,
  ArrowRight,
  ArrowLeftRight,
} from 'lucide-react';
import { BillingConfig, CustomVoiceProfile, ProPackageType, UserPlan, Voice } from '../types';
import AudioVisualizer from './AudioVisualizer';
import AdBanner from './AdBanner';
import type { LegalTab } from './SiteLegalModal';
import {
  decodeBase64,
  decodeAudioToBuffer,
  createWavBlob,
  generateTtsAudio,
  checkBackendHealth,
} from '../utils/audio';
import { reportAppIssue } from '../utils/appIssues';
import {
  STUDIO_ALARM_DELAYS_MS,
  STUDIO_PLAYBACK_SPEEDS,
  STUDIO_STYLE_PRESETS,
  STUDIO_TIER_LIMITS,
  SavedStudioScript,
  getStudioCapabilities,
  loadSavedStudioScripts,
  persistSavedStudioScripts,
  resolveStudioTier,
} from '../utils/studioTiers';
import { getVoiceAlbumVisual } from '../utils/studioAlbums';
import { renderCalibratedAudioBytes } from '../utils/voiceClone';
import {
  analyzeScriptSmart,
  inspectAudioSmart,
  SmartAudioInspection,
  SmartScriptAnalysis,
} from '../utils/smartEngine';
import {
  localizeDate,
  localizeGender,
  localizePitch,
  localizeStudioPresetLabel,
  localizeTrait,
  useLanguage,
} from '../utils/i18n';

interface TtsStudioProps {
  voices: Voice[];
  selectedVoiceName: string;
  onSelectVoice: (voiceName: string) => void;
  onBeforeGenerate?: () => Promise<boolean>;
  onOpenLegal?: (tab: LegalTab) => void;
  incomingDraft?: { text: string; style: string; revision: number } | null;
  onOpenIdeas?: () => void;
  isAdmin?: boolean;
  userId?: string;
  isDarkMode?: boolean;
  apiBaseUrl?: string;
  billingConfig?: BillingConfig;
  userPlan?: UserPlan;
  proPackageType?: ProPackageType | null;
  proExpiresAtMs?: number | null;
  usedToday?: number;
  bonusCredits?: number;
  onOpenUpgradePackage?: (pkg: ProPackageType) => void;
  onOpenAdminSettings?: () => void;
  customVoices?: CustomVoiceProfile[];
  selectedCustomVoiceId?: string | null;
  onSelectCustomVoice?: (profileId: string | null) => void;
  onOpenVoiceCloneTool?: () => void;
  onOpenVoiceCompare?: () => void;
}

const DEFAULT_SCRIPT =
  'সকাল হয়ে গেছে, আর ঘুম নয়! দ্রুত ঘুম থেকে উঠুন, আজকের পড়ার সময় শুরু হয়ে গেছে।';

const SCRIPT_PRESETS = [
  {
    id: 'morning-study-bn',
    labelBn: 'সকালের পড়া (Wake-Up)',
    labelEn: 'Morning Study (Wake-Up)',
    text: 'সকাল হয়ে গেছে, আর ঘুম নয়! দ্রুত ঘুম থেকে উঠুন, আজকের পড়ার সময় শুরু হয়ে গেছে।',
    style: 'Energetic, bright, motivating morning wake-up announcement in clear Bengali',
  },
  {
    id: 'gentle-morning-bn',
    labelBn: 'শুভ সকাল (Gentle)',
    labelEn: 'Good Morning (Gentle)',
    text: 'শুভ সকাল! নতুন ভোরের আলো ফুটেছে, এখনই উঠে পড়ার টেবিলে বসে পড়ুন।',
    style: 'Warm, gentle, encouraging morning greeting in Bengali',
  },
  {
    id: 'focus-reminder-bn',
    labelBn: 'মনোযোগ রিমাইন্ডার',
    labelEn: 'Focus Reminder',
    text: 'বিরতি শেষ! চলুন আবার পূর্ণ মনোযোগ দিয়ে আজকের অধ্যায়টা শেষ করি।',
    style: 'Clear, calm, focused study coach in Bengali',
  },
  {
    id: 'english-alarm',
    labelBn: 'মর্নিং স্টাডি (EN)',
    labelEn: 'Morning Study (EN)',
    text: "Good morning! It's time to wake up, grab some water, and start today's study session.",
    style: 'Upbeat, energizing morning study coach',
  },
];

const TtsStudio: React.FC<TtsStudioProps> = ({
  voices,
  selectedVoiceName,
  onSelectVoice,
  onBeforeGenerate,
  onOpenLegal,
  incomingDraft,
  onOpenIdeas,
  isAdmin = false,
  userId,
  isDarkMode = false,
  apiBaseUrl = '',
  billingConfig,
  userPlan = 'free',
  proPackageType = null,
  proExpiresAtMs = null,
  usedToday = 0,
  bonusCredits = 0,
  onOpenUpgradePackage,
  onOpenAdminSettings,
  customVoices = [],
  selectedCustomVoiceId = null,
  onSelectCustomVoice,
  onOpenVoiceCloneTool,
  onOpenVoiceCompare,
}) => {
  const { lang, bi } = useLanguage();
  const studioTier = resolveStudioTier({ isAdmin, userPlan, proPackageType });
  const caps = getStudioCapabilities(studioTier);
  const monthlyPriceLabel = billingConfig?.monthlyFee || billingConfig?.feeAmount || '50 BDT';
  const yearlyPriceLabel = billingConfig?.yearlyFee || '480 BDT';
  const freeDailyLimit = billingConfig?.freeDailyLimit ?? 5;
  const expiryDateLabel =
    proExpiresAtMs && proExpiresAtMs > Date.now()
      ? localizeDate(proExpiresAtMs, lang, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : null;

  const [text, setText] = useState(DEFAULT_SCRIPT);
  const [style, setStyle] = useState(STUDIO_STYLE_PRESETS[0].value);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [loudnessBoost, setLoudnessBoost] = useState<boolean>(false);
  const [alarmDelayMs, setAlarmDelayMs] = useState<number>(1200);
  const [savedScripts, setSavedScripts] = useState<SavedStudioScript[]>(() =>
    loadSavedStudioScripts(userId)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userNotice, setUserNotice] = useState<string | null>(null);
  const [cachedKey, setCachedKey] = useState<string | null>(null);
  const [cachedBytes, setCachedBytes] = useState<Uint8Array | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [isUsingDeviceSpeech, setIsUsingDeviceSpeech] = useState(false);
  const [scriptAnalysis, setScriptAnalysis] = useState<SmartScriptAnalysis | null>(null);
  const [audioInspection, setAudioInspection] = useState<SmartAudioInspection | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const speakDelayTimerRef = useRef<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isMountedRef = useRef(true);
  const isLoopingRef = useRef(isLooping);
  const speedRef = useRef(playbackSpeed);
  const alarmDelayRef = useRef(alarmDelayMs);
  const activeRunIdRef = useRef(0);

  const effectiveSpeed = caps.allowPlaybackSpeed ? playbackSpeed : 1.0;
  const effectiveBoost = caps.allowLoudnessBoost ? loudnessBoost : false;
  const effectiveAlarmDelayMs = caps.allowCustomLoopDelay ? alarmDelayMs : 1200;

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    speedRef.current = effectiveSpeed;
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.playbackRate.value = effectiveSpeed;
      } catch {}
    }
  }, [effectiveSpeed]);

  useEffect(() => {
    alarmDelayRef.current = effectiveAlarmDelayMs;
  }, [effectiveAlarmDelayMs]);

  useEffect(() => {
    setSavedScripts(loadSavedStudioScripts(userId));
  }, [userId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPlayback();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    checkBackendHealth().then((ok) => {
      if (active && isMountedRef.current) {
        setBackendAvailable(ok);
      }
    });
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!incomingDraft) return;
    stopPlayback();
    setText(incomingDraft.text);
    setStyle(incomingDraft.style);
    setError(null);
    setUserNotice(null);
  }, [incomingDraft?.revision]);

  const activeCustomVoice = selectedCustomVoiceId
    ? customVoices.find((cv) => cv.id === selectedCustomVoiceId) || null
    : null;

  const currentVoice =
    voices.find(
      (v) =>
        v.name ===
        (activeCustomVoice ? activeCustomVoice.matchedBaseVoice : selectedVoiceName)
    ) || voices[0];
  const currentVoiceVisual = currentVoice ? getVoiceAlbumVisual(currentVoice) : null;

  const effectiveTtsVoiceName = activeCustomVoice
    ? activeCustomVoice.matchedBaseVoice
    : currentVoice?.name || 'Kore';

  const effectiveTtsStyle = activeCustomVoice
    ? `${activeCustomVoice.synthesizedStylePrompt}${
        style.trim() ? `. Delivery mood: ${style.trim()}` : ''
      }`.slice(0, 440)
    : style.trim();

  const calibrationKey = activeCustomVoice
    ? `cv:${activeCustomVoice.id}:${activeCustomVoice.pitchCentsOffset ?? 0}:${activeCustomVoice.rateMultiplier ?? 1}:${activeCustomVoice.warmthBoost ?? 0}`
    : selectedVoiceName;
  const requestKey = `${calibrationKey}::boost:${effectiveBoost ? 1 : 0}::${effectiveTtsStyle}::${text.trim()}`;
  const isOverCharLimit = text.length > caps.maxScriptChars;

  useEffect(() => {
    setAudioInspection(null);
  }, [requestKey]);

  useEffect(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      setScriptAnalysis(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      analyzeScriptSmart({
        text: trimmed,
        maxChars: caps.maxScriptChars,
        signal: controller.signal,
      }).then((res) => {
        if (!controller.signal.aborted && isMountedRef.current && res) {
          setScriptAnalysis(res);
        }
      });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text, caps.maxScriptChars]);

  const clearLoopTimer = () => {
    if (loopTimerRef.current !== null) {
      window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    if (speakDelayTimerRef.current !== null) {
      window.clearTimeout(speakDelayTimerRef.current);
      speakDelayTimerRef.current = null;
    }
  };

  const stopPlayback = () => {
    activeRunIdRef.current += 1;
    clearLoopTimer();
    utteranceRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    }
    if (isMountedRef.current) {
      setIsPlaying(false);
      setIsUsingDeviceSpeech(false);
    }
  };

  const getSpeechVoices = async (): Promise<SpeechSynthesisVoice[]> => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const current = window.speechSynthesis.getVoices();
    if (current.length > 0) return current;
    return await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        window.speechSynthesis.removeEventListener?.('voiceschanged', done);
        resolve(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis.addEventListener?.('voiceschanged', done);
      window.setTimeout(done, 500);
    });
  };

  const speakWithDeviceVoice = async (trimmedText: string, runId: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      const msg = bi(
        'এই ব্রাউজারে Device Speech সাপোর্ট করে না। Gemini AI TTS ব্যবহার করতে Node সার্ভার বা VITE_API_BASE_URL সেট করুন।',
        'Device Speech is not supported in this browser. Connect a Node backend or set VITE_API_BASE_URL for Gemini AI TTS.'
      );
      reportAppIssue({ source: 'TtsStudio:DeviceSpeech', severity: 'error', message: msg });
      if (isAdmin) setError(msg);
      else
        setUserNotice(
          bi(
            'আপনার বর্তমান ব্রাউজারটি সরাসরি ভয়েস প্লেব্যাক সাপোর্ট করছে না। অনুগ্রহ করে Chrome বা আধুনিক ব্রাউজার ব্যবহার করুন।',
            'Your current browser does not support direct speech playback. Please use Chrome or a modern browser.'
          )
        );
      return;
    }

    const availableVoices = await getSpeechVoices();
    if (!isMountedRef.current || activeRunIdRef.current !== runId) return;

    const hasBengali = /[\u0980-\u09FF]/.test(trimmedText);
    const bengaliVoice =
      availableVoices.find((v) => v.lang.toLowerCase().startsWith('bn')) || null;
    const englishVoice =
      availableVoices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
      availableVoices[0] ||
      null;

    if (hasBengali && !bengaliVoice) {
      setIsPlaying(false);
      setIsUsingDeviceSpeech(false);
      const msg = bi(
        'আপনার এই ব্রাউজার/ডিভাইসে বাংলা Device Voice ইনস্টল করা নেই এবং স্ট্যাটিক হোস্টে AI ব্যাকএন্ড সংযুক্ত নেই।',
        'Bengali Device Voice is not installed on this browser/device and no AI backend is connected.'
      );
      reportAppIssue({ source: 'TtsStudio:DeviceSpeech', severity: 'error', message: msg });
      if (isAdmin) setError(msg);
      else
        setUserNotice(
          bi(
            'এই ডিভাইসে বাংলা ডিফল্ট ভয়েস পাওয়া যায়নি; অনুগ্রহ করে ইংরেজি স্ক্রিপ্ট ব্যবহার করুন অথবা বাংলা ভয়েস প্যাক চালু করুন।',
            'No Bengali system voice was found on this device; try an English script or install a Bengali voice pack.'
          )
        );
      return;
    }

    const preferredVoice = hasBengali ? bengaliVoice : englishVoice;
    const utterance = new SpeechSynthesisUtterance(trimmedText);
    utterance.lang = preferredVoice?.lang || (hasBengali ? 'bn-BD' : 'en-US');
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    utterance.volume = 1;
    utterance.rate = speedRef.current;
    utterance.pitch = 1;

    let didStart = false;
    const queuedAt = Date.now();

    utterance.onstart = () => {
      didStart = true;
    };

    utterance.onend = () => {
      if (!isMountedRef.current || activeRunIdRef.current !== runId) return;
      utteranceRef.current = null;
      if (!didStart && Date.now() - queuedAt < 120) {
        setIsPlaying(false);
        setIsUsingDeviceSpeech(false);
        const msg = bi(
          'ডিভাইসের অডিও ইঞ্জিন টেক্সটটি পড়তে পারেনি। ডিভাইস সাউন্ড চেক করুন বা অন্য ব্রাউজার/সার্ভার লিংক ব্যবহার করুন।',
          'Device audio engine could not read the text. Check device volume or backend connection.'
        );
        reportAppIssue({ source: 'TtsStudio:DeviceSpeech', severity: 'error', message: msg });
        if (isAdmin) setError(msg);
        else
          setUserNotice(
            bi(
              'ডিভাইস স্পিকার মিউট বা অডিও চালু না থাকায় প্লেব্যাক হয়নি।',
              'Playback did not start because device audio is muted or unavailable.'
            )
          );
        return;
      }
      if (isLoopingRef.current) {
        loopTimerRef.current = window.setTimeout(() => {
          if (isMountedRef.current && activeRunIdRef.current === runId && isLoopingRef.current) {
            speakWithDeviceVoice(trimmedText, runId);
          }
        }, alarmDelayRef.current);
      } else {
        setIsPlaying(false);
        setIsUsingDeviceSpeech(false);
      }
    };

    utterance.onerror = (event: any) => {
      if (!isMountedRef.current || activeRunIdRef.current !== runId) return;
      utteranceRef.current = null;
      setIsPlaying(false);
      setIsUsingDeviceSpeech(false);
      if (event?.error !== 'canceled' && event?.error !== 'interrupted') {
        const msg = bi('Device Speech প্লেব্যাক শুরু করা যায়নি।', 'Could not start Device Speech playback.');
        reportAppIssue({
          source: 'TtsStudio:DeviceSpeech',
          severity: 'error',
          message: msg,
          details: event?.error ? `SpeechSynthesis error: ${String(event.error)}` : undefined,
        });
        if (isAdmin) setError(msg);
        else
          setUserNotice(
            bi(
              'ভয়েস প্লেব্যাক শুরু করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
              'Could not start voice playback. Please try again.'
            )
          );
      }
    };

    const startSpeaking = () => {
      if (!isMountedRef.current || activeRunIdRef.current !== runId) return;
      utteranceRef.current = utterance;
      setIsUsingDeviceSpeech(true);
      setIsPlaying(true);
      window.speechSynthesis.speak(utterance);
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    };

    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      speakDelayTimerRef.current = window.setTimeout(startSpeaking, 60);
    } else {
      startSpeaking();
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

    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = speedRef.current;
    source.connect(ctx.destination);

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
        }, alarmDelayRef.current);
      } else {
        setIsPlaying(false);
      }
    };

    sourceNodeRef.current = source;
    source.start();
    setIsPlaying(true);
  };

  const checkTierCharacterLimit = (): boolean => {
    if (text.length <= caps.maxScriptChars) return true;
    const limitFormatted = caps.maxScriptChars.toLocaleString('en-US');
    if (studioTier === 'free') {
      setUserNotice(
        bi(
          `ফ্রি প্ল্যানে সর্বোচ্চ ${limitFormatted} অক্ষরের স্ক্রিপ্ট জেনারেট করা যায়। ২,৫০০ বা ৫,০০০ অক্ষরের জন্য Monthly বা Yearly প্যাক নিন।`,
          `Free plan allows up to ${limitFormatted} characters per script. Get Monthly or Yearly Pro for 2,500 or 5,000 characters.`
        )
      );
    } else if (studioTier === 'monthly') {
      setUserNotice(
        bi(
          `Monthly প্যাকে সর্বোচ্চ ${limitFormatted} অক্ষরের স্ক্রিপ্ট ব্যবহার করা যায়। একসাথে ৫,০০০ অক্ষর (২× বড় স্ক্রিপ্ট) পেতে Yearly প্যাকে আপগ্রেড করুন।`,
          `Monthly pack supports up to ${limitFormatted} characters. Upgrade to Yearly for 5,000 characters (2× length).`
        )
      );
    } else {
      setUserNotice(
        bi(
          `একসাথে সর্বোচ্চ ${limitFormatted} অক্ষর জেনারেট করা যাবে।`,
          `Maximum ${limitFormatted} characters can be generated at once.`
        )
      );
    }
    return false;
  };

  const handleGenerateAndPlay = async () => {
    if (isLoading) return;
    if (isPlaying) {
      stopPlayback();
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    setError(null);
    setUserNotice(null);

    if (!checkTierCharacterLimit()) {
      return;
    }

    const runId = ++activeRunIdRef.current;

    if (cachedBytes && cachedKey === requestKey) {
      try {
        await playBytes(cachedBytes, runId);
      } catch (err: any) {
        const msg = err?.message || 'Playback failed. Please try again.';
        reportAppIssue({ source: 'TtsStudio:Playback', severity: 'error', message: msg });
        if (isAdmin) setError(msg);
        else
          setUserNotice(
            bi('অডিও চালাতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', 'Could not play audio. Please try again.')
          );
        setIsPlaying(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      const hasBackend = backendAvailable === true ? true : await checkBackendHealth();
      if (isMountedRef.current) setBackendAvailable(hasBackend);

      if (!hasBackend) {
        if (isMountedRef.current) setIsLoading(false);
        await speakWithDeviceVoice(trimmed, runId);
        return;
      }

      if (onBeforeGenerate) {
        const allowed = await onBeforeGenerate();
        if (!allowed) return;
      }

      const { audioData } = await generateTtsAudio({
        text: trimmed,
        voiceName: effectiveTtsVoiceName,
        style: effectiveTtsStyle,
      });

      if (!isMountedRef.current || activeRunIdRef.current !== runId) return;

      const rawBytes = decodeBase64(audioData);
      const bytes =
        activeCustomVoice || effectiveBoost
          ? await renderCalibratedAudioBytes({
              rawBytes,
              pitchCentsOffset: activeCustomVoice?.pitchCentsOffset ?? 0,
              rateMultiplier: activeCustomVoice?.rateMultiplier ?? 1.0,
              warmthBoost: activeCustomVoice?.warmthBoost ?? 0,
              loudnessBoost: effectiveBoost,
            })
          : rawBytes;
      if (!isMountedRef.current || activeRunIdRef.current !== runId) return;
      setCachedBytes(bytes);
      setCachedKey(requestKey);
      inspectAudioSmart(bytes).then((stats) => {
        if (isMountedRef.current && stats) {
          setAudioInspection(stats);
        }
      });

      await playBytes(bytes, runId);
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate speech. Please try again.';
      reportAppIssue({ source: 'TtsStudio', severity: 'error', message: msg });
      if (isMountedRef.current && activeRunIdRef.current === runId) {
        if (isAdmin) setError(msg);
        else
          setUserNotice(
            bi(
              'এই মুহূর্তে ভয়েস তৈরি করা যাচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
              'Could not synthesize speech right now. Please try again shortly.'
            )
          );
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

    setError(null);
    setUserNotice(null);
    if (!checkTierCharacterLimit()) return;

    let bytesToDownload = cachedBytes && cachedKey === requestKey ? cachedBytes : null;
    if (!bytesToDownload) {
      setIsLoading(true);
      try {
        const hasBackend = backendAvailable === true ? true : await checkBackendHealth();
        if (isMountedRef.current) setBackendAvailable(hasBackend);
        if (!hasBackend) {
          const msg = bi(
            'WAV ডাউনলোডের জন্য Gemini ব্যাকএন্ড সার্ভার প্রয়োজন (GitHub Pages স্ট্যাটিক হোস্টে সরাসরি WAV জেনারেট হয় না)।',
            'Gemini backend server is required to download WAV audio.'
          );
          reportAppIssue({ source: 'TtsStudio:Download', severity: 'warning', message: msg });
          if (isAdmin) setError(msg);
          else
            setUserNotice(
              bi(
                'এই মুহূর্তে সরাসরি WAV ডাউনলোড চালু নেই; উপরে Generate & Speak দিয়ে লাইভ অডিও শুনুন।',
                'Direct WAV download is unavailable right now; press Generate & Speak above to listen live.'
              )
            );
          return;
        }

        if (onBeforeGenerate) {
          const allowed = await onBeforeGenerate();
          if (!allowed) return;
        }

        const { audioData } = await generateTtsAudio({
          text: trimmed,
          voiceName: effectiveTtsVoiceName,
          style: effectiveTtsStyle,
        });
        const rawBytes = decodeBase64(audioData);
        bytesToDownload =
          activeCustomVoice || effectiveBoost
            ? await renderCalibratedAudioBytes({
                rawBytes,
                pitchCentsOffset: activeCustomVoice?.pitchCentsOffset ?? 0,
                rateMultiplier: activeCustomVoice?.rateMultiplier ?? 1.0,
                warmthBoost: activeCustomVoice?.warmthBoost ?? 0,
                loudnessBoost: effectiveBoost,
              })
            : rawBytes;
        if (isMountedRef.current) {
          setCachedBytes(bytesToDownload);
          setCachedKey(requestKey);
          inspectAudioSmart(bytesToDownload).then((stats) => {
            if (isMountedRef.current && stats) {
              setAudioInspection(stats);
            }
          });
        }
      } catch (err: any) {
        const msg = err?.message || 'Failed to generate audio for download.';
        reportAppIssue({ source: 'TtsStudio:Download', severity: 'error', message: msg });
        if (isMountedRef.current) {
          if (isAdmin) setError(msg);
          else
            setUserNotice(
              bi('WAV ফাইল তৈরি করা যাচ্ছে না। অনুগ্রহ করে পরে আবার চেষ্টা করুন।', 'Failed to prepare WAV file. Please try again later.')
            );
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
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    setDownloaded(true);
    window.setTimeout(() => {
      if (isMountedRef.current) setDownloaded(false);
    }, 2000);
  };

  const handleSaveCurrentScript = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (caps.maxSavedScripts === 0) {
      setUserNotice(
        bi(
          'কাস্টম স্ক্রিপ্ট সেভ করতে Monthly (৩টি) বা Yearly (২৫টি) প্যাক নিন।',
          'Get Monthly (3 scripts) or Yearly (25 scripts) Pro to save custom scripts.'
        )
      );
      onOpenUpgradePackage?.('monthly');
      return;
    }

    if (savedScripts.length >= caps.maxSavedScripts) {
      if (studioTier === 'monthly') {
        setUserNotice(
          bi(
            `Monthly প্যাকে সর্বোচ্চ ${caps.maxSavedScripts}টি স্ক্রিপ্ট সেভ করা যায়। ২৫টি স্ক্রিপ্ট লাইব্রেরি পেতে Yearly প্যাকে আপগ্রেড করুন।`,
            `Monthly pack supports up to ${caps.maxSavedScripts} saved scripts. Upgrade to Yearly for 25 scripts.`
          )
        );
      } else {
        setUserNotice(
          bi(
            `সর্বোচ্চ ${caps.maxSavedScripts}টি স্ক্রিপ্ট সেভ করা আছে। নতুন সেভ করতে পুরোনো ১টি মুছুন।`,
            `Maximum ${caps.maxSavedScripts} scripts saved. Delete an older one to save a new script.`
          )
        );
      }
      return;
    }

    const cleanSnippet = trimmed.slice(0, 26) + (trimmed.length > 26 ? '…' : '');
    const newEntry: SavedStudioScript = {
      id: `scr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: cleanSnippet,
      text: trimmed.slice(0, caps.maxScriptChars),
      style: style.trim(),
      voiceName: currentVoice?.name || 'Kore',
      updatedAt: Date.now(),
    };
    const next = [newEntry, ...savedScripts];
    setSavedScripts(next);
    persistSavedStudioScripts(userId, next);
    setUserNotice(null);
  };

  const handleDeleteSavedScript = (id: string) => {
    const next = savedScripts.filter((item) => item.id !== id);
    setSavedScripts(next);
    persistSavedStudioScripts(userId, next);
  };

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 py-6 sm:py-10">
        <div className="bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl rounded-3xl border border-indigo-100/90 dark:border-indigo-900/60 shadow-xl overflow-hidden">
          {/* Top Studio Banner */}
          <div className="px-6 sm:px-8 py-5 border-b border-indigo-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/90 via-white to-amber-50/70 dark:from-[#131c38] dark:via-[#0f172a] dark:to-[#1a1510] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-indigo-600 dark:text-amber-400">
                <Sun size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">
                  {bi('ভয়েস স্টুডিও · মাল্টিলিঙ্গুয়াল TTS', 'Voice Studio · Multilingual TTS')}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-slate-900 dark:text-white">
                {bi('যেকোনো লেখা মুখে বলুন', 'Speak any script aloud')}
              </h2>
            </div>

            {/* Active Voice & Plan Status */}
            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-indigo-100 dark:border-slate-700 shadow-sm text-xs">
                <Crown
                  size={14}
                  className={
                    userPlan === 'pro' || isAdmin ? 'text-amber-500' : 'text-slate-400'
                  }
                />
                <span className="font-semibold text-slate-900 dark:text-white">
                  {isAdmin
                    ? bi('অ্যাডমিন আনলিমিটেড', 'Admin Unlimited')
                    : userPlan === 'pro'
                    ? proPackageType === 'yearly'
                      ? bi('ইয়ারলি প্রো সক্রিয়', 'Yearly Pro Active')
                      : bi('মান্থলি প্রো সক্রিয়', 'Monthly Pro Active')
                    : bi(
                        `ফ্রি (${Math.max(0, freeDailyLimit - usedToday)}/${freeDailyLimit} বাকি)`,
                        `Free (${Math.max(0, freeDailyLimit - usedToday)}/${freeDailyLimit} Left)`
                      )}
                </span>
                {expiryDateLabel && userPlan === 'pro' && !isAdmin && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    · {bi('মেয়াদ:', 'Expires:')} {expiryDateLabel}
                  </span>
                )}
              </div>

              {activeCustomVoice ? (
                <div className="flex items-center gap-2.5 pl-2.5 pr-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-amber-500 text-white shadow-sm">
                  <UserCheck size={15} className="shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold">{activeCustomVoice.name}</span>
                    <span className="opacity-75 mx-1.5">·</span>
                    <span className="font-medium">{bi('আমার ভয়েস প্রোফাইল', 'My Voice Profile')}</span>
                  </div>
                </div>
              ) : (
                currentVoice &&
                currentVoiceVisual && (
                  <div className="flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-indigo-100 dark:border-slate-700 shadow-sm">
                    <img
                      src={currentVoiceVisual.coverImg}
                      alt={`${currentVoice.name} cover`}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-xl object-cover shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {currentVoice.name}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 mx-1.5">·</span>
                      <span className="text-indigo-600 dark:text-amber-300 font-medium">
                        {localizeGender(currentVoice.analysis.gender, lang)},{' '}
                        {localizePitch(currentVoice.pitch, lang)}
                      </span>
                    </div>
                  </div>
                )
              )}

              {onOpenVoiceCloneTool && (
                <button
                  type="button"
                  onClick={onOpenVoiceCloneTool}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-sm transition-all whitespace-nowrap shrink-0"
                >
                  <Mic size={14} />
                  <span>{bi('নিজের ভয়েস রেকর্ড ও ক্লোন (Pro)', 'Record & Clone My Voice (Pro)')}</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            {/* Left Column: Script & Delivery Style */}
            <div className="lg:col-span-7 space-y-5">
              {/* Quick Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {bi('দ্রুত স্ক্রিপ্ট', 'Quick Scripts')}
                  </span>
                  {onOpenIdeas && (
                    <button
                      type="button"
                      onClick={onOpenIdeas}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      <TrendingUp size={13} />
                      <span>{bi('AI ট্রেন্ডিং আইডিয়া', 'AI Trending Ideas')}</span>
                    </button>
                  )}
                </div>
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
                          setUserNotice(null);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isActive
                            ? 'bg-zinc-900 dark:bg-indigo-600 text-white border-zinc-900 dark:border-indigo-500 shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {bi(preset.labelBn, preset.labelEn)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Script Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="tts-script-input"
                    className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                  >
                    {bi(
                      'স্ক্রিপ্ট টেক্সট (বাংলা, ইংরেজি বা যেকোনো ভাষা)',
                      'Script Text (Bengali, English, or any language)'
                    )}
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveCurrentScript}
                      disabled={!text.trim()}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors disabled:opacity-40"
                      title={
                        caps.maxSavedScripts === 0
                          ? bi('Pro প্ল্যানে স্ক্রিপ্ট সেভ করুন', 'Upgrade to Pro to save scripts')
                          : bi(
                              `স্ক্রিপ্ট সেভ করুন (${savedScripts.length}/${caps.maxSavedScripts})`,
                              `Save script (${savedScripts.length}/${caps.maxSavedScripts})`
                            )
                      }
                    >
                      <Bookmark size={12} />
                      <span>
                        {bi('সেভ', 'Save')} ({savedScripts.length}/{caps.maxSavedScripts})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopPlayback();
                        setText(DEFAULT_SCRIPT);
                        setError(null);
                        setUserNotice(null);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                      title={bi('সকালের পড়া প্রম্পটে রিসেট করুন', 'Reset to morning study prompt')}
                    >
                      <RotateCcw size={12} />
                      <span>{bi('রিসেট', 'Reset')}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  id="tts-script-input"
                  value={text}
                  onChange={(e) => {
                    if (isPlaying) stopPlayback();
                    setText(e.target.value);
                    setError(null);
                    setUserNotice(null);
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleGenerateAndPlay();
                    }
                  }}
                  rows={4}
                  placeholder={bi(
                    'বাংলা, ইংরেজি বা যেকোনো ভাষায় আপনার লেখা লিখুন বা পেস্ট করুন...',
                    'Enter or paste text in Bengali, English, or any language...'
                  )}
                  className={`w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border p-4 text-lg sm:text-xl leading-relaxed text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 transition-all resize-none ${
                    isOverCharLimit
                      ? 'border-red-400 dark:border-red-700 focus:ring-red-200 dark:focus:ring-red-950'
                      : 'border-zinc-200 dark:border-zinc-700 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-400 dark:focus:border-indigo-600'
                  }`}
                />
                <div className="flex flex-wrap justify-between items-center gap-2 text-xs px-1">
                  <span className="text-zinc-400 dark:text-zinc-500">
                    {bi(
                      'বাংলা, ইংরেজি ও বহুভাষী ভয়েস সাপোর্ট · চালাতে Ctrl/Cmd+Enter চাপুন',
                      'Supports Bengali, English & multilingual speech · Ctrl/Cmd+Enter to play'
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`tabular-nums font-medium ${
                        isOverCharLimit
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {text.length.toLocaleString('en-US')} / {caps.maxScriptChars.toLocaleString('en-US')}{' '}
                      {bi('অক্ষর', 'chars')}
                    </span>
                    {!caps.allowPlaybackSpeed && onOpenUpgradePackage && (
                      <button
                        type="button"
                        onClick={() => onOpenUpgradePackage('yearly')}
                        className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        {bi('৫,০০০ অক্ষর (Yearly)', '5,000 chars (Yearly)')}
                      </button>
                    )}
                  </div>
                </div>
                {scriptAnalysis && scriptAnalysis.wordCount > 0 && (() => {
                  const detectedLabel =
                    scriptAnalysis.language.primary === 'bn'
                      ? bi('বাংলা', 'Bengali', 'Bengali')
                      : scriptAnalysis.language.primary === 'pt'
                      ? bi('পর্তুগিজ', 'Portuguese', 'Português')
                      : scriptAnalysis.language.primary === 'mixed'
                      ? bi('মিশ্র ভাষা', 'Mixed', 'Misto')
                      : bi('ইংরেজি', 'English', 'Inglês');
                  const recPreset = STUDIO_STYLE_PRESETS.find(
                    (p) => p.id === scriptAnalysis.recommendedStyle.presetId
                  );
                  const canApplyRec =
                    Boolean(recPreset) &&
                    recPreset!.value !== style &&
                    (recPreset!.tier !== 'yearly' || caps.allowExtraStyles);
                  const recLabel = recPreset
                    ? localizeStudioPresetLabel(recPreset.id, recPreset.label, lang)
                    : '';
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                      <span>
                        {detectedLabel} · {scriptAnalysis.wordCount}{' '}
                        {bi('শব্দ', 'words', 'palavras')} · ~{scriptAnalysis.estimatedSeconds}s
                        {scriptAnalysis.chunkCount > 1
                          ? ` · ${scriptAnalysis.chunkCount} ${bi('অংশ', 'parts', 'partes')}`
                          : ''}
                      </span>
                      {canApplyRec && recPreset && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isPlaying) stopPlayback();
                            setStyle(recPreset.value);
                          }}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {bi(
                            `সাজেস্টেড স্টাইল: ${recLabel}`,
                            `Apply smart tone: ${recLabel}`,
                            `Aplicar tom sugerido: ${recLabel}`
                          )}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Saved Custom Scripts Shelf */}
              {savedScripts.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {bi('আমার সংরক্ষিত স্ক্রিপ্ট', 'My Saved Scripts')} ({savedScripts.length}/{caps.maxSavedScripts})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {savedScripts.map((item) => (
                      <div
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-full bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 pl-3 pr-1.5 py-1 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            stopPlayback();
                            setText(item.text);
                            setStyle(item.style);
                            if (item.voiceName) onSelectVoice(item.voiceName);
                            setUserNotice(null);
                          }}
                          className="font-medium text-indigo-800 dark:text-indigo-200 hover:underline"
                        >
                          {item.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedScript(item.id)}
                          className="p-0.5 rounded-full text-zinc-400 hover:text-red-500 transition-colors"
                          aria-label={bi(`${item.title} মুছুন`, `Delete ${item.title}`)}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery Style Direction */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="tts-style-input"
                    className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                  >
                    {bi('ডেলিভারি টোন ও স্টাইল', 'Delivery Tone & Style')}
                  </label>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {caps.allowExtraStyles
                      ? bi('৮টি স্টুডিও স্টাইল আনলকড', '8 Studio styles unlocked')
                      : bi('৪ স্ট্যান্ডার্ড · +৪ Yearly প্রো', '4 Standard · +4 Yearly Pro')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STUDIO_STYLE_PRESETS.map((preset) => {
                    const selected = style === preset.value;
                    const locked = preset.tier === 'yearly' && !caps.allowExtraStyles;
                    const presetDisplayLabel = localizeStudioPresetLabel(preset.id, preset.label, lang);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          if (locked) {
                            setUserNotice(
                              bi(
                                `"${presetDisplayLabel}" এক্সক্লুসিভ স্টুডিও স্টাইলটি শুধু Yearly প্যাকে (৩৬৫ দিন) পাওয়া যায়।`,
                                `"${presetDisplayLabel}" is an exclusive Yearly Pro studio style (365 days).`
                              )
                            );
                            onOpenUpgradePackage?.('yearly');
                            return;
                          }
                          if (isPlaying) stopPlayback();
                          setStyle(preset.value);
                          setUserNotice(null);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                            : locked
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/60 hover:bg-amber-100/60'
                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {locked && <Lock size={11} className="shrink-0" />}
                        <span>{presetDisplayLabel}</span>
                      </button>
                    );
                  })}
                </div>
                <input
                  id="tts-style-input"
                  type="text"
                  value={style}
                  onChange={(e) => {
                    if (isPlaying) stopPlayback();
                    setStyle(e.target.value);
                  }}
                  placeholder={bi(
                    'ঐচ্ছিক কণ্ঠের ভঙ্গি লিখুন (যেমন: প্রফুল্ল সকালের উপস্থাপক)...',
                    'Optional vocal direction (e.g. Cheerful morning host)...'
                  )}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                />
              </div>

              {/* Yearly Pro Exclusive Audio Controls (Speed, Loudness Boost, Alarm Interval) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/70 via-zinc-50 to-zinc-50 dark:from-amber-950/20 dark:via-zinc-800/50 dark:to-zinc-800/50 border border-amber-200/80 dark:border-amber-900/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    <Crown size={13} />
                    <span>{bi('Yearly প্রো অডিও কন্ট্রোল', 'Yearly Pro Audio Controls')}</span>
                  </div>
                  {!caps.allowPlaybackSpeed && onOpenUpgradePackage && (
                    <button
                      type="button"
                      onClick={() => onOpenUpgradePackage('yearly')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                    >
                      <Lock size={12} />
                      <span>{bi('Yearly দিয়ে আনলক', 'Unlock with Yearly')}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Speed Control */}
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      <Gauge size={13} />
                      <span>{bi('প্লেব্যাক গতি', 'Playback Speed')}</span>
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {STUDIO_PLAYBACK_SPEEDS.map((spd) => {
                        const active = effectiveSpeed === spd;
                        const disabledByTier = !caps.allowPlaybackSpeed && spd !== 1.0;
                        return (
                          <button
                            key={spd}
                            type="button"
                            onClick={() => {
                              if (!caps.allowPlaybackSpeed) {
                                onOpenUpgradePackage?.('yearly');
                                return;
                              }
                              setPlaybackSpeed(spd);
                            }}
                            className={`py-2 rounded-lg text-xs font-semibold tabular-nums border transition-colors ${
                              active
                                ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 border-zinc-900 dark:border-amber-500'
                                : disabledByTier
                                ? 'bg-white/60 dark:bg-zinc-900/60 text-zinc-400 border-zinc-200 dark:border-zinc-700'
                                : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                            }`}
                          >
                            {spd}x
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Loudness Gain Boost */}
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      <Zap size={13} />
                      <span>{bi('অ্যালার্ম সাউন্ড বুস্ট', 'Alarm Sound Boost')}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!caps.allowLoudnessBoost) {
                          onOpenUpgradePackage?.('yearly');
                          return;
                        }
                        if (isPlaying) stopPlayback();
                        setLoudnessBoost((prev) => !prev);
                      }}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 leading-relaxed ${
                        effectiveBoost
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {!caps.allowLoudnessBoost && <Lock size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />}
                      <span>
                        {effectiveBoost
                          ? bi('লাউড বুস্ট +৪০% চালু', 'Loud Boost +40% ON')
                          : bi('নরমাল (বুস্ট +৪০%)', 'Normal (Boost +40%)')}
                      </span>
                    </button>
                  </div>

                  {/* Alarm Repeat Delay */}
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      <Timer size={13} />
                      <span>{bi('লুপ বিরতি', 'Loop Delay')}</span>
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {STUDIO_ALARM_DELAYS_MS.map((ms) => {
                        const active = effectiveAlarmDelayMs === ms;
                        const disabledByTier = !caps.allowCustomLoopDelay && ms !== 1200;
                        return (
                          <button
                            key={ms}
                            type="button"
                            onClick={() => {
                              if (!caps.allowCustomLoopDelay) {
                                onOpenUpgradePackage?.('yearly');
                                return;
                              }
                              setAlarmDelayMs(ms);
                            }}
                            className={`py-2 rounded-lg text-xs font-semibold tabular-nums border transition-colors ${
                              active
                                ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 border-zinc-900 dark:border-amber-500'
                                : disabledByTier
                                ? 'bg-white/60 dark:bg-zinc-900/60 text-zinc-400 border-zinc-200 dark:border-zinc-700'
                                : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                            }`}
                          >
                            {(ms / 1000).toFixed(ms === 1200 ? 1 : 0)}s
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Voice Selection, Visualizer, Play & Alarm Controls */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-5">
              {/* Voice Picker Card (Standard Voices + My Recorded Voice Profiles) */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {bi('ভয়েস ট্যালেন্ট নির্বাচন', 'Select Voice Talent')}
                  </span>
                  <div className="flex items-center gap-3">
                    {onOpenVoiceCompare && (
                      <button
                        type="button"
                        onClick={onOpenVoiceCompare}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-amber-400"
                      >
                        <ArrowLeftRight size={13} />
                        <span>{bi('তুলনা A vs B', 'Compare A vs B')}</span>
                      </button>
                    )}
                    {onOpenVoiceCloneTool && (
                      <button
                        type="button"
                        onClick={onOpenVoiceCloneTool}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-amber-400 hover:underline"
                      >
                        <Mic size={13} />
                        <span>{bi('নতুন ভয়েস রেকর্ড', 'Record New Voice')}</span>
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Source Switcher: Studio Catalog vs My Recorded Voices */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => {
                      stopPlayback();
                      onSelectCustomVoice?.(null);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
                      !activeCustomVoice
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {bi('স্টুডিও ভয়েস', 'Studio Voices')} ({voices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopPlayback();
                      if (customVoices.length > 0) {
                        onSelectCustomVoice?.(customVoices[0].id);
                      } else {
                        onOpenVoiceCloneTool?.();
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                      activeCustomVoice
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <UserCheck size={12} />
                    <span>{bi('আমার ভয়েস', 'My Voices')} ({customVoices.length})</span>
                  </button>
                </div>

                {activeCustomVoice ? (
                  <div className="space-y-2.5">
                    <div className="relative">
                      <select
                        id="studio-custom-voice-select"
                        value={activeCustomVoice.id}
                        onChange={(e) => {
                          stopPlayback();
                          onSelectCustomVoice?.(e.target.value);
                        }}
                        disabled={isLoading}
                        className="appearance-none w-full bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 text-zinc-900 dark:text-white py-2.5 pl-3.5 pr-10 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400/40 cursor-pointer"
                      >
                        {customVoices.map((cv) => (
                          <option key={cv.id} value={cv.id}>
                            {cv.name} — {localizeGender(cv.gender, lang)}, {localizePitch(cv.pitchLabel, lang)} ({cv.durationSec}s)
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-amber-500">
                        <ChevronDown size={16} />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      <strong>{bi('ভয়েস ডিএনএ:', 'Voice DNA:')}</strong> {activeCustomVoice.toneDescription}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <select
                        id="studio-voice-select"
                        value={currentVoice?.name || ''}
                        onChange={(e) => {
                          stopPlayback();
                          onSelectCustomVoice?.(null);
                          onSelectVoice(e.target.value);
                        }}
                        disabled={isLoading}
                        className="appearance-none w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white py-2.5 pl-3.5 pr-10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 cursor-pointer"
                      >
                        {voices.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name} — {localizeGender(v.analysis.gender, lang)}, {localizePitch(v.pitch, lang)} ({localizeTrait(v.characteristics[0], lang)})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                        <ChevronDown size={16} />
                      </div>
                    </div>
                    {currentVoice && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {currentVoice.analysis.characteristics
                          .map((c) => localizeTrait(c, lang))
                          .join(' • ')}
                      </p>
                    )}
                  </>
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
                aria-label={
                  isPlaying
                    ? bi('স্পিচ প্লেব্যাক থামান', 'Stop speech playback')
                    : bi('স্পিচ তৈরি করে শুনুন', 'Generate and play speech')
                }
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
                      {bi('ভয়েস তৈরি হচ্ছে...', 'Synthesizing speech...')}
                    </span>
                  </div>
                ) : isPlaying ? (
                  <div className="w-full h-full z-10">
                    <AudioVisualizer
                      isPlaying={true}
                      color={isDarkMode ? '#a5b4fc' : '#18181b'}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-500 z-10">
                    <div className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center">
                      <Volume2 size={20} className="text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <span className="text-xs font-medium">
                      {bi('জেনারেট ও শুনতে ক্লিক করুন', 'Click to generate & listen')}
                    </span>
                  </div>
                )}

                {isAdmin && error && (
                  <div className="absolute inset-0 bg-white/95 dark:bg-zinc-950/95 p-4 flex items-center justify-center gap-2 text-red-600 dark:text-red-400 text-xs text-center z-20">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {audioInspection && cachedKey === requestKey && !isUsingDeviceSpeech && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums text-center">
                  {bi('অডিও আউটপুট:', 'Audio output:', 'Saída de áudio:')}{' '}
                  {(audioInspection.sampleRate / 1000).toFixed(0)} kHz ·{' '}
                  {audioInspection.durationSeconds.toFixed(1)}s · {audioInspection.rmsDbfs} dBFS
                </p>
              )}

              {userNotice && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{userNotice}</span>
                </div>
              )}

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
                      ? bi('অডিও তৈরি হচ্ছে...', 'Generating Audio...')
                      : isPlaying
                      ? bi('বলা থামান', 'Stop Speaking')
                      : bi('তৈরি করুন ও বলুন', 'Generate & Speak')}
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
                    title={bi(
                      'অ্যালার্মের মতো একটানা পুনরাবৃত্তি করুন',
                      'Repeat continuously like a wake-up alarm'
                    )}
                  >
                    <Repeat size={14} />
                    <span>
                      {isLooping
                        ? bi(
                            `অ্যালার্ম চালু (${(effectiveAlarmDelayMs / 1000).toFixed(effectiveAlarmDelayMs === 1200 ? 1 : 0)}s)`,
                            `Alarm On (${(effectiveAlarmDelayMs / 1000).toFixed(effectiveAlarmDelayMs === 1200 ? 1 : 0)}s)`
                          )
                        : bi('অ্যালার্ম লুপ', 'Alarm Loop')}
                    </span>
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
                    <span>
                      {downloaded ? bi('WAV সেভ হয়েছে', 'Saved WAV') : bi('WAV ডাউনলোড', 'Download WAV')}
                    </span>
                  </button>
                </div>

                {isAdmin && backendAvailable === false && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/70 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                    <strong>{bi('অ্যাডমিন নোটিশ (Static Host):', 'Admin Notice (Static Host):')}</strong>{' '}
                    {bi(
                      'এই ডোমেইনে এখন Node ব্যাকএন্ড সংযুক্ত নেই। GitHub Pages-কেও ডায়নামিক করতে Admin Panel → Fee & Quota Settings-এ গিয়ে আপনার Render/Node সার্ভারের URL সেভ করুন—সব ইউজারের জন্য সাথে সাথে Gemini বাংলা ভয়েস চালু হয়ে যাবে।',
                      'No Node backend is currently connected on this host. Save your Render/Node backend URL in Admin Panel → Fee & Quota Settings to enable Gemini AI TTS globally.'
                    )}
                  </div>
                )}

                <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                  <Sparkles size={12} className="text-indigo-500" />
                  <span>
                    {isUsingDeviceSpeech
                      ? bi(
                          'ব্রাউজার ডিভাইস স্পিচ দিয়ে চলছে (Static Fallback)',
                          'Playing via Browser Device Speech (Static Fallback)'
                        )
                      : bi('Gemini 3.8 Flash Lite TTS দ্বারা চালিত', 'Powered by Gemini 3.8 Flash Lite TTS')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Voice Studio Monthly & Yearly Packages Comparison Section */}
        <section className="mt-8 rounded-3xl bg-white/95 dark:bg-zinc-900/95 border border-zinc-200/80 dark:border-zinc-800 shadow-lg p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                <Crown size={14} />
                <span>{bi('Monthly বনাম Yearly প্রো সুবিধা', 'Monthly vs Yearly Pro Perks')}</span>
              </div>
              <h3 className="text-2xl font-serif font-medium text-zinc-900 dark:text-white">
                {bi(
                  'ভয়েস স্টুডিও Monthly ও Yearly প্যাকেজের সুবিধার ব্যবধান',
                  'Voice Studio Monthly vs Yearly Package Comparison'
                )}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                {userPlan === 'pro' && !isAdmin
                  ? bi(
                      `আপনার বর্তমান প্ল্যান: ${
                        proPackageType === 'yearly' ? 'Yearly Pro (৩৬৫ দিন)' : 'Monthly Pro (৩০ দিন)'
                      }${expiryDateLabel ? ` · মেয়াদ শেষ: ${expiryDateLabel}` : ''}`,
                      `Current Plan: ${
                        proPackageType === 'yearly' ? 'Yearly Pro (365 days)' : 'Monthly Pro (30 days)'
                      }${expiryDateLabel ? ` · Expires: ${expiryDateLabel}` : ''}`
                    )
                  : bi(
                      `ফ্রি প্ল্যানে সর্বোচ্চ ১,০০০ অক্ষর • আজ ব্যবহার: ${usedToday}/${freeDailyLimit} বার • বোনাস: ${bonusCredits} টি`,
                      `Free plan up to 1,000 chars • Used today: ${usedToday}/${freeDailyLimit} • Bonus: ${bonusCredits}`
                    )}
              </p>
            </div>

            {isAdmin && onOpenAdminSettings && (
              <button
                type="button"
                onClick={onOpenAdminSettings}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <Shield size={14} />
                <span>{bi('প্যাকেজের দাম পরিবর্তন করুন (Admin)', 'Edit Package Pricing (Admin)')}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Monthly Package */}
            <div
              className={`rounded-2xl p-6 border flex flex-col justify-between gap-6 transition-all ${
                userPlan === 'pro' && proPackageType !== 'yearly'
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-700 ring-1 ring-indigo-500/30'
                  : 'bg-zinc-50/80 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/80'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <CalendarDays size={14} />
                    <span>{bi('মান্থলি প্যাকেজ', 'Monthly Package')}</span>
                  </div>
                  <span className="px-3 py-1 rounded-md text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
                    {bi(STUDIO_TIER_LIMITS.monthly.validityLabel, '30 Days Validity')}
                  </span>
                </div>

                <div>
                  <h4 className="text-xl font-serif font-medium text-zinc-900 dark:text-white">
                    {bi('মাসিক স্টুডিও প্যাক', 'Monthly Studio Pack')}
                  </h4>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">
                      {monthlyPriceLabel}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {bi('/ ৩০ দিন', '/ 30 days')}
                    </span>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>
                      {bi(
                        <>প্রতি স্ক্রিপ্টে <strong>২,৫০০ অক্ষর</strong> (ফ্রি-র ২.৫×) ও আনলিমিটেড দৈনিক ব্যবহার</>,
                        <>Up to <strong>2,500 chars</strong> per script (2.5× Free) &amp; unlimited daily generations</>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>
                      {bi(
                        '৪টি স্ট্যান্ডার্ড ভয়েস স্টাইল, ৩০টি ভয়েস ও WAV ডাউনলোড',
                        '4 standard voice styles, 30 studio voices & WAV downloads'
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>
                      {bi(
                        <>সর্বোচ্চ <strong>৩টি</strong> ব্যক্তিগত কাস্টম স্ক্রিপ্ট সেভ ও ফিক্সড ১.২স লুপ</>,
                        <>Save up to <strong>3</strong> custom scripts &amp; fixed 1.2s alarm loop</>
                      )}
                    </span>
                  </li>
                </ul>
              </div>

              {isAdmin ? (
                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {bi('Admin অ্যাকাউন্টে সব ফিচার আনলিমিটেড চালু আছে', 'All features unlocked on Admin account')}
                </div>
              ) : userPlan === 'pro' && proPackageType !== 'yearly' ? (
                <div className="w-full py-2.5 px-4 rounded-xl bg-indigo-600/10 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-xs font-semibold text-center">
                  {bi('বর্তমান Monthly প্যাকেজ সক্রিয় ✓', 'Current Monthly Package Active ✓')}
                </div>
              ) : userPlan === 'pro' && proPackageType === 'yearly' ? (
                <div className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-xs font-medium text-center">
                  {bi('আপনি উচ্চতর Yearly প্যাকেজে আছেন', 'You are on the higher Yearly plan')}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenUpgradePackage?.('monthly')}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                >
                  <Crown size={15} />
                  <span>{bi('Monthly প্যাকেজ নিন', 'Get Monthly Package')}</span>
                </button>
              )}
            </div>

            {/* Yearly Package */}
            <div
              className={`rounded-2xl p-6 border flex flex-col justify-between gap-6 relative transition-all ${
                userPlan === 'pro' && proPackageType === 'yearly'
                  ? 'bg-amber-50/90 dark:bg-amber-950/35 border-amber-500 dark:border-amber-600 ring-1 ring-amber-500/40'
                  : 'bg-gradient-to-br from-amber-50/70 via-white to-orange-50/50 dark:from-amber-950/25 dark:via-zinc-900 dark:to-zinc-900 border-amber-300 dark:border-amber-800/70'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    <Crown size={14} />
                    <span>{bi('ইয়ারলি স্টুডিও প্রো', 'Yearly Studio Pro')}</span>
                  </div>
                  <span className="px-3 py-1 rounded-md text-xs font-bold bg-amber-500 text-zinc-950">
                    {bi('সর্বোচ্চ সুবিধা · ৩৬৫ দিন', 'Best Value · 365 Days')}
                  </span>
                </div>

                <div>
                  <h4 className="text-xl font-serif font-medium text-zinc-900 dark:text-white">
                    {bi(
                      'বাৎসরিক প্রো প্যাক (Monthly-র সব সুবিধা +)',
                      'Annual Pro Pack (All Monthly perks +)'
                    )}
                  </h4>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">
                      {yearlyPriceLabel}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {bi('/ ৩৬৫ দিন (১ বছর)', '/ 365 days (1 year)')}
                    </span>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      {bi(
                        <>প্রতি স্ক্রিপ্টে <strong>৫,০০০ অক্ষর</strong> (Monthly-র ২× দ্বিগুণ দৈর্ঘ্য)</>,
                        <>Up to <strong>5,000 chars</strong> per script (2× Monthly limit)</>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      {bi(
                        <><strong>+৪টি এক্সক্লুসিভ স্টাইল:</strong> ডকুমেন্টারি, নিউজ অ্যাঙ্কর, পডকাস্ট ও ধ্যানমগ্ন শান্ত গাইড</>,
                        <><strong>+4 Exclusive Styles:</strong> Documentary, News Anchor, Podcast &amp; Mindful Calm</>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      {bi(
                        <><strong>অডিও কন্ট্রোল:</strong> স্পিড (0.85x–1.25x), +৪০% অ্যালার্ম বুস্ট ও কাস্টম লুপ বিরতি (1.2s–10s)</>,
                        <><strong>Audio Controls:</strong> Speed (0.85x–1.25x), +40% Loud Boost &amp; custom loop delay (1.2s–10s)</>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      {bi(
                        <><strong>২৫টি</strong> কাস্টম স্ক্রিপ্ট লাইব্রেরি (Monthly: ৩টি) ও বড় বাৎসরিক সাশ্রয়</>,
                        <><strong>25</strong> saved scripts library (vs. 3 on Monthly) &amp; annual savings</>
                      )}
                    </span>
                  </li>
                </ul>
              </div>

              {isAdmin ? (
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {bi('Admin অ্যাকাউন্টে সব ফিচার আনলিমিটেড চালু আছে', 'All features unlocked on Admin account')}
                </div>
              ) : userPlan === 'pro' && proPackageType === 'yearly' ? (
                <div className="w-full py-2.5 px-4 rounded-xl bg-amber-500/15 border border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-semibold text-center">
                  {bi('বর্তমান Yearly প্যাকেজ সক্রিয় ✓', 'Current Yearly Package Active ✓')}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenUpgradePackage?.('yearly')}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <Crown size={15} />
                  <span>
                    {userPlan === 'pro'
                      ? bi('Yearly-তে আপগ্রেড করুন', 'Upgrade to Yearly')
                      : bi('Yearly প্যাকেজ নিন', 'Get Yearly Package')}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Crisp Feature Comparison Strip */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2.5 px-4 font-semibold">{bi('সুবিধা (Studio Feature)', 'Studio Feature')}</th>
                  <th className="py-2.5 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                    {bi('Monthly (৩০ দিন)', 'Monthly (30 Days)')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-amber-700 dark:text-amber-400">
                    {bi('Yearly (৩৬৫ দিন)', 'Yearly (365 Days)')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                <tr>
                  <td className="py-2.5 px-4 font-medium">
                    {bi('একবারে স্ক্রিপ্টের অক্ষর সীমা', 'Script length per generation')}
                  </td>
                  <td className="py-2.5 px-4 tabular-nums">{bi('২,৫০০ অক্ষর', '2,500 chars')}</td>
                  <td className="py-2.5 px-4 tabular-nums font-semibold text-amber-700 dark:text-amber-300">
                    {bi('৫,০০০ অক্ষর (২×)', '5,000 chars (2×)')}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium">
                    {bi('ভয়েস ডেলিভারি স্টাইল প্রিসেট', 'Delivery style presets')}
                  </td>
                  <td className="py-2.5 px-4">{bi('৪টি স্ট্যান্ডার্ড স্টাইল', '4 Standard styles')}</td>
                  <td className="py-2.5 px-4 font-semibold text-amber-700 dark:text-amber-300">
                    {bi('৮টি স্টাইল (+৪ এক্সক্লুসিভ প্রো)', '8 styles (+4 exclusive Pro)')}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium">
                    {bi('প্লেব্যাক স্পিড ও লাউড অ্যালার্ম বুস্ট', 'Playback speed & loud alarm boost')}
                  </td>
                  <td className="py-2.5 px-4 text-zinc-400">{bi('ফিক্সড 1.0x', 'Fixed 1.0x')}</td>
                  <td className="py-2.5 px-4 font-semibold text-amber-700 dark:text-amber-300">
                    {bi('0.85x–1.25x + ৪০% সাউন্ড বুস্ট', '0.85x–1.25x + 40% sound boost')}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium">
                    {bi('অ্যালার্ম লুপ বিরতি ও সেভড স্ক্রিপ্ট', 'Alarm loop delay & saved scripts')}
                  </td>
                  <td className="py-2.5 px-4 tabular-nums">{bi('১.২s ফিক্সড · ৩টি স্ক্রিপ্ট', '1.2s fixed · 3 scripts')}</td>
                  <td className="py-2.5 px-4 tabular-nums font-semibold text-amber-700 dark:text-amber-300">
                    {bi('১.২s–১০s কাস্টম · ২৫টি স্ক্রিপ্ট', '1.2s–10s custom · 25 scripts')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <AdBanner
          slotId={import.meta.env.VITE_ADSENSE_SLOT_STUDIO}
          format="horizontal"
          className="mt-6"
        />

        <footer className="mt-8 pt-6 border-t border-zinc-200/70 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400 dark:text-zinc-500">
          <span>
            {bi('© ২০২৬ শ্রাবণ গো — সর্বস্বত্ব সংরক্ষিত', '© 2026 Srabon Go — All Rights Reserved')}
          </span>
          {onOpenLegal && (
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => onOpenLegal('about')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                {bi('আমাদের সম্পর্কে', 'About')}
              </button>
              <button type="button" onClick={() => onOpenLegal('privacy')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                {bi('গোপনীয়তা নীতি', 'Privacy Policy')}
              </button>
              <button type="button" onClick={() => onOpenLegal('terms')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                {bi('শর্তাবলি', 'Terms')}
              </button>
              <button type="button" onClick={() => onOpenLegal('contact')} className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                {bi('যোগাযোগ', 'Contact')}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default TtsStudio;
