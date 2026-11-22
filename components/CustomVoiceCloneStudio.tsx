/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  AudioLines,
  Check,
  CheckCircle2,
  Crown,
  Download,
  Edit3,
  ExternalLink,
  FileAudio,
  Lock,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  Upload,
  UserCheck,
  Volume2,
  Waves,
  X,
} from 'lucide-react';
import {
  BillingConfig,
  CustomVoiceProfile,
  ProPackageType,
  UserPlan,
} from '../types';
import AudioVisualizer from './AudioVisualizer';
import AdBanner from './AdBanner';
import type { LegalTab } from './SiteLegalModal';
import {
  checkBackendHealth,
  decodeAudioToBuffer,
  decodeBase64,
  generateTtsAudio,
} from '../utils/audio';
import { reportAppIssue } from '../utils/appIssues';
import { getStudioCapabilities, resolveStudioTier } from '../utils/studioTiers';
import {
  analyzeRecordedVoiceSample,
  blobToDataUrl,
  createCalibratedWavBlob,
  deleteVoiceSampleBlobFromDb,
  getSupportedRecorderMimeType,
  getVoiceProfileLimit,
  loadVoiceSampleBlobFromDb,
  renderCalibratedAudioBytes,
  saveVoiceSampleBlobToDb,
} from '../utils/voiceClone';
import { localizeGender, localizePitch, useLanguage } from '../utils/i18n';

interface CustomVoiceCloneStudioProps {
  profiles: CustomVoiceProfile[];
  activeProfileId: string | null;
  onSelectProfile: (profileId: string | null) => void;
  onAddProfile: (profile: CustomVoiceProfile) => void;
  onUpdateProfile: (profile: CustomVoiceProfile) => void;
  onDeleteProfile: (profileId: string) => void;
  onUseProfileInStudio: (profileId: string) => void;
  onBackToStudio: () => void;
  onBeforeGenerate?: () => Promise<boolean>;
  onOpenLegal?: (tab: LegalTab) => void;
  isAdmin?: boolean;
  isDarkMode?: boolean;
  billingConfig?: BillingConfig;
  userPlan?: UserPlan;
  proPackageType?: ProPackageType | null;
  usedToday?: number;
  bonusCredits?: number;
  onOpenUpgradePackage?: (pkg: ProPackageType) => void;
}

const MAX_RECORD_SECONDS = 25;
const MIN_RECORD_SECONDS = 3;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const SAMPLE_READING_SCRIPT_BN =
  'হ্যালো! আমি আমার নিজের ভয়েস স্যাম্পল রেকর্ড করছি, যাতে এআই আমার কণ্ঠের সুর, গতি ও উচ্চারণ বিশ্লেষণ করে যেকোনো লেখা সুন্দরভাবে বলতে পারে।';
const SAMPLE_READING_SCRIPT_EN =
  'Hello! I am recording my own voice sample so AI can analyze my tone, pace, and articulation and read any script naturally in my voice.';

const CLONE_TEXT_PRESETS = [
  {
    id: 'intro-bn',
    labelBn: 'নিজের কণ্ঠে পরিচিতি',
    labelEn: 'Personal Intro',
    text: 'নমস্কার ও শুভ দিন! আমি আমার নিজস্ব এআই ভয়েস প্রোফাইল থেকে কথা বলছি। এখন যেকোনো স্ক্রিপ্ট আমার কণ্ঠের ছন্দেই শুনতে পারবেন।',
  },
  {
    id: 'vlog-bn',
    labelBn: 'ভিডিও / রিলস ন্যারেটর',
    labelEn: 'Video / Reels Narrator',
    text: 'বন্ধুরা, আজকের ভিডিওতে আমরা দেখব কীভাবে প্রযুক্তির সাহায্যে নিজের কণ্ঠস্বরকে ডিজিটালভাবে সংরক্ষণ করে কনটেন্ট তৈরি করা যায়।',
  },
  {
    id: 'alarm-bn',
    labelBn: 'ব্যক্তিগত অ্যালার্ম',
    labelEn: 'Personal Alarm',
    text: 'সময় হয়ে গেছে! এখনই উঠে পড়ুন এবং আজকের গুরুত্বপূর্ণ কাজটি পূর্ণ মনোযোগ দিয়ে শুরু করুন।',
  },
  {
    id: 'en-pro',
    labelBn: 'ইংরেজি প্রেজেন্টেশন',
    labelEn: 'English Presentation',
    text: 'Hello everyone! Welcome back. Today I am speaking through my personalized AI voice profile, calibrated directly from my own recording.',
  },
];

const formatSeconds = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

