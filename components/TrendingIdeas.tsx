/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useState } from 'react';
import { GoogleGenAI, Type } from '../genaiProxy';
import {
  TrendingUp,
  Sparkles,
  Loader2,
  AudioLines,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Voice } from '../types';
import { checkBackendHealth } from '../utils/audio';
import { reportAppIssue } from '../utils/appIssues';
import type { LegalTab } from './SiteLegalModal';

export interface AudioIdeaItem {
  id: string;
  title: string;
  category: string;
  angle: string;
  script: string;
  suggestedVoice: string;
  deliveryStyle: string;
}

interface TrendingIdeasProps {
  voices: Voice[];
  onUseIdeaInStudio: (idea: { text: string; style: string; voiceName: string }) => void;
  onBeforeGenerate?: () => Promise<boolean>;
  onOpenLegal?: (tab: LegalTab) => void;
  isAdmin?: boolean;
}

const CATEGORIES = [
  { id: 'all', label: 'All Trending' },
  { id: 'reels', label: 'Reels & Shorts' },
  { id: 'morning', label: 'Morning & Study' },
  { id: 'tech', label: 'Tech & AI' },
  { id: 'story', label: 'Story & Podcast' },
  { id: 'motivation', label: 'Motivation' },
  { id: 'promo', label: 'Promo & Ad' },
] as const;

const LANGUAGES = [
  { id: 'bn', label: 'বাংলা (Bengali)' },
  { id: 'en', label: 'English' },
  { id: 'mix', label: 'Bengali + English Mix' },
] as const;

const STARTER_IDEAS: AudioIdeaItem[] = [
  {
    id: 'starter-1',
    title: 'ভোর ৫টার রুটিনে ৫ মিনিটের ফোকাস হ্যাক',
    category: 'Morning & Study',
    angle: 'High-retention YouTube Shorts / Reels hook for students',
    script:
      'সকালবেলা ঘুম থেকে উঠেই ফোন হাতে নিবেন না! প্রথম ১০ মিনিট শুধু পানি পান করুন আর আজকের সবচেয়ে জরুরি ৩টি কাজের তালিকা লিখুন। দেখবেন পুরো দিনের পড়া আর কাজের গতি দ্বিগুণ হয়ে গেছে।',
    suggestedVoice: 'Kore',
    deliveryStyle: 'Energetic, bright, motivating morning study host in clear Bengali',
  },
  {
    id: 'starter-2',
    title: '২০২৬-এ AI টুল দিয়ে সময় বাঁচানোর ৩টি উপায়',
    category: 'Tech & AI',
    angle: 'Fast-paced creator explainer with curious opening',
    script:
      'আপনি কি এখনও ঘণ্টার পর ঘণ্টা একই কাজ হাতে করছেন? আজকের স্মার্ট অটোমেশন আর ভয়েস এআই ব্যবহার করলে ২ ঘণ্টার স্ক্রিপ্ট ও অডিও কাজ মাত্র ৫ মিনিটে শেষ করা সম্ভব!',
    suggestedVoice: 'Puck',
    deliveryStyle: 'Upbeat, crisp, enthusiastic tech creator tone',
  },
  {
    id: 'starter-3',
    title: 'একটি হারানো চিঠির গল্প — রাতের পডকাস্ট',
    category: 'Story & Podcast',
    angle: 'Atmospheric late-night storytelling monologue',
    script:
      'বৃষ্টি থেমে যাওয়ার পর পুরনো বইয়ের তাক থেকে একটা হলুদ খাম মাটিতে পড়ল। খামের ওপর তারিখ লেখা ছিল বিশ বছর আগের—আর ভেতরে ছিল এমন এক সত্য, যা কেউ কোনোদিন জানতে চায়নি।',
    suggestedVoice: 'Charon',
    deliveryStyle: 'Deep, calm, suspenseful late-night documentary narrator',
  },
  {
    id: 'starter-4',
    title: 'পড়াশোনায় মনোযোগ ধরে রাখার পমোডোরো নিয়ম',
    category: 'Motivation',
    angle: 'Relatable discipline reminder for exam season',
    script:
      'একটানা তিন ঘণ্টা বইয়ের সামনে বসে থেকেও কিছু মনে থাকে না? ২৫ মিনিট পূর্ণ মনোযোগে পড়ুন আর ৫ মিনিট চোখ বন্ধ করে বিশ্রাম নিন। ছোট ছোট সেশনই বড় সাফল্য এনে দেয়।',
    suggestedVoice: 'Zephyr',
    deliveryStyle: 'Warm, clear, encouraging mentor voice',
  },
  {
    id: 'starter-5',
    title: 'অনলাইন শপ বা পেজের জন্য ১৫ সেকেন্ডের প্রোমো ভয়েস',
    category: 'Promo & Ad',
    angle: 'Crisp commercial voiceover for social video ads',
    script:
      'ঘরে বসেই সেরা মানের পণ্য অর্ডার করতে চান? আজই ভিজিট করুন আমাদের পেজে—সীমিত সময়ের জন্য পাচ্ছেন বিশেষ ছাড় আর দ্রুত হোম ডেলিভারি সুবিধা!',
    suggestedVoice: 'Fenrir',
    deliveryStyle: 'Confident, engaging, broadcast commercial announcer',
  },
];

