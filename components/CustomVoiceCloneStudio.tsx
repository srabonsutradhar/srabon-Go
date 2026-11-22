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
  FileAudio,
  Lock,
  Loader2,
  Mic,
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

const SAMPLE_READING_SCRIPT =
  'হ্যালো! আমি আমার নিজের ভয়েস স্যাম্পল রেকর্ড করছি, যাতে এআই আমার কণ্ঠের সুর, গতি ও উচ্চারণ বিশ্লেষণ করে যেকোনো লেখা সুন্দরভাবে বলতে পারে।';

const CLONE_TEXT_PRESETS = [
  {
    id: 'intro-bn',
    label: 'নিজের কণ্ঠে পরিচিতি',
    text: 'নমস্কার ও শুভ দিন! আমি আমার নিজস্ব এআই ভয়েস প্রোফাইল থেকে কথা বলছি। এখন যেকোনো স্ক্রিপ্ট আমার কণ্ঠের ছন্দেই শুনতে পারবেন।',
  },
  {
    id: 'vlog-bn',
    label: 'ভিডিও / রিলস ন্যারেটর',
    text: 'বন্ধুরা, আজকের ভিডিওতে আমরা দেখব কীভাবে প্রযুক্তির সাহায্যে নিজের কণ্ঠস্বরকে ডিজিটালভাবে সংরক্ষণ করে কনটেন্ট তৈরি করা যায়।',
  },
  {
    id: 'alarm-bn',
    label: 'ব্যক্তিগত অ্যালার্ম',
    text: 'সময় হয়ে গেছে! এখনই উঠে পড়ুন এবং আজকের গুরুত্বপূর্ণ কাজটি পূর্ণ মনোযোগ দিয়ে শুরু করুন।',
  },
  {
    id: 'en-pro',
    label: 'English Presentation',
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
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }
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

  const startRecording = async () => {
    if (isRecording || isAnalyzing) return;
    setCaptureError(null);
    setCaptureSuccessNotice(null);
    stopCapturedPreview();
    stopPlayback();

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCaptureError(
        'এই ব্রাউজারে মাইক্রোফোন রেকর্ডিং সাপোর্ট করে না। নিচের অডিও ফাইল আপলোড অপশন ব্যবহার করুন।'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
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
            'রেকর্ডিং খুব ছোট হয়ে গেছে। স্পষ্ট ফলাফলের জন্য অন্তত ৩–১০ সেকেন্ড কথা বলুন।'
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
      recorder.start(250);

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
      const rawMsg = String(err?.message || err?.name || '');
      if (
        rawMsg.toLowerCase().includes('denied') ||
        rawMsg.toLowerCase().includes('permission') ||
        rawMsg.toLowerCase().includes('notallowed')
      ) {
        setCaptureError(
          'মাইক্রোফোন ব্যবহারের অনুমতি দেওয়া হয়নি। ব্রাউজার অ্যাড্রেস বার থেকে Microphone Allow করুন অথবা নিচ থেকে রেকর্ডেড অডিও ফাইল আপলোড করুন।'
        );
      } else {
        setCaptureError(
          'মাইক্রোফোন চালু করা যায়নি। ডিভাইসের মাইক চেক করুন অথবা অডিও ফাইল আপলোড করুন।'
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

    if (file.size > MAX_UPLOAD_BYTES) {
      setCaptureError('অডিও ফাইলের সাইজ সর্বোচ্চ ৮ MB-এর মধ্যে হতে হবে।');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    let detectedDuration = 10;
    try {
      detectedDuration = await new Promise<number>((resolve) => {
        const probe = new Audio(previewUrl);
        probe.onloadedmetadata = () => {
          const d = Number.isFinite(probe.duration) ? probe.duration : 10;
          resolve(Math.max(1, Math.min(60, Math.round(d))));
        };
        probe.onerror = () => resolve(10);
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
          `ফ্রি ট্রায়ালে সর্বোচ্চ ${maxProfiles}টি ভয়েস প্রোফাইল সেভ করা যায়। আরও ভয়েস প্রোফাইল সংরক্ষণ ও প্রো ক্যালিব্রেশনের জন্য Monthly (৩টি) বা Yearly (১০টি) প্রো নিন।`
        );
        onOpenUpgradePackage?.('monthly');
      } else if (studioTier === 'monthly') {
        setCaptureError(
          `Monthly প্রো-তে সর্বোচ্চ ${maxProfiles}টি প্রোফাইল রাখা যায়। ১০টি প্রোফাইল ও ফাইন টিউনিংয়ের জন্য Yearly প্যাকে আপগ্রেড করুন বা পুরোনো ১টি মুছুন।`
        );
        onOpenUpgradePackage?.('yearly');
      } else {
        setCaptureError(
          `সর্বোচ্চ ${maxProfiles}টি প্রোফাইল সেভ করা আছে। নতুন সেভ করতে পুরোনো একটি ডিলিট করুন।`
        );
      }
      return;
    }

    if (capturedDurationSec < MIN_RECORD_SECONDS && capturedBlob.size < 4000) {
      setCaptureError('ভয়েস এনালাইসিসের জন্য অন্তত ৩ সেকেন্ডের স্পষ্ট অডিও প্রয়োজন।');
      return;
    }

    setIsAnalyzing(true);
    try {
      const hasBackend = await checkBackendHealth();
      if (!hasBackend) {
        throw new Error(
          'ভয়েস এনালাইসিসের জন্য AI ব্যাকএন্ড সার্ভার সংযুক্ত থাকতে হবে।'
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
        `"${newProfile.name}" বিশ্লেষণ ও সেভ সম্পন্ন হয়েছে! এখন ডানপাশের বক্সে যেকোনো টেক্সট লিখে আপনার ভয়েসে বলান।`
      );
    } catch (err: any) {
      const msg =
        err?.message ||
        'ভয়েস রেকর্ডিং বিশ্লেষণ করা যায়নি। পরিষ্কারভাবে কথা বলে আবার চেষ্টা করুন।';
      reportAppIssue({
        source: 'VoiceClone:Analyze',
        severity: 'error',
        message: msg,
      });
      setCaptureError(msg);
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
      setTtsNotice('এই প্রোফাইলের মূল রেকর্ডিং ক্লিপটি এই ডিভাইসে সংরক্ষিত নেই, তবে এনালাইজড ভয়েস প্রোফাইল দিয়ে কথা বলানো যাবে।');
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
      setTtsNotice('প্রথমে বাম পাশ থেকে নিজের ভয়েস রেকর্ড ও এনালাইসিস করে সেভ করুন।');
      return;
    }

    const trimmed = scriptText.trim();
    if (!trimmed) return;

    if (trimmed.length > studioCaps.maxScriptChars) {
      setTtsNotice(
        `আপনার বর্তমান প্ল্যানে সর্বোচ্চ ${studioCaps.maxScriptChars.toLocaleString('en-US')} অক্ষরের স্ক্রিপ্ট ব্যবহার করা যায়।`
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
        setTtsError(err?.message || 'অডিও চালাতে সমস্যা হয়েছে।');
        setIsSpeaking(false);
      }
      return;
    }

    setIsGenerating(true);
    try {
      const hasBackend = await checkBackendHealth();
      if (!hasBackend) {
        throw new Error(
          'কাস্টম এনালাইজড ভয়েস স্পিচ তৈরির জন্য AI ব্যাকএন্ড সার্ভার সক্রিয় থাকতে হবে।'
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
        'ভয়েস প্রোফাইল দিয়ে স্পিচ তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';
      reportAppIssue({
        source: 'VoiceClone:Synthesize',
        severity: 'error',
        message: msg,
      });
      if (isMountedRef.current && activeRunIdRef.current === runId) {
        if (isAdmin) setTtsError(msg);
        else setTtsNotice(msg);
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
        `আপনার বর্তমান প্ল্যানে সর্বোচ্চ ${studioCaps.maxScriptChars.toLocaleString('en-US')} অক্ষরের স্ক্রিপ্ট ব্যবহার করা যায়।`
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
          throw new Error('WAV ডাউনলোডের জন্য AI ব্যাকএন্ড সার্ভার সক্রিয় থাকতে হবে।');
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
        const msg = err?.message || 'WAV ফাইল তৈরি করা যায়নি।';
        reportAppIssue({
          source: 'VoiceClone:Download',
          severity: 'error',
          message: msg,
        });
        if (isAdmin) setTtsError(msg);
        else setTtsNotice(msg);
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
    URL.revokeObjectURL(url);

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
    setTtsNotice('ক্যালিব্রেশন সেটিংস প্রোফাইলে সেভ হয়েছে।');
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
                <span>Premium Tool · Personal Voice Recording &amp; AI Speech Clone</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-slate-900 dark:text-white">
                নিজের ভয়েস রেকর্ডিং, এনালাইসিস ও এআই স্পিচ স্টুডিও
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                আপনার নিজের কণ্ঠ ৩–২৫ সেকেন্ড রেকর্ড (বা অডিও আপলোড) করে সেভ রাখুন। Gemini এআই আপনার কণ্ঠের পিচ, কথা বলার গতি, উষ্ণতা ও ভঙ্গি বিশ্লেষণ করে একটি কাস্টম Voice DNA প্রোফাইল তৈরি করবে—যার মাধ্যমে যেকোনো বাংলা বা ইংরেজি লেখা বলানো যাবে।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-indigo-100 dark:border-slate-700 text-xs flex items-center gap-2 shadow-sm">
                <UserCheck size={14} className="text-indigo-600 dark:text-amber-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                  {isAdmin
                    ? `Admin (${profiles.length}/${maxProfiles} Profiles)`
                    : userPlan === 'pro'
                    ? `${proPackageType === 'yearly' ? 'Yearly' : 'Monthly'} Pro (${profiles.length}/${maxProfiles})`
                    : `Free Trial (${profiles.length}/${maxProfiles} · ${Math.max(0, freeDailyLimit - usedToday)}/${freeDailyLimit} Left + ${bonusCredits} Cr)`}
                </span>
              </div>

              <button
                type="button"
                onClick={onBackToStudio}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-indigo-200 dark:border-slate-700 text-xs font-semibold text-indigo-700 dark:text-indigo-200 transition-colors whitespace-nowrap"
              >
                <AudioLines size={14} />
                <span>Voice Studio-তে ফিরুন</span>
              </button>
            </div>
          </div>

          {/* Main Split Workspace */}
          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            {/* LEFT COLUMN: Step 1 Record/Upload + Step 2 Saved Voice Profiles */}
            <div className="lg:col-span-5 space-y-6">
              {/* Step 1 Card */}
              <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-indigo-100 dark:border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-amber-400">
                    ধাপ ১ · নিজের কণ্ঠ রেকর্ড করুন
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {isRecording
                      ? `${formatSeconds(recordSeconds)} / ${formatSeconds(MAX_RECORD_SECONDS)}`
                      : capturedBlob
                      ? `${capturedDurationSec}s প্রস্তুত`
                      : '৩–২৫ সেকেন্ড'}
                  </span>
                </div>

                {/* Guided Sample Script */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950/70 border border-indigo-100/80 dark:border-slate-800 space-y-1">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    রেকর্ডিংয়ের সময় চাইলে এই লাইনটি দেখে স্বাভাবিকভাবে পড়তে পারেন:
                  </p>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed italic">
                    &ldquo;{SAMPLE_READING_SCRIPT}&rdquo;
                  </p>
                </div>

                {/* Live Mic Meter & Record Controls */}
                <div className="rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white p-5 flex flex-col items-center gap-4 border border-indigo-500/30">
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
                      disabled={isAnalyzing}
                      className={`inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-lg ${
                        isRecording
                          ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950'
                      } disabled:opacity-50`}
                    >
                      {isRecording ? (
                        <>
                          <Square size={16} className="fill-current" />
                          <span>রেকর্ডিং থামান ({formatSeconds(recordSeconds)})</span>
                        </>
                      ) : (
                        <>
                          <Mic size={17} />
                          <span>{capturedBlob ? 'নতুন করে রেকর্ড' : 'রেকর্ডিং শুরু করুন'}</span>
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
                      disabled={isRecording || isAnalyzing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-slate-100 transition-colors disabled:opacity-50"
                    >
                      <Upload size={14} />
                      <span>অডিও আপলোড</span>
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
                        <span>{isPlayingCaptured ? 'বিরতি' : 'রেকর্ডিং শুনুন'}</span>
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
                        <span>বাদ দিন</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="voice-clone-name-input"
                        className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                      >
                        ভয়েস প্রোফাইলের নাম (ঐচ্ছিক)
                      </label>
                      <input
                        id="voice-clone-name-input"
                        type="text"
                        value={customProfileLabel}
                        onChange={(e) => setCustomProfileLabel(e.target.value)}
                        maxLength={48}
                        placeholder="যেমন: আমার উপস্থাপনা ভয়েস / আমার অ্যালার্ম"
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
                          <span>ভয়েস রেকর্ডিং বিশ্লেষণ হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>রেকর্ডিং এনালাইসিস ও সেভ করুন</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {captureError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-200 flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{captureError}</span>
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
                    ধাপ ২ · সংরক্ষিত ভয়েস প্রোফাইল ({profiles.length}/{maxProfiles})
                  </span>
                  {profiles.length >= maxProfiles && !isAdmin && onOpenUpgradePackage && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenUpgradePackage(studioTier === 'monthly' ? 'yearly' : 'monthly')
                      }
                      className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      আরও প্রোফাইল আপগ্রেড
                    </button>
                  )}
                </div>

                {profiles.length === 0 ? (
                  <div className="p-5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-1.5">
                    <FileAudio size={24} className="mx-auto text-slate-400" />
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      এখনও কোনো নিজস্ব ভয়েস প্রোফাইল সেভ করা হয়নি
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      উপরের ধাপ ১ থেকে আপনার কণ্ঠ রেকর্ড করে এনালাইসিস করুন।
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
                                    aria-label="Save name"
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
                                    {prof.gender} · {prof.pitchLabel} · বেস: {prof.matchedBaseVoice} ({prof.durationSec}s)
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
                                title="নিজের রেকর্ডিং শুনুন"
                                aria-label={`Play sample for ${prof.name}`}
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
                                title="নাম পরিবর্তন করুন"
                                aria-label={`Rename ${prof.name}`}
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
                                title="ডিলিট করুন"
                                aria-label={`Delete ${prof.name}`}
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
                              {isSelected ? '✓ বর্তমানে নির্বাচিত' : 'এটি দিয়ে বলুন'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onUseProfileInStudio(prof.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              <span>Voice Studio-তে খুলুন</span>
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
                      বাম পাশ থেকে প্রথম ভয়েস স্যাম্পল রেকর্ড করুন
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      রেকর্ড করে &ldquo;রেকর্ডিং এনালাইসিস ও সেভ করুন&rdquo; বাটনে চাপ দিলেই আপনার Voice DNA বিশ্লেষণ হয়ে যাবে এবং এখানে যেকোনো লেখা আপনার কণ্ঠের প্রোফাইলে বাজানো যাবে।
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
                          Voice DNA Analysis · {activeProfile.name}
                        </p>
                        <h3 className="text-lg font-serif font-medium text-slate-900 dark:text-white mt-0.5">
                          শনাক্তকৃত কণ্ঠস্বর বৈশিষ্ট্য
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDnaPrompt((prev) => !prev)}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline"
                      >
                        {showDnaPrompt ? 'AI প্রম্পট লুকান' : 'AI স্টাইল প্রম্পট দেখুন'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-950/70 border border-indigo-100 dark:border-slate-800">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">কণ্ঠের ধরন</p>
                        <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                          {activeProfile.gender}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-950/70 border border-indigo-100 dark:border-slate-800">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">পিচ রেজিস্টার</p>
                        <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                          {activeProfile.pitchLabel}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-950/70 border border-indigo-100 dark:border-slate-800">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">কথা বলার গতি</p>
                        <p className="font-semibold text-slate-900 dark:text-white mt-0.5 truncate">
                          {activeProfile.speakingRateLabel}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-950/70 border border-indigo-100 dark:border-slate-800">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">ম্যাচড বেস ভয়েস</p>
                        <p className="font-semibold text-indigo-700 dark:text-amber-300 mt-0.5">
                          {activeProfile.matchedBaseVoice}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1 leading-relaxed">
                      <p>
                        <strong className="text-slate-900 dark:text-white">টোন ও উষ্ণতা:</strong>{' '}
                        {activeProfile.toneDescription}
                      </p>
                      <p>
                        <strong className="text-slate-900 dark:text-white">উচ্চারণ ও ছন্দ:</strong>{' '}
                        {activeProfile.accentNotes}
                      </p>
                      {activeProfile.transcriptSample && (
                        <p className="text-slate-500 dark:text-slate-400">
                          <strong>রেকর্ডিং থেকে শোনা বাক্য:</strong> &ldquo;{activeProfile.transcriptSample}&rdquo;
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
                        <span>অ্যাকুস্টিক ক্যালিব্রেশন (Pitch · Pace · Warmth)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!allowFineTuning && onOpenUpgradePackage ? (
                          <button
                            type="button"
                            onClick={() => onOpenUpgradePackage('yearly')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold transition-colors"
                          >
                            <Lock size={10} />
                            <span>Yearly দিয়ে ফাইন-টিউন</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSaveCalibrationToProfile}
                            className="text-[11px] font-semibold text-indigo-700 dark:text-amber-300 hover:underline"
                          >
                            সেটিংস প্রোফাইলে সেভ করুন
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <label className="space-y-1">
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>পিচ ম্যাচ</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {pitchCentsOffset > 0 ? `+${pitchCentsOffset}` : pitchCentsOffset} cents
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
                          <span>গতি (Pace)</span>
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
                          <span>ভয়েস উষ্ণতা EQ</span>
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
                        ধাপ ৩ · যেকোনো লেখা লিখে এই ভয়েস প্রোফাইলে বলান
                      </span>
                      <span className="text-xs font-medium text-slate-400 tabular-nums">
                        {scriptText.length.toLocaleString('en-US')} / {studioCaps.maxScriptChars.toLocaleString('en-US')} chars
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
                          {preset.label}
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
                      placeholder="বাংলা, ইংরেজি বা যেকোনো ভাষায় আপনার লেখা লিখুন..."
                      className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 text-base sm:text-lg leading-relaxed text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                    />

                    <input
                      type="text"
                      value={extraStyleNote}
                      onChange={(e) => {
                        if (isSpeaking) stopPlayback();
                        setExtraStyleNote(e.target.value);
                      }}
                      placeholder="ঐচ্ছিক অতিরিক্ত মুড (যেমন: আনন্দিত ও প্রাণবন্তভাবে / ধীর ও শান্তভাবে)..."
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
                            &ldquo;{activeProfile.name}&rdquo; ভয়েসে অডিও তৈরি হচ্ছে...
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
                            ক্লিক করে &ldquo;{activeProfile.name}&rdquo; কণ্ঠে শুনুন
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
                            ? 'জেনারেট হচ্ছে...'
                            : isSpeaking
                            ? 'থামান'
                            : 'আমার ভয়েস প্রোফাইলে বলুন'}
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
                        <span>{isLooping ? 'লুপ চালু' : 'লুপ'}</span>
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
                        <span>{downloaded ? 'সেভ হয়েছে' : 'WAV ডাউনলোড'}</span>
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
          <span>© 2026 Srabon Go · Personal Voice Recording &amp; AI Speech Studio</span>
          {onOpenLegal && (
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => onOpenLegal('about')} className="hover:text-indigo-700 dark:hover:text-white">
                About
              </button>
              <button type="button" onClick={() => onOpenLegal('privacy')} className="hover:text-indigo-700 dark:hover:text-white">
                Privacy Policy
              </button>
              <button type="button" onClick={() => onOpenLegal('terms')} className="hover:text-indigo-700 dark:hover:text-white">
                Terms
              </button>
              <button type="button" onClick={() => onOpenLegal('contact')} className="hover:text-indigo-700 dark:hover:text-white">
                Contact
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default CustomVoiceCloneStudio;