const CustomVoiceCloneStudio: React.FC<CustomVoiceCloneStudioProps> = ({
  profiles,
  activeProfileId,
  onSelectProfile,
  onAddProfile,
  onUpdateProfile,
  onDeleteProfile,
  onUseProfileInStudio,
  onBackToStudio,
  onBeforeGenerate,
  onOpenLegal,
  isAdmin = false,
  isDarkMode = false,
  billingConfig,
  userPlan = 'free',
  proPackageType = null,
  usedToday = 0,
  bonusCredits = 0,
  onOpenUpgradePackage,
}) => {
  const { lang, bi } = useLanguage();
  const studioTier = resolveStudioTier({ isAdmin, userPlan, proPackageType });
  const studioCaps = getStudioCapabilities(studioTier);
  const { maxProfiles, allowFineTuning } = getVoiceProfileLimit({
    isAdmin,
    userPlan,
    proPackageType,
  });
  const freeDailyLimit = billingConfig?.freeDailyLimit ?? 5;

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

  // Step 1: Recording / Upload State
  const [isRecording, setIsRecording] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [micPermissionState, setMicPermissionState] = useState<
    'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown'
  >('unknown');
  const [showMicModal, setShowMicModal] = useState(false);
  const [micIssueReason, setMicIssueReason] = useState<
    'denied' | 'no-device' | 'busy' | 'unsupported' | 'prompt-guide'
  >('prompt-guide');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micLevels, setMicLevels] = useState<number[]>(() => Array(16).fill(12));
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedDurationSec, setCapturedDurationSec] = useState<number>(0);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [isPlayingCaptured, setIsPlayingCaptured] = useState(false);
  const [customProfileLabel, setCustomProfileLabel] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureSuccessNotice, setCaptureSuccessNotice] = useState<string | null>(null);

  // Saved sample preview player
  const [playingSavedSampleId, setPlayingSavedSampleId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingNameDraft, setEditingNameDraft] = useState('');

  // Step 3: Speech Generation State
  const [scriptText, setScriptText] = useState(CLONE_TEXT_PRESETS[0].text);
  const [extraStyleNote, setExtraStyleNote] = useState('');
  const [pitchCentsOffset, setPitchCentsOffset] = useState<number>(
    activeProfile?.pitchCentsOffset ?? 0
  );
  const [rateMultiplier, setRateMultiplier] = useState<number>(
    activeProfile?.rateMultiplier ?? 1.0
  );
  const [warmthBoost, setWarmthBoost] = useState<number>(
    activeProfile?.warmthBoost ?? 0
  );
  const [loudnessBoost, setLoudnessBoost] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsNotice, setTtsNotice] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [showDnaPrompt, setShowDnaPrompt] = useState(false);

  const [cachedRawKey, setCachedRawKey] = useState<string | null>(null);
  const [cachedRawBytes, setCachedRawBytes] = useState<Uint8Array | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const analyserCtxRef = useRef<AudioContext | null>(null);
  const analyserRafRef = useRef<number | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const savedSampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const savedSampleUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const isLoopingRef = useRef(isLooping);
  const activeRunIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    if (!activeProfile) return;
    setPitchCentsOffset(activeProfile.pitchCentsOffset ?? 0);
    setRateMultiplier(activeProfile.rateMultiplier ?? 1.0);
    setWarmthBoost(activeProfile.warmthBoost ?? 0);
  }, [activeProfile?.id]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanupRecorderTracks();
      stopPlayback();
      stopSavedSamplePreview();
      if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
        playbackCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }
    };
  }, [capturedPreviewUrl]);

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setMicPermissionState('unsupported');
      return;
    }

    let cancelled = false;
    let statusObj: PermissionStatus | null = null;
    const syncState = (state: PermissionState) => {
      if (cancelled) return;
      if (state === 'granted' || state === 'prompt' || state === 'denied') {
        setMicPermissionState(state);
      }
    };

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((perm) => {
          if (cancelled) return;
          statusObj = perm;
          syncState(perm.state);
          perm.onchange = () => syncState(perm.state);
        })
        .catch(() => {
          if (!cancelled) setMicPermissionState('unknown');
        });
    }

    return () => {
      cancelled = true;
      if (statusObj) {
        statusObj.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showMicModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMicModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showMicModal]);

  const cleanupRecorderTracks = () => {
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (analyserRafRef.current !== null) {
      cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = null;
    }
    if (analyserCtxRef.current && analyserCtxRef.current.state !== 'closed') {
      analyserCtxRef.current.close().catch(() => {});
      analyserCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  const stopCapturedPreview = () => {
    const el = previewAudioRef.current;
    if (el) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {}
    }
    setIsPlayingCaptured(false);
  };

  const stopSavedSamplePreview = () => {
    const el = savedSampleAudioRef.current;
    if (el) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {}
      savedSampleAudioRef.current = null;
    }
    if (savedSampleUrlRef.current) {
      URL.revokeObjectURL(savedSampleUrlRef.current);
      savedSampleUrlRef.current = null;
    }
    setPlayingSavedSampleId(null);
  };

  const stopPlayback = () => {
    activeRunIdRef.current += 1;
    if (loopTimerRef.current !== null) {
      window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    if (playbackSourceRef.current) {
      try {
        playbackSourceRef.current.onended = null;
        playbackSourceRef.current.stop();
        playbackSourceRef.current.disconnect();
      } catch {}
      playbackSourceRef.current = null;
    }
    if (isMountedRef.current) {
      setIsSpeaking(false);
    }
  };

  const isEmbeddedIframe =
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

  const requestMicrophoneStream = async (): Promise<MediaStream> => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      const unsupportedErr = new Error('UNSUPPORTED_MIC');
      (unsupportedErr as any).name = 'NotSupportedError';
      throw unsupportedErr;
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (firstErr: any) {
      const firstName = String(firstErr?.name || '');
      if (
        firstName === 'OverconstrainedError' ||
        firstName === 'ConstraintNotSatisfiedError' ||
        firstName === 'TypeError'
      ) {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      throw firstErr;
    }
  };

  const startRecording = async () => {
    if (isRecording || isAnalyzing || isRequestingMic) return;
    setCaptureError(null);
    setCaptureSuccessNotice(null);
    stopCapturedPreview();
    stopPlayback();

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setMicPermissionState('unsupported');
      setMicIssueReason('unsupported');
      setShowMicModal(true);
      setCaptureError(
        bi(
          'এই ব্রাউজার বা ওয়েবভিউতে মাইক্রোফোন রেকর্ডিং সাপোর্ট করে না। নতুন ট্যাবে খুলুন অথবা নিচের অডিও ফাইল আপলোড ব্যবহার করুন।',
          'Microphone recording is not supported in this browser view. Open in a new tab or upload an audio file below.'
        )
      );
      return;
    }

    setIsRequestingMic(true);
    try {
      const stream = await requestMicrophoneStream();
      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        return;
      }
      setIsRequestingMic(false);
      setMicPermissionState('granted');
      setShowMicModal(false);
      mediaStreamRef.current = stream;

      const mimeType = getSupportedRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const elapsed = Math.max(
          1,
          (Date.now() - recordStartTimeRef.current) / 1000
        );
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: finalMime });
        cleanupRecorderTracks();

        if (!isMountedRef.current) return;
        setIsRecording(false);
        setMicLevels(Array(16).fill(12));

        if (blob.size < 1024 || elapsed < 1.2) {
          setCaptureError(
            bi(
              'রেকর্ডিং খুব ছোট হয়ে গেছে। স্পষ্ট ফলাফলের জন্য অন্তত ৩–১০ সেকেন্ড কথা বলুন।',
              'Recording is too short. Please speak for at least 3–10 seconds for accurate analysis.'
            )
          );
          return;
        }

        const nextUrl = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedDurationSec(Math.round(elapsed));
        setCapturedPreviewUrl(nextUrl);
      };

      // Live Web Audio Meter
      try {
        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext;
        const analyserCtx = new AudioCtx();
        if (analyserCtx.state === 'suspended') {
          analyserCtx.resume().catch(() => {});
        }
        analyserCtxRef.current = analyserCtx;
        const source = analyserCtx.createMediaStreamSource(stream);
        const analyser = analyserCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
            return;
          }
          analyser.getByteFrequencyData(dataArray);
          const nextBars: number[] = [];
          for (let i = 0; i < 16; i++) {
            const val = dataArray[i] ?? 0;
            nextBars.push(Math.max(12, Math.min(100, Math.round((val / 255) * 100))));
          }
          setMicLevels(nextBars);
          analyserRafRef.current = requestAnimationFrame(updateMeter);
        };
        analyserRafRef.current = requestAnimationFrame(updateMeter);
      } catch {}

      mediaRecorderRef.current = recorder;
      recordStartTimeRef.current = Date.now();
      setRecordSeconds(0);
      setIsRecording(true);
      try {
        recorder.start(250);
      } catch {
        recorder.start();
      }

      recordTimerRef.current = window.setInterval(() => {
        const elapsedSec = Math.floor(
          (Date.now() - recordStartTimeRef.current) / 1000
        );
        setRecordSeconds(elapsedSec);
        if (elapsedSec >= MAX_RECORD_SECONDS) {
          if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === 'recording'
          ) {
            mediaRecorderRef.current.stop();
          }
        }
      }, 250);
    } catch (err: any) {
      cleanupRecorderTracks();
      setIsRecording(false);
      setIsRequestingMic(false);
      const errName = String(err?.name || '').toLowerCase();
      const rawMsg = String(err?.message || err?.name || '').toLowerCase();

      if (
        errName.includes('notfound') ||
        errName.includes('devicesnotfound') ||
        rawMsg.includes('requested device not found')
      ) {
        setMicIssueReason('no-device');
        setShowMicModal(true);
        setCaptureError(
          bi(
            'ডিভাইসে কোনো মাইক্রোফোন পাওয়া যায়নি। হেডসেট/মাইক সংযুক্ত করুন অথবা অডিও ফাইল আপলোড করুন।',
            'No microphone device was found. Connect a microphone or upload an audio file below.'
          )
        );
      } else if (
        errName.includes('notreadable') ||
        errName.includes('trackstart') ||
        errName.includes('abort')
      ) {
        setMicIssueReason('busy');
        setShowMicModal(true);
        setCaptureError(
          bi(
            'মাইক্রোফোনটি অন্য কোনো অ্যাপ ব্যবহার করছে বা পড়া যাচ্ছে না। অন্য অ্যাপ বন্ধ করে আবার চেষ্টা করুন।',
            'Microphone is currently busy in another app or hardware-locked. Close other audio apps and retry.'
          )
        );
      } else if (
        errName.includes('notsupported') ||
        rawMsg.includes('unsupported_mic')
      ) {
        setMicPermissionState('unsupported');
        setMicIssueReason('unsupported');
        setShowMicModal(true);
        setCaptureError(
          bi(
            'এই ব্রাউজার ভিউতে মাইক্রোফোন রেকর্ডিং সাপোর্ট করে না। নতুন ট্যাবে খুলুন অথবা অডিও ফাইল আপলোড করুন।',
            'Microphone recording is not supported in this view. Open in a new tab or upload an audio file.'
          )
        );
      } else {
        setMicPermissionState('denied');
        setMicIssueReason('denied');
        setShowMicModal(true);
        setCaptureError(
          bi(
            'মাইক্রোফোন অনুমতির পপআপ ব্লক বা ডিনাই করা হয়েছে। পপআপ গাইড দেখে অনুমতি দিন অথবা অডিও ফাইল আপলোড করুন।',
            'Microphone permission popup was blocked or denied. Allow access using the popup guide or upload an audio file below.'
          )
        );
      }
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecorderTracks();
      setIsRecording(false);
    }
  };

  const handleUploadAudioFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCaptureError(null);
    setCaptureSuccessNotice(null);
    stopCapturedPreview();

    const validAudioExt = /\.(mp3|wav|m4a|ogg|webm|aac|flac|opus|mp4)$/i.test(file.name);
    const validAudioMime = file.type ? file.type.startsWith('audio/') || file.type === 'video/webm' : false;
    if (!validAudioMime && !validAudioExt) {
      setCaptureError(
        bi(
          'অনুগ্রহ করে শুধুমাত্র সঠিক অডিও ফাইল (MP3, WAV, M4A, OGG, WEBM) আপলোড করুন।',
          'Please upload a valid audio file (MP3, WAV, M4A, OGG, WEBM).'
        )
      );
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setCaptureError(
        bi(
          'অডিও ফাইলের সাইজ সর্বোচ্চ ৮ MB-এর মধ্যে হতে হবে।',
          'Audio file size must be 8 MB or smaller.'
        )
      );
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    let detectedDuration = 10;
    try {
      detectedDuration = await new Promise<number>((resolve) => {
        const probe = new Audio(previewUrl);
        let settled = false;
        const finish = (val: number) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          probe.onloadedmetadata = null;
          probe.onerror = null;
          probe.src = '';
          resolve(val);
        };
        const timeoutId = window.setTimeout(() => finish(10), 3000);
        probe.onloadedmetadata = () => {
          const d = Number.isFinite(probe.duration) ? probe.duration : 10;
          finish(Math.max(1, Math.min(60, Math.round(d))));
        };
        probe.onerror = () => finish(10);
      });
    } catch {}

    setCapturedBlob(file);
    setCapturedDurationSec(detectedDuration);
    setCapturedPreviewUrl(previewUrl);
    if (!customProfileLabel.trim()) {
      setCustomProfileLabel(file.name.replace(/\.[^.]+$/, '').slice(0, 32));
    }
  };

  const toggleCapturedPreviewPlayback = async () => {
    const el = previewAudioRef.current;
    if (!el || !capturedPreviewUrl) return;
    if (isPlayingCaptured) {
      el.pause();
      setIsPlayingCaptured(false);
      return;
    }
    try {
      await el.play();
      setIsPlayingCaptured(true);
    } catch {
      setIsPlayingCaptured(false);
    }
  };

  const handleAnalyzeAndSaveVoice = async () => {
    if (!capturedBlob || isAnalyzing) return;
    setCaptureError(null);
    setCaptureSuccessNotice(null);

    if (profiles.length >= maxProfiles) {
      if (studioTier === 'free') {
        setCaptureError(
          bi(
            `ফ্রি ট্রায়ালে সর্বোচ্চ ${maxProfiles}টি ভয়েস প্রোফাইল সেভ করা যায়। আরও ভয়েস প্রোফাইল সংরক্ষণ ও প্রো ক্যালিব্রেশনের জন্য Monthly (৩টি) বা Yearly (১০টি) প্রো নিন।`,
            `Free trial allows up to ${maxProfiles} voice profile. Upgrade to Monthly (3) or Yearly (10) Pro for more profiles and fine calibration.`
          )
        );
        onOpenUpgradePackage?.('monthly');
      } else if (studioTier === 'monthly') {
        setCaptureError(
          bi(
            `Monthly প্রো-তে সর্বোচ্চ ${maxProfiles}টি প্রোফাইল রাখা যায়। ১০টি প্রোফাইল ও ফাইন টিউনিংয়ের জন্য Yearly প্যাকে আপগ্রেড করুন বা পুরোনো ১টি মুছুন।`,
            `Monthly Pro supports up to ${maxProfiles} profiles. Upgrade to Yearly for 10 profiles and fine-tuning, or delete an existing profile.`
          )
        );
        onOpenUpgradePackage?.('yearly');
      } else {
        setCaptureError(
          bi(
            `সর্বোচ্চ ${maxProfiles}টি প্রোফাইল সেভ করা আছে। নতুন সেভ করতে পুরোনো একটি ডিলিট করুন।`,
            `Maximum ${maxProfiles} profiles saved. Delete one to save a new profile.`
          )
        );
      }
      return;
    }

    if (capturedDurationSec < MIN_RECORD_SECONDS && capturedBlob.size < 4000) {
      setCaptureError(
        bi(
          'ভয়েস এনালাইসিসের জন্য অন্তত ৩ সেকেন্ডের স্পষ্ট অডিও প্রয়োজন।',
          'At least 3 seconds of clear audio is needed for voice analysis.'
        )
      );
      return;
    }

    setIsAnalyzing(true);
    try {
      const hasBackend = await checkBackendHealth();
      if (!hasBackend) {
        throw new Error(
          bi(
            'ভয়েস এনালাইসিসের জন্য AI ব্যাকএন্ড সার্ভার সংযুক্ত থাকতে হবে।',
            'AI backend server must be connected for voice analysis.'
          )
        );
      }

      if (onBeforeGenerate) {
        const allowed = await onBeforeGenerate();
        if (!allowed) {
          setIsAnalyzing(false);
          return;
        }
      }

      const analyzed = await analyzeRecordedVoiceSample({
        audioBlob: capturedBlob,
        durationSec: capturedDurationSec || 8,
        customLabel: customProfileLabel,
      });

      const profileId = `vc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await saveVoiceSampleBlobToDb(profileId, capturedBlob);

      let sampleAudioDataUrl: string | undefined;
      try {
        if (capturedBlob.size <= 250_000) {
          sampleAudioDataUrl = await blobToDataUrl(capturedBlob);
        }
      } catch {}

      const newProfile: CustomVoiceProfile = {
        id: profileId,
        name: analyzed.suggestedProfileName,
        durationSec: capturedDurationSec || 8,
        createdAt: Date.now(),
        sampleAudioDataUrl,
        sampleMimeType: capturedBlob.type || 'audio/webm',
        gender: analyzed.gender,
        pitchLabel: analyzed.pitchLabel,
        speakingRateLabel: analyzed.speakingRateLabel,
        toneDescription: analyzed.toneDescription,
        accentNotes: analyzed.accentNotes,
        transcriptSample: analyzed.transcriptSample,
        matchedBaseVoice: analyzed.matchedBaseVoice,
        synthesizedStylePrompt: analyzed.synthesizedStylePrompt,
        pitchCentsOffset: analyzed.pitchCentsOffset,
        rateMultiplier: analyzed.rateMultiplier,
        warmthBoost: analyzed.warmthBoost,
      };

      onAddProfile(newProfile);
      onSelectProfile(newProfile.id);
      setCustomProfileLabel('');
      setCaptureSuccessNotice(
        bi(
          `"${newProfile.name}" বিশ্লেষণ ও সেভ সম্পন্ন হয়েছে! এখন ডানপাশের বক্সে যেকোনো টেক্সট লিখে আপনার ভয়েসে বলান।`,
          `"${newProfile.name}" analyzed & saved! Type any script on the right to speak with your voice profile.`
        )
      );
    } catch (err: any) {
      const msg =
        err?.message ||
        bi(
          'ভয়েস রেকর্ডিং বিশ্লেষণ করা যায়নি। পরিষ্কারভাবে কথা বলে আবার চেষ্টা করুন।',
          'Could not analyze voice recording. Please speak clearly and try again.'
        );
      reportAppIssue({
        source: 'VoiceClone:Analyze',
        severity: 'error',
        message: msg,
      });
      setCaptureError(
        isAdmin
          ? msg
          : bi(
              'ভয়েস রেকর্ডিং বিশ্লেষণ করা যায়নি। পরিষ্কারভাবে কথা বলে আবার চেষ্টা করুন।',
              'Could not analyze voice recording. Please speak clearly and try again.'
            )
      );
    } finally {
      if (isMountedRef.current) {
        setIsAnalyzing(false);
      }
    }
  };

  const handleTogglePlaySavedSample = async (profile: CustomVoiceProfile) => {
    if (playingSavedSampleId === profile.id) {
      stopSavedSamplePreview();
      return;
    }

    stopSavedSamplePreview();
    let url: string | null = null;
    try {
      const storedBlob = await loadVoiceSampleBlobFromDb(profile.id);
      if (storedBlob) {
        url = URL.createObjectURL(storedBlob);
        savedSampleUrlRef.current = url;
      } else if (profile.sampleAudioDataUrl) {
        url = profile.sampleAudioDataUrl;
      }
    } catch {}

    if (!url) {
      setTtsNotice(
        bi(
          'এই প্রোফাইলের মূল রেকর্ডিং ক্লিপটি এই ডিভাইসে সংরক্ষিত নেই, তবে এনালাইজড ভয়েস প্রোফাইল দিয়ে কথা বলানো যাবে।',
          'The raw recording clip is not stored on this device, but you can still synthesize speech using the analyzed voice profile.'
        )
      );
      return;
    }

    const audio = new Audio(url);
    savedSampleAudioRef.current = audio;
    setPlayingSavedSampleId(profile.id);
    audio.onended = () => {
      stopSavedSamplePreview();
    };
    audio.onerror = () => {
      stopSavedSamplePreview();
    };
    try {
      await audio.play();
    } catch {
      stopSavedSamplePreview();
    }
  };

  const buildCombinedStylePrompt = (profile: CustomVoiceProfile): string => {
    const basePrompt = profile.synthesizedStylePrompt.trim();
    const note = extraStyleNote.trim();
    if (!note) return basePrompt.slice(0, 440);
    return `${basePrompt}. Extra delivery direction: ${note}`.slice(0, 440);
  };

  const playCalibratedBytes = async (rawBytes: Uint8Array, runId: number) => {
    if (!isMountedRef.current || activeRunIdRef.current !== runId) return;

    const processedBytes = await renderCalibratedAudioBytes({
      rawBytes,
      pitchCentsOffset,
      rateMultiplier,
      warmthBoost,
      loudnessBoost: allowFineTuning ? loudnessBoost : false,
    });

    if (!isMountedRef.current || activeRunIdRef.current !== runId) return;

    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({ sampleRate: 24000 });
    } else if (playbackCtxRef.current.state === 'suspended') {
      await playbackCtxRef.current.resume();
    }

    const audioBuffer = await decodeAudioToBuffer(
      processedBytes,
      playbackCtxRef.current,
      24000
    );

    if (!isMountedRef.current || activeRunIdRef.current !== runId) return;

    const ctx = playbackCtxRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    source.onended = () => {
      if (!isMountedRef.current || activeRunIdRef.current !== runId) return;
      if (isLoopingRef.current) {
        loopTimerRef.current = window.setTimeout(() => {
          if (
            isMountedRef.current &&
            activeRunIdRef.current === runId &&
            isLoopingRef.current
          ) {
            playCalibratedBytes(rawBytes, runId).catch(() => {
              if (isMountedRef.current) setIsSpeaking(false);
            });
          }
        }, 1400);
      } else {
        setIsSpeaking(false);
      }
    };

    playbackSourceRef.current = source;
    source.start();
    setIsSpeaking(true);
  };

  const handleGenerateSpeechWithProfile = async () => {
    if (isGenerating) return;
    if (isSpeaking) {
      stopPlayback();
      return;
    }

    if (!activeProfile) {
      setTtsNotice(
        bi(
          'প্রথমে বাম পাশ থেকে নিজের ভয়েস রেকর্ড ও এনালাইসিস করে সেভ করুন।',
          'First record or upload your voice sample on the left and analyze it.'
        )
      );
      return;
    }

    const trimmed = scriptText.trim();
    if (!trimmed) return;

    if (trimmed.length > studioCaps.maxScriptChars) {
      setTtsNotice(
        bi(
          `আপনার বর্তমান প্ল্যানে সর্বোচ্চ ${studioCaps.maxScriptChars.toLocaleString('en-US')} অক্ষরের স্ক্রিপ্ট ব্যবহার করা যায়।`,
          `Your current plan allows up to ${studioCaps.maxScriptChars.toLocaleString('en-US')} characters per script.`
        )
      );
      return;
    }

    setTtsError(null);
    setTtsNotice(null);

    const combinedStyle = buildCombinedStylePrompt(activeProfile);
    const cacheKey = `${activeProfile.id}::${activeProfile.matchedBaseVoice}::${combinedStyle}::${trimmed}`;
    const runId = ++activeRunIdRef.current;

    if (cachedRawBytes && cachedRawKey === cacheKey) {
      try {
        await playCalibratedBytes(cachedRawBytes, runId);
      } catch (err: any) {
        const errMsg = err?.message || bi('অডিও চালাতে সমস্যা হয়েছে।', 'Failed to play audio.');
        if (isAdmin) setTtsError(errMsg);
        else setTtsNotice(bi('অডিও চালাতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', 'Audio playback failed. Please try again.'));
        setIsSpeaking(false);
      }
      return;
    }

    setIsGenerating(true);
    try {
      const hasBackend = await checkBackendHealth();
      if (!hasBackend) {
        throw new Error(
          bi(
            'কাস্টম এনালাইজড ভয়েস স্পিচ তৈরির জন্য AI ব্যাকএন্ড সার্ভার সক্রিয় থাকতে হবে।',
            'AI backend server must be active to synthesize speech with custom analyzed voices.'
          )
        );
      }

      if (onBeforeGenerate) {
        const allowed = await onBeforeGenerate();
        if (!allowed) {
          setIsGenerating(false);
          return;
        }
      }

      const { audioData } = await generateTtsAudio({
        text: trimmed,
        voiceName: activeProfile.matchedBaseVoice || 'Kore',
        style: combinedStyle,
      });

      if (!isMountedRef.current || activeRunIdRef.current !== runId) return;

      const rawBytes = decodeBase64(audioData);
      setCachedRawBytes(rawBytes);
      setCachedRawKey(cacheKey);

      await playCalibratedBytes(rawBytes, runId);
    } catch (err: any) {
      const msg =
        err?.message ||
        bi(
          'ভয়েস প্রোফাইল দিয়ে স্পিচ তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
          'Could not synthesize speech with this voice profile. Please try again.'
        );
      reportAppIssue({
        source: 'VoiceClone:Synthesize',
        severity: 'error',
        message: msg,
      });
      if (isMountedRef.current && activeRunIdRef.current === runId) {
        if (isAdmin) setTtsError(msg);
        else
          setTtsNotice(
            bi(
              'ভয়েস প্রোফাইল দিয়ে স্পিচ তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
              'Could not synthesize speech right now. Please try again.'
            )
          );
      }
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleDownloadCalibratedWav = async () => {
    if (!activeProfile || isGenerating) return;
    const trimmed = scriptText.trim();
    if (!trimmed) return;

    if (trimmed.length > studioCaps.maxScriptChars) {
      setTtsNotice(
        bi(
          `আপনার বর্তমান প্ল্যানে সর্বোচ্চ ${studioCaps.maxScriptChars.toLocaleString('en-US')} অক্ষরের স্ক্রিপ্ট ব্যবহার করা যায়।`,
          `Your current plan allows up to ${studioCaps.maxScriptChars.toLocaleString('en-US')} characters per script.`
        )
      );
      return;
    }

    setTtsError(null);
    setTtsNotice(null);

    const combinedStyle = buildCombinedStylePrompt(activeProfile);
    const cacheKey = `${activeProfile.id}::${activeProfile.matchedBaseVoice}::${combinedStyle}::${trimmed}`;
    let rawBytesToUse = cachedRawBytes && cachedRawKey === cacheKey ? cachedRawBytes : null;

    if (!rawBytesToUse) {
      setIsGenerating(true);
      try {
        const hasBackend = await checkBackendHealth();
        if (!hasBackend) {
          throw new Error(
            bi(
              'WAV ডাউনলোডের জন্য AI ব্যাকএন্ড সার্ভার সক্রিয় থাকতে হবে।',
              'AI backend server must be active to download WAV audio.'
            )
          );
        }
        if (onBeforeGenerate) {
          const allowed = await onBeforeGenerate();
          if (!allowed) return;
        }
        const { audioData } = await generateTtsAudio({
          text: trimmed,
          voiceName: activeProfile.matchedBaseVoice || 'Kore',
          style: combinedStyle,
        });
        rawBytesToUse = decodeBase64(audioData);
        if (isMountedRef.current) {
          setCachedRawBytes(rawBytesToUse);
          setCachedRawKey(cacheKey);
        }
      } catch (err: any) {
        const msg = err?.message || bi('WAV ফাইল তৈরি করা যায়নি।', 'Failed to generate WAV file.');
        reportAppIssue({
          source: 'VoiceClone:Download',
          severity: 'error',
          message: msg,
        });
        if (isAdmin) setTtsError(msg);
        else
          setTtsNotice(
            bi('WAV ফাইল তৈরি করা যায়নি। অনুগ্রহ করে পরে আবার চেষ্টা করুন।', 'Could not prepare WAV file. Please try again later.')
          );
        return;
      } finally {
        if (isMountedRef.current) setIsGenerating(false);
      }
    }

    const calibratedBytes = await renderCalibratedAudioBytes({
      rawBytes: rawBytesToUse,
      pitchCentsOffset,
      rateMultiplier,
      warmthBoost,
      loudnessBoost: allowFineTuning ? loudnessBoost : false,
    });

    const blob = createCalibratedWavBlob(calibratedBytes);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeSlug = activeProfile.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'my-voice';
    a.download = `srabon-${safeSlug}-speech.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    setDownloaded(true);
    window.setTimeout(() => {
      if (isMountedRef.current) setDownloaded(false);
    }, 2000);
  };

  const handleSaveCalibrationToProfile = () => {
    if (!activeProfile) return;
    if (!allowFineTuning) {
      onOpenUpgradePackage?.('yearly');
      return;
    }
    onUpdateProfile({
      ...activeProfile,
      pitchCentsOffset,
      rateMultiplier,
      warmthBoost,
    });
    setTtsNotice(
      bi('ক্যালিব্রেশন সেটিংস প্রোফাইলে সেভ হয়েছে।', 'Calibration settings saved to profile.')
    );
  };

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Top Dedicated Premium Tool Header Card */}
        <section className="rounded-3xl bg-gradient-to-br from-white via-[#f8faff] to-amber-50/60 dark:from-[#0f172a] dark:via-[#111936] dark:to-[#1d1712] border border-indigo-200/80 dark:border-indigo-900/70 shadow-xl overflow-hidden">
          <div className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-indigo-100/80 dark:border-slate-800">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                <Crown size={14} />
                <span>
                  {bi(
                    'প্রিমিয়াম টুল · পার্সোনাল ভয়েস রেকর্ডিং ও এআই স্পিচ ক্লোন',
                    'Premium Tool · Personal Voice Recording & AI Speech Clone'
                  )}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-slate-900 dark:text-white">
                {bi(
                  'নিজের ভয়েস রেকর্ডিং, এনালাইসিস ও এআই স্পিচ স্টুডিও',
                  'Personal Voice Recording, Analysis & AI Speech Studio'
                )}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {bi(
                  'আপনার নিজের কণ্ঠ ৩–২৫ সেকেন্ড রেকর্ড (বা অডিও আপলোড) করে সেভ রাখুন। Gemini এআই আপনার কণ্ঠের পিচ, কথা বলার গতি, উষ্ণতা ও ভঙ্গি বিশ্লেষণ করে একটি কাস্টম Voice DNA প্রোফাইল তৈরি করবে—যার মাধ্যমে যেকোনো বাংলা বা ইংরেজি লেখা বলানো যাবে।',
                  'Record 3–25 seconds of your own voice (or upload audio) and save it. Gemini AI analyzes your pitch, pace, warmth, and cadence to create a custom Voice DNA profile that speaks any Bengali or English script.'
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-indigo-100 dark:border-slate-700 text-xs flex items-center gap-2 shadow-sm">
                <UserCheck size={14} className="text-indigo-600 dark:text-amber-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                  {isAdmin
                    ? bi(
                        `অ্যাডমিন (${profiles.length}/${maxProfiles} প্রোফাইল)`,
                        `Admin (${profiles.length}/${maxProfiles} Profiles)`
                      )
                    : userPlan === 'pro'
                    ? `${proPackageType === 'yearly' ? bi('ইয়ারলি প্রো', 'Yearly Pro') : bi('মান্থলি প্রো', 'Monthly Pro')} (${profiles.length}/${maxProfiles})`
                    : bi(
                        `ফ্রি ট্রায়াল (${profiles.length}/${maxProfiles} · ${Math.max(0, freeDailyLimit - usedToday)}/${freeDailyLimit} বাকি + ${bonusCredits} ক্রেডিট)`,
                        `Free Trial (${profiles.length}/${maxProfiles} · ${Math.max(0, freeDailyLimit - usedToday)}/${freeDailyLimit} Left + ${bonusCredits} Cr)`
                      )}
                </span>
              </div>

              <button
                type="button"
                onClick={onBackToStudio}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-indigo-200 dark:border-slate-700 text-xs font-semibold text-indigo-700 dark:text-indigo-200 transition-colors whitespace-nowrap"
              >
                <AudioLines size={14} />
                <span>{bi('Voice Studio-তে ফিরুন', 'Back to Voice Studio')}</span>
              </button>
            </div>
          </div>

          {/* Main Split Workspace */}
          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            {/* LEFT COLUMN: Step 1 Record/Upload + Step 2 Saved Voice Profiles */}
            <div className="lg:col-span-5 space-y-6">
              {/* Step 1 Card */}
              <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-indigo-100 dark:border-slate-800 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-amber-400">
                    {bi('ধাপ ১ · নিজের কণ্ঠ রেকর্ড করুন', 'Step 1 · Record Your Voice')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMicIssueReason(
                          micPermissionState === 'denied'
                            ? 'denied'
                            : micPermissionState === 'unsupported'
                            ? 'unsupported'
                            : 'prompt-guide'
                        );
                        setShowMicModal(true);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                        micPermissionState === 'granted'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                          : micPermissionState === 'denied' || micPermissionState === 'unsupported'
                          ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950'
                          : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950'
                      }`}
                      title={bi('মাইক্রোফোন পপআপ ও অনুমতি সেটিংস দেখুন', 'Open microphone popup & permission settings')}
                    >
                      {micPermissionState === 'denied' || micPermissionState === 'unsupported' ? (
                        <MicOff size={12} />
                      ) : (
                        <Mic size={12} />
                      )}
                      <span>
                        {micPermissionState === 'granted'
                          ? bi('মাইক চালু', 'Mic Ready')
                          : micPermissionState === 'denied'
                          ? bi('মাইক ব্লকড · পপআপ গাইড', 'Mic Blocked · Fix')
                          : micPermissionState === 'unsupported'
                          ? bi('মাইক অনুপলব্ধ · সাহায্য', 'No Mic · Help')
                          : bi('মাইক পপআপ / অনুমতি', 'Mic Popup / Access')}
                      </span>
                    </button>

                    <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      {isRecording
                        ? `${formatSeconds(recordSeconds)} / ${formatSeconds(MAX_RECORD_SECONDS)}`
                        : capturedBlob
                        ? bi(`${capturedDurationSec}s প্রস্তুত`, `${capturedDurationSec}s ready`)
                        : bi('৩–২৫ সেকেন্ড', '3–25 seconds')}
                    </span>
                  </div>
                </div>

                {/* Guided Sample Script */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950/70 border border-indigo-100/80 dark:border-slate-800 space-y-1">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {bi(
                      'রেকর্ডিংয়ের সময় চাইলে এই লাইনটি দেখে স্বাভাবিকভাবে পড়তে পারেন:',
                      'Read this prompt naturally while recording for best calibration:'
                    )}
                  </p>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed italic">
                    &ldquo;{lang === 'bn' ? SAMPLE_READING_SCRIPT_BN : SAMPLE_READING_SCRIPT_EN}&rdquo;
                  </p>
                </div>

                {/* Live Mic Meter & Record Controls */}
                <div className="rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white p-5 flex flex-col items-center gap-4 border border-indigo-500/30">
                  {isRequestingMic && (
                    <div className="w-full p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs flex items-center justify-center gap-2 text-center">
                      <Loader2 size={14} className="animate-spin shrink-0" />
                      <span>
                        {bi(
                          'ব্রাউজারে মাইক্রোফোন অনুমতির পপআপ এলে "Allow" চাপুন...',
                          'Look for the browser microphone popup and click "Allow"...'
                        )}
                      </span>
                    </div>
                  )}

                  {/* Live Meter Bars */}
                  <div className="h-12 w-full flex items-end justify-center gap-1.5 px-2">
                    {micLevels.map((lvl, idx) => (
                      <div
                        key={idx}
                        className={`w-1.5 rounded-full transition-all duration-100 ${
                          isRecording
                            ? 'bg-gradient-to-t from-amber-500 to-indigo-400'
                            : capturedBlob
                            ? 'bg-teal-400/70'
                            : 'bg-slate-700'
                        }`}
                        style={{ height: `${isRecording ? lvl : capturedBlob ? 28 + (idx % 4) * 10 : 18}%` }}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isAnalyzing || isRequestingMic}
                      className={`inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-lg ${
                        isRecording
                          ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950'
                      } disabled:opacity-50`}
                    >
                      {isRecording ? (
                        <>
                          <Square size={16} className="fill-current" />
                          <span>
                            {bi(
                              `রেকর্ডিং থামান (${formatSeconds(recordSeconds)})`,
                              `Stop Recording (${formatSeconds(recordSeconds)})`
                            )}
                          </span>
                        </>
                      ) : isRequestingMic ? (
                        <>
                          <Loader2 size={17} className="animate-spin" />
                          <span>{bi('পপআপ অপেক্ষা করছে...', 'Requesting Mic...')}</span>
                        </>
                      ) : (
                        <>
                          <Mic size={17} />
                          <span>
                            {capturedBlob
                              ? bi('নতুন করে রেকর্ড', 'Record Again')
                              : bi('রেকর্ডিং শুরু করুন', 'Start Recording')}
                          </span>
                        </>
                      )}
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
                      onChange={handleUploadAudioFile}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isRecording || isAnalyzing || isRequestingMic}
                      className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-slate-100 transition-colors disabled:opacity-50"
                    >
                      <Upload size={14} />
                      <span>{bi('অডিও আপলোড', 'Upload Audio')}</span>
                    </button>
                  </div>
                </div>

                {/* Preview & Analyze CTA when audio is captured */}
                {capturedBlob && capturedPreviewUrl && (
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-950/80 border border-teal-200 dark:border-teal-900/60 space-y-3">
                    <audio
                      ref={previewAudioRef}
                      src={capturedPreviewUrl}
                      onEnded={() => setIsPlayingCaptured(false)}
                      className="hidden"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={toggleCapturedPreviewPlayback}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-xs font-semibold text-teal-700 dark:text-teal-300"
                      >
                        {isPlayingCaptured ? <Pause size={13} /> : <Play size={13} />}
                        <span>
                          {isPlayingCaptured ? bi('বিরতি', 'Pause') : bi('রেকর্ডিং শুনুন', 'Play Recording')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          stopCapturedPreview();
                          setCapturedBlob(null);
                          setCapturedPreviewUrl(null);
                          setCapturedDurationSec(0);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <RotateCcw size={12} />
                        <span>{bi('বাদ দিন', 'Discard')}</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="voice-clone-name-input"
                        className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                      >
                        {bi('ভয়েস প্রোফাইলের নাম (ঐচ্ছিক)', 'Voice Profile Name (Optional)')}
                      </label>
                      <input
                        id="voice-clone-name-input"
                        type="text"
                        value={customProfileLabel}
                        onChange={(e) => setCustomProfileLabel(e.target.value)}
                        maxLength={48}
                        placeholder={bi(
                          'যেমন: আমার উপস্থাপনা ভয়েস / আমার অ্যালার্ম',
                          'e.g., My Presentation Voice / My Alarm'
                        )}
                        className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAnalyzeAndSaveVoice}
                      disabled={isAnalyzing}
                      className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-teal-600 hover:from-indigo-500 hover:via-blue-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>{bi('ভয়েস রেকর্ডিং বিশ্লেষণ হচ্ছে...', 'Analyzing voice sample...')}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>{bi('রেকর্ডিং এনালাইসিস ও সেভ করুন', 'Analyze & Save Voice')}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {captureError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-200 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{captureError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMicModal(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/60 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-100 font-semibold transition-colors"
                    >
                      <Mic size={12} />
                      <span>{bi('মাইক্রোফোন পপআপ গাইড দেখুন', 'Open Mic Popup Guide')}</span>
                    </button>
                  </div>
                )}

                {captureSuccessNotice && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                    <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                    <span>{captureSuccessNotice}</span>
                  </div>
                )}
              </div>

              {/* Step 2: Saved Voice Profiles Shelf */}
              <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-indigo-100 dark:border-slate-800 p-5 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-amber-400">
                    {bi('ধাপ ২ · সংরক্ষিত ভয়েস প্রোফাইল', 'Step 2 · Saved Voice Profiles')} ({profiles.length}/{maxProfiles})
                  </span>
                  {profiles.length >= maxProfiles && !isAdmin && onOpenUpgradePackage && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenUpgradePackage(studioTier === 'monthly' ? 'yearly' : 'monthly')
                      }
                      className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      {bi('আরও প্রোফাইল আপগ্রেড', 'Upgrade for more profiles')}
                    </button>
                  )}
                </div>

                {profiles.length === 0 ? (
                  <div className="p-5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-1.5">
                    <FileAudio size={24} className="mx-auto text-slate-400" />
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {bi('এখনও কোনো নিজস্ব ভয়েস প্রোফাইল সেভ করা হয়নি', 'No personal voice profiles saved yet')}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {bi(
                        'উপরের ধাপ ১ থেকে আপনার কণ্ঠ রেকর্ড করে এনালাইসিস করুন।',
                        'Record and analyze your voice in Step 1 above.'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {profiles.map((prof) => {
                      const isSelected = activeProfile?.id === prof.id;
                      const isPlayingThis = playingSavedSampleId === prof.id;
                      const isEditing = editingProfileId === prof.id;

                      return (
                        <div
                          key={prof.id}
                          className={`rounded-xl p-3.5 border transition-all space-y-2.5 ${
                            isSelected
                              ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-500/30'
                              : 'bg-white dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editingNameDraft}
                                    onChange={(e) => setEditingNameDraft(e.target.value)}
                                    maxLength={48}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 px-2 py-1 text-xs font-semibold text-slate-900 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const trimmed = editingNameDraft.trim();
                                      if (trimmed) {
                                        onUpdateProfile({ ...prof, name: trimmed });
                                      }
                                      setEditingProfileId(null);
                                    }}
                                    className="p-1.5 rounded-lg bg-indigo-600 text-white"
                                    aria-label={bi('নাম সেভ করুন', 'Save name')}
                                  >
                                    <Check size={12} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onSelectProfile(prof.id)}
                                  className="text-left w-full group"
                                >
                                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-amber-300">
                                    {prof.name}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {localizeGender(prof.gender, lang)} · {localizePitch(prof.pitchLabel, lang)} ·{' '}
                                    {bi('বেস:', 'Base:')} {prof.matchedBaseVoice} ({prof.durationSec}s)
                                  </p>
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleTogglePlaySavedSample(prof)}
                                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                                  isPlayingThis
                                    ? 'bg-teal-600 text-white border-teal-600'
                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                                }`}
                                title={bi('নিজের রেকর্ডিং শুনুন', 'Play original sample')}
                                aria-label={bi(`${prof.name} এর স্যাম্পল শুনুন`, `Play sample for ${prof.name}`)}
                              >
                                {isPlayingThis ? <Pause size={12} /> : <Play size={12} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProfileId(prof.id);
                                  setEditingNameDraft(prof.name);
                                }}
                                className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600"
                                title={bi('নাম পরিবর্তন করুন', 'Rename profile')}
                                aria-label={bi(`${prof.name} নাম পরিবর্তন`, `Rename ${prof.name}`)}
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteVoiceSampleBlobFromDb(prof.id);
                                  onDeleteProfile(prof.id);
                                }}
                                className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600"
                                title={bi('ডিলিট করুন', 'Delete profile')}
                                aria-label={bi(`${prof.name} মুছুন`, `Delete ${prof.name}`)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                            <button
                              type="button"
                              onClick={() => onSelectProfile(prof.id)}
                              className={`text-[11px] font-semibold ${
                                isSelected
                                  ? 'text-indigo-700 dark:text-amber-300'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600'
                              }`}
                            >
                              {isSelected
                                ? bi('✓ বর্তমানে নির্বাচিত', '✓ Currently Selected')
                                : bi('এটি দিয়ে বলুন', 'Use This Voice')}
                            </button>
                            <button
                              type="button"
                              onClick={() => onUseProfileInStudio(prof.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              <span>{bi('Voice Studio-তে খুলুন', 'Open in Voice Studio')}</span>
                              <ArrowRight size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Voice DNA Readout + Calibration + Speech Generator */}
            <div className="lg:col-span-7 space-y-5">
              {!activeProfile ? (
                <div className="h-full min-h-[420px] rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 border border-dashed border-indigo-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-amber-500 text-white flex items-center justify-center shadow-lg">
                    <Waves size={28} />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-xl font-serif font-medium text-slate-900 dark:text-white">
                      {bi(
                        'বাম পাশ থেকে প্রথম ভয়েস স্যাম্পল রেকর্ড করুন',
                        'Record Your First Voice Sample on the Left'
                      )}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {bi(
                        'রেকর্ড করে "রেকর্ডিং এনালাইসিস ও সেভ করুন" বাটনে চাপ দিলেই আপনার Voice DNA বিশ্লেষণ হয়ে যাবে এবং এখানে যেকোনো লেখা আপনার কণ্ঠের প্রোফাইলে বাজানো যাবে।',
                        'Record and click "Analyze & Save Recording" to extract your Voice DNA and play any script in your calibrated voice profile.'
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Extracted Voice DNA Card */}
                  <div className="rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-teal-50/50 dark:from-[#131d3b] dark:via-slate-900 dark:to-[#0f2224] border border-indigo-200/80 dark:border-indigo-800/70 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-amber-400">
                          {bi('Voice DNA বিশ্লেষণ', 'Voice DNA Analysis')} · {activeProfile.name}
                        </p>
                        <h3 className="text-lg font-serif font-medium text-slate-900 dark:text-white mt-0.5">
                          {bi('শনাক্তকৃত কণ্ঠস্বর বৈশিষ্ট্য', 'Detected Voice Characteristics')}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDnaPrompt((prev) => !prev)}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline"
                      >
                        {showDnaPrompt
                          ? bi('AI প্রম্পট লুকান', 'Hide AI Prompt')
                          : bi('AI স্টাইল প্রম্পট দেখুন', 'View AI Style Prompt')}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-950/70 border border-indigo-100 dark:border-slate-800">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          {bi('কণ্ঠের ধরন', 'Voice Gender')}
                        </p>
                        <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                          {localizeGender(activeProfile.gender, lang)}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-950/70 border border-indigo-100 dark:border-slate-800">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          {bi('পিচ রেজিস্টার', 'Pitch Register')}
                        </p>
                        <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                          {localizePitch(activeProfile.pitchLabel, lang)}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-950/70 border border-indigo-100 dark:border-slate-800">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          {bi('কথা বলার গতি', 'Speaking Pace')}
                        </p>
                        <p className="font-semibold text-slate-900 dark:text-white mt-0.5 truncate">
                          {activeProfile.speakingRateLabel}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-950/70 border border-indigo-100 dark:border-slate-800">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          {bi('ম্যাচড বেস ভয়েস', 'Matched Base Voice')}
                        </p>
                        <p className="font-semibold text-indigo-700 dark:text-amber-300 mt-0.5">
                          {activeProfile.matchedBaseVoice}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1 leading-relaxed">
                      <p>
                        <strong className="text-slate-900 dark:text-white">
                          {bi('টোন ও উষ্ণতা:', 'Tone & Warmth:')}
                        </strong>{' '}
                        {activeProfile.toneDescription}
                      </p>
                      <p>
                        <strong className="text-slate-900 dark:text-white">
                          {bi('উচ্চারণ ও ছন্দ:', 'Accent & Cadence:')}
                        </strong>{' '}
                        {activeProfile.accentNotes}
                      </p>
                      {activeProfile.transcriptSample && (
                        <p className="text-slate-500 dark:text-slate-400">
                          <strong>{bi('রেকর্ডিং থেকে শোনা বাক্য:', 'Transcript Sample:')}</strong> &ldquo;
                          {activeProfile.transcriptSample}&rdquo;
                        </p>
                      )}
                    </div>

                    {showDnaPrompt && (
                      <div className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono leading-relaxed">
                        {activeProfile.synthesizedStylePrompt}
                      </div>
                    )}
                  </div>

                  {/* Fine Acoustic Calibration Sliders */}
                  <div className="rounded-2xl bg-amber-50/60 dark:bg-slate-900/80 border border-amber-200/80 dark:border-amber-900/50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        <Sliders size={14} />
                        <span>{bi('অ্যাকুস্টিক ক্যালিব্রেশন (Pitch · Pace · Warmth)', 'Acoustic Calibration (Pitch · Pace · Warmth)')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!allowFineTuning && onOpenUpgradePackage ? (
                          <button
                            type="button"
                            onClick={() => onOpenUpgradePackage('yearly')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold transition-colors"
                          >
                            <Lock size={10} />
                            <span>{bi('Yearly দিয়ে ফাইন-টিউন', 'Fine-tune with Yearly')}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSaveCalibrationToProfile}
                            className="text-[11px] font-semibold text-indigo-700 dark:text-amber-300 hover:underline"
                          >
                            {bi('সেটিংস প্রোফাইলে সেভ করুন', 'Save Settings to Profile')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <label className="space-y-1">
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>{bi('পিচ ম্যাচ', 'Pitch Match')}</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {pitchCentsOffset > 0 ? `+${pitchCentsOffset}` : pitchCentsOffset} {bi('সেন্টস', 'cents')}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-200}
                          max={200}
                          step={10}
                          value={pitchCentsOffset}
                          disabled={!allowFineTuning}
                          onChange={(e) => setPitchCentsOffset(Number(e.target.value))}
                          className="w-full accent-indigo-600 disabled:opacity-50"
                        />
                      </label>

                      <label className="space-y-1">
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>{bi('গতি (Pace)', 'Speaking Pace')}</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {rateMultiplier.toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.85}
                          max={1.2}
                          step={0.02}
                          value={rateMultiplier}
                          disabled={!allowFineTuning}
                          onChange={(e) => setRateMultiplier(Number(e.target.value))}
                          className="w-full accent-indigo-600 disabled:opacity-50"
                        />
                      </label>

                      <label className="space-y-1">
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>{bi('ভয়েস উষ্ণতা EQ', 'Voice Warmth EQ')}</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {warmthBoost > 0 ? `+${warmthBoost}` : warmthBoost} dB
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-4}
                          max={4}
                          step={0.5}
                          value={warmthBoost}
                          disabled={!allowFineTuning}
                          onChange={(e) => setWarmthBoost(Number(e.target.value))}
                          className="w-full accent-indigo-600 disabled:opacity-50"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Step 3: Script & Speech Generation */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {bi(
                          'ধাপ ৩ · যেকোনো লেখা লিখে এই ভয়েস প্রোফাইলে বলান',
                          'Step 3 · Write Any Script to Speak in This Voice Profile'
                        )}
                      </span>
                      <span className="text-xs font-medium text-slate-400 tabular-nums">
                        {scriptText.length.toLocaleString('en-US')} / {studioCaps.maxScriptChars.toLocaleString('en-US')} {bi('অক্ষর', 'chars')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {CLONE_TEXT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            stopPlayback();
                            setScriptText(preset.text);
                            setTtsNotice(null);
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            scriptText.trim() === preset.text
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {lang === 'bn' ? preset.labelBn : preset.labelEn}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={scriptText}
                      onChange={(e) => {
                        if (isSpeaking) stopPlayback();
                        setScriptText(e.target.value);
                        setTtsError(null);
                        setTtsNotice(null);
                      }}
                      rows={4}
                      placeholder={bi(
                        'বাংলা, ইংরেজি বা যেকোনো ভাষায় আপনার লেখা লিখুন...',
                        'Write your script in Bengali, English, or any language...'
                      )}
                      className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 text-base sm:text-lg leading-relaxed text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                    />

                    <input
                      type="text"
                      value={extraStyleNote}
                      onChange={(e) => {
                        if (isSpeaking) stopPlayback();
                        setExtraStyleNote(e.target.value);
                      }}
                      placeholder={bi(
                        'ঐচ্ছিক অতিরিক্ত মুড (যেমন: আনন্দিত ও প্রাণবন্তভাবে / ধীর ও শান্তভাবে)...',
                        'Optional extra mood (e.g., joyful & energetic / slow & calm)...'
                      )}
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />

                    {/* Waveform Stage */}
                    <div
                      onClick={handleGenerateSpeechWithProfile}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleGenerateSpeechWithProfile();
                        }
                      }}
                      className="relative h-28 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors"
                    >
                      {isGenerating ? (
                        <div className="flex flex-col items-center gap-1.5 text-indigo-600 dark:text-amber-400">
                          <Loader2 size={24} className="animate-spin" />
                          <span className="text-xs font-medium">
                            {bi(
                              `“${activeProfile.name}” ভয়েসে অডিও তৈরি হচ্ছে...`,
                              `Generating audio in “${activeProfile.name}” voice...`
                            )}
                          </span>
                        </div>
                      ) : isSpeaking ? (
                        <div className="w-full h-full">
                          <AudioVisualizer
                            isPlaying={true}
                            color={isDarkMode ? '#fbbf24' : '#4f46e5'}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                          <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm">
                            <Volume2 size={18} className="text-indigo-600 dark:text-amber-400" />
                          </div>
                          <span className="text-xs font-medium">
                            {bi(
                              `ক্লিক করে “${activeProfile.name}” কণ্ঠে শুনুন`,
                              `Click to listen in “${activeProfile.name}” voice`
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {ttsNotice && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                        <AlertCircle size={15} className="shrink-0 mt-0.5" />
                        <span>{ttsNotice}</span>
                      </div>
                    )}

                    {isAdmin && ttsError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-start gap-2">
                        <AlertCircle size={15} className="shrink-0 mt-0.5" />
                        <span>{ttsError}</span>
                      </div>
                    )}

                    {/* Action Controls */}
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <button
                        type="button"
                        onClick={handleGenerateSpeechWithProfile}
                        disabled={isGenerating || !scriptText.trim()}
                        className={`flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl text-sm font-bold shadow-md transition-all ${
                          isSpeaking
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                            : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 hover:from-indigo-500 hover:via-blue-500 hover:to-violet-500 text-white shadow-indigo-600/20'
                        } disabled:opacity-50`}
                      >
                        {isGenerating ? (
                          <Loader2 size={17} className="animate-spin" />
                        ) : isSpeaking ? (
                          <Square size={16} className="fill-current" />
                        ) : (
                          <Play size={16} className="fill-current" />
                        )}
                        <span>
                          {isGenerating
                            ? bi('জেনারেট হচ্ছে...', 'Generating...')
                            : isSpeaking
                            ? bi('থামান', 'Stop')
                            : bi('আমার ভয়েস প্রোফাইলে বলুন', 'Speak in My Voice Profile')}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsLooping((prev) => !prev)}
                        className={`inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl text-xs font-semibold border transition-colors ${
                          isLooping
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Repeat size={14} />
                        <span>{isLooping ? bi('লুপ চালু', 'Loop On') : bi('লুপ', 'Loop')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadCalibratedWav}
                        disabled={isGenerating || !scriptText.trim()}
                        className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        {downloaded ? (
                          <Check size={14} className="text-emerald-600" />
                        ) : (
                          <Download size={14} />
                        )}
                        <span>
                          {downloaded ? bi('সেভ হয়েছে', 'Saved') : bi('WAV ডাউনলোড', 'Download WAV')}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <AdBanner
          slotId={import.meta.env.VITE_ADSENSE_SLOT_STUDIO}
          format="horizontal"
        />

        <footer className="pt-4 pb-6 border-t border-indigo-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {bi(
              '© ২০২৬ শ্রাবণ গো · ব্যক্তিগত ভয়েস রেকর্ডিং ও এআই স্পিচ স্টুডিও',
              '© 2026 Srabon Go · Personal Voice Recording & AI Speech Studio'
            )}
          </span>
          {onOpenLegal && (
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => onOpenLegal('about')} className="hover:text-indigo-700 dark:hover:text-white">
                {bi('আমাদের সম্পর্কে', 'About')}
              </button>
              <button type="button" onClick={() => onOpenLegal('privacy')} className="hover:text-indigo-700 dark:hover:text-white">
                {bi('গোপনীয়তা নীতি', 'Privacy Policy')}
              </button>
              <button type="button" onClick={() => onOpenLegal('terms')} className="hover:text-indigo-700 dark:hover:text-white">
                {bi('শর্তাবলি', 'Terms')}
              </button>
              <button type="button" onClick={() => onOpenLegal('contact')} className="hover:text-indigo-700 dark:hover:text-white">
                {bi('যোগাযোগ', 'Contact')}
              </button>
            </div>
          )}
        </footer>
      </div>

      {/* Interactive Microphone Permission & Troubleshoot Popup */}
      {showMicModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mic-permission-modal-title"
        >
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowMicModal(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-slate-700 shadow-2xl p-6 space-y-4 animate-slide-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    micPermissionState === 'granted'
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      : micIssueReason === 'prompt-guide'
                      ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-amber-400'
                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {micIssueReason === 'denied' || micIssueReason === 'unsupported' ? (
                    <MicOff size={20} />
                  ) : (
                    <Mic size={20} />
                  )}
                </div>
                <div>
                  <h3
                    id="mic-permission-modal-title"
                    className="text-base sm:text-lg font-serif font-semibold text-slate-900 dark:text-white"
                  >
                    {micIssueReason === 'no-device'
                      ? bi('মাইক্রোফোন পাওয়া যায়নি', 'No Microphone Detected')
                      : micIssueReason === 'busy'
                      ? bi('মাইক্রোফোন ব্যস্ত বা লকড', 'Microphone Is Busy')
                      : micIssueReason === 'unsupported'
                      ? bi('মাইক্রোফোন অ্যাক্সেস অনুপলব্ধ', 'Microphone Access Unavailable')
                      : micIssueReason === 'denied'
                      ? bi('মাইক্রোফোন পপআপ ব্লক বা ডিনাইড', 'Microphone Popup Blocked or Denied')
                      : bi('মাইক্রোফোন অনুমতি ও রেকর্ডিং গাইড', 'Microphone Permission & Setup')}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {bi('ভয়েস রেকর্ডিং চালু করতে নিচের অপশন দেখুন', 'Follow these options to enable live recording')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMicModal(false)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                aria-label={bi('বন্ধ করুন', 'Close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
              {isEmbeddedIframe && (
                <p className="font-medium text-indigo-700 dark:text-amber-300">
                  {bi(
                    '• আপনি এখন Embedded Preview ফ্রেমে আছেন—অনেক ব্রাউজার আইফ্রেমের ভেতর Mic Popup দেখায় না। নিচের "নতুন ট্যাবে খুলুন" বাটনে ক্লিক করলে ব্রাউজারের Mic Allow পপআপ সরাসরি দেখা যাবে।',
                    '• You are currently inside an embedded preview iframe—browsers often suppress the mic permission popup inside iframes. Click "Open in New Tab" below to trigger the native browser Allow Mic popup directly.'
                  )}
                </p>
              )}
              <p>
                {bi(
                  '১. ব্রাউজার অ্যাড্রেস বারের বাম পাশে Lock / Tune আইকনে ক্লিক করে Microphone → Allow নির্বাচন করে পেজ রিলোড করুন।',
                  '1. Click the Lock / Tune icon in your browser address bar, set Microphone → Allow, and reload.'
                )}
              </p>
              <p>
                {bi(
                  '২. অথবা আপনার ফোনের ভয়েস রেকর্ডার দিয়ে রেকর্ড করে "অডিও আপলোড" বাটন থেকে সহজেই এনালাইসিস করুন।',
                  '2. Or record with your device voice recorder app and click "Upload Audio" to analyze instantly.'
                )}
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowMicModal(false);
                  void startRecording();
                }}
                disabled={isRequestingMic}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs sm:text-sm font-bold shadow-md transition-all disabled:opacity-50"
              >
                <Mic size={16} />
                <span>
                  {bi('মাইক্রোফোন অনুমতি চান ও রেকর্ড শুরু করুন', 'Request Mic Permission & Start Recording')}
                </span>
              </button>

              {isEmbeddedIframe && typeof window !== 'undefined' && (
                <a
                  href={`${window.location.origin}${window.location.pathname}${window.location.search}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition-colors"
                >
                  <ExternalLink size={15} />
                  <span>{bi('নতুন ট্যাবে খুলুন (Mic Popup চালু করতে)', 'Open in New Tab (Show Mic Popup)')}</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowMicModal(false);
                  fileInputRef.current?.click();
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-colors"
              >
                <Upload size={15} />
                <span>{bi('রেকর্ডেড অডিও ফাইল আপলোড করুন', 'Upload Recorded Audio File Instead')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomVoiceCloneStudio;