const TrendingIdeas: React.FC<TrendingIdeasProps> = ({
  voices,
  onUseIdeaInStudio,
  onBeforeGenerate,
  onOpenLegal,
  isAdmin = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<'bn' | 'en' | 'mix'>('bn');
  const [nicheInput, setNicheInput] = useState('');
  const [ideas, setIdeas] = useState<AudioIdeaItem[]>(STARTER_IDEAS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasGeneratedLive, setHasGeneratedLive] = useState(false);

  const handleCopyScript = (idea: AudioIdeaItem) => {
    navigator.clipboard.writeText(idea.script);
    setCopiedId(idea.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const handleGenerateTrendingIdeas = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const hasBackend = await checkBackendHealth();
      if (!hasBackend) {
        const msg =
          'লাইভ AI ট্রেন্ডিং আইডিয়া তৈরির জন্য ব্যাকএন্ড সার্ভার প্রয়োজন (Static Host)।';
        reportAppIssue({ source: 'TrendingIdeas', severity: 'warning', message: msg });
        if (isAdmin) setError(msg);
        return;
      }

      if (onBeforeGenerate) {
        const allowed = await onBeforeGenerate();
        if (!allowed) return;
      }

      const ai = new GoogleGenAI({ apiKey: 'server-side' });
      const categoryLabel =
        CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'All Trending';
      const languageInstruction =
        selectedLanguage === 'bn'
          ? 'Write all titles and speakable scripts in natural, modern Bengali (বাংলা).'
          : selectedLanguage === 'en'
          ? 'Write all titles and speakable scripts in crisp, natural English.'
          : 'Write titles and speakable scripts in natural Bengali with modern English creator keywords where helpful.';

      const voiceNames = voices.map((v) => v.name).join(', ');
      const prompt = `
        You are an expert audio content strategist and viral scriptwriter for YouTube Shorts, Facebook Reels, podcasts, educational study alarms, and voiceovers.

        Generate 5 fresh, high-engagement, trending audio topic ideas.
        Category focus: ${categoryLabel}
        ${nicheInput.trim() ? `User custom topic / audience focus: "${nicheInput.trim()}"` : ''}
        Language rule: ${languageInstruction}

        Available Voice Talents (pick one exact name from this list for each idea):
        ${voiceNames}

        Requirements for each of the 5 ideas:
        - title: Short catchy topic title
        - category: Short category label (e.g. "Reels & Shorts", "Tech & AI", "Story & Podcast", "Morning & Study", "Motivation", "Promo & Ad")
        - angle: Brief 1-line explanation of why this topic is trending / hooks listeners
        - script: A ready-to-speak 2 to 4 sentence voiceover script (clean spoken prose, no stage brackets or markdown)
        - suggestedVoice: Exact voice name from the Available Voice Talents list
        - deliveryStyle: Short English vocal direction for TTS tone (e.g. "Energetic, fast-paced creator hook")
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ideas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    angle: { type: Type.STRING },
                    script: { type: Type.STRING },
                    suggestedVoice: { type: Type.STRING },
                    deliveryStyle: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const rawText = (response.text || '{}')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(rawText);
      const validVoiceSet = new Set(voices.map((v) => v.name));
      const fallbackVoice = voices[0]?.name || 'Kore';

      const nextIdeas: AudioIdeaItem[] = Array.isArray(parsed?.ideas)
        ? parsed.ideas
            .filter(
              (item: any) =>
                item &&
                typeof item.title === 'string' &&
                typeof item.script === 'string' &&
                item.script.trim().length > 0
            )
            .slice(0, 6)
            .map((item: any, idx: number) => ({
              id: `ai-${Date.now()}-${idx}`,
              title: item.title.trim(),
              category:
                typeof item.category === 'string' && item.category.trim()
                  ? item.category.trim()
                  : categoryLabel,
              angle:
                typeof item.angle === 'string' && item.angle.trim()
                  ? item.angle.trim()
                  : 'Trending audio hook',
              script: item.script.trim(),
              suggestedVoice:
                typeof item.suggestedVoice === 'string' &&
                validVoiceSet.has(item.suggestedVoice.trim())
                  ? item.suggestedVoice.trim()
                  : fallbackVoice,
              deliveryStyle:
                typeof item.deliveryStyle === 'string' && item.deliveryStyle.trim()
                  ? item.deliveryStyle.trim()
                  : 'Natural, clear, engaging studio voice',
            }))
        : [];

      if (nextIdeas.length === 0) {
        const msg = 'AI থেকে নতুন আইডিয়া পাওয়া যায়নি।';
        reportAppIssue({ source: 'TrendingIdeas', severity: 'error', message: msg });
        if (isAdmin) setError(msg);
        return;
      }

      setIdeas(nextIdeas);
      setHasGeneratedLive(true);
    } catch (err: any) {
      const msg = err?.message || 'ট্রেন্ডিং আইডিয়া তৈরি করতে সমস্যা হয়েছে।';
      reportAppIssue({ source: 'TrendingIdeas', severity: 'error', message: msg });
      if (isAdmin) setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        {/* Main Generator Card */}
        <section className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-6 sm:px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <TrendingUp size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">
                  AI Trending Audio Ideas
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-zinc-900 dark:text-white">
                কী বিষয় নিয়ে অডিও বানাবেন? AI থেকে ট্রেন্ডিং আইডিয়া নিন
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                ক্যাটাগরি বা নিজের বিষয় লিখুন—AI আপনাকে রেডি স্ক্রিপ্ট, সেরা ভয়েস এবং টোন সাজেস্ট করবে।
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerateTrendingIdeas} className="p-6 sm:p-8 space-y-5">
            {/* Category Tabs */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block">
                ক্যাটাগরি বেছে নিন
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-zinc-900 dark:bg-indigo-600 text-white border-zinc-900 dark:border-indigo-500'
                          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topic input + Language + Generate CTA */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-6 space-y-1.5">
                <label
                  htmlFor="trending-niche-input"
                  className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                >
                  নিজের কোনো বিষয় থাকলে লিখুন (ঐচ্ছিক)
                </label>
                <input
                  id="trending-niche-input"
                  type="text"
                  value={nicheInput}
                  onChange={(e) => setNicheInput(e.target.value)}
                  maxLength={140}
                  placeholder="যেমন: ফ্রিল্যান্সিং টিপস, এইচএসসি প্রস্তুতি, রান্নার শর্টস..."
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label
                  htmlFor="trending-lang-select"
                  className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                >
                  স্ক্রিপ্টের ভাষা
                </label>
                <select
                  id="trending-lang-select"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value as 'bn' | 'en' | 'mix')}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : hasGeneratedLive ? (
                    <RefreshCw size={15} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  <span>{loading ? 'তৈরি হচ্ছে...' : 'AI ট্রেন্ডিং আইডিয়া দিন'}</span>
                </button>
              </div>
            </div>

            {isAdmin && error && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </form>
        </section>

        {/* Ideas Results Header */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {hasGeneratedLive ? 'AI দ্বারা তৈরি নতুন ট্রেন্ডিং আইডিয়া' : 'জনপ্রিয় স্টার্টার ট্রেন্ডিং আইডিয়া'}
            <span aria-hidden="true" className="mx-2">·</span>
            <span className="tabular-nums">{ideas.length}টি স্ক্রিপ্ট</span>
          </p>
        </div>

        {/* Ideas List */}
        <div className="grid grid-cols-1 gap-4">
          {ideas.map((idea, index) => (
            <article
              key={idea.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                      0{index + 1}.
                    </span>
                    <span>{idea.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Voice: {idea.suggestedVoice}</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-serif font-medium text-zinc-900 dark:text-white">
                    {idea.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{idea.angle}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyScript(idea)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                    title="Copy script"
                  >
                    {copiedId === idea.id ? (
                      <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                    <span>{copiedId === idea.id ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUseIdeaInStudio({
                        text: idea.script,
                        style: idea.deliveryStyle,
                        voiceName: idea.suggestedVoice,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <AudioLines size={14} />
                    <span>স্টুডিওতে অডিও বানান</span>
                  </button>
                </div>
              </div>

              <p className="text-sm sm:text-base leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                "{idea.script}"
              </p>

              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Suggested Tone: {idea.deliveryStyle}
              </p>
            </article>
          ))}
        </div>

        <footer className="mt-8 pt-6 border-t border-zinc-200/70 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400 dark:text-zinc-500">
          <span>© 2026 Srabon Go — All Rights Reserved</span>
          {onOpenLegal && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onOpenLegal('about')}
                className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                About
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                Terms
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('contact')}
                className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                Contact
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default TrendingIdeas;
