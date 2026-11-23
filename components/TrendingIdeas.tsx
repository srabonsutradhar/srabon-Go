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
import { useLanguage, copyTextSafely } from '../utils/i18n';

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
  { id: 'all', labelBn: 'সব ট্রেন্ডিং', labelEn: 'All Trending' },
  { id: 'reels', labelBn: 'রিলস ও শর্টস', labelEn: 'Reels & Shorts' },
  { id: 'morning', labelBn: 'সকাল ও পড়াশোনা', labelEn: 'Morning & Study' },
  { id: 'tech', labelBn: 'টেক ও এআই', labelEn: 'Tech & AI' },
  { id: 'story', labelBn: 'গল্প ও পডকাস্ট', labelEn: 'Story & Podcast' },
  { id: 'motivation', labelBn: 'মোটিভেশন', labelEn: 'Motivation' },
  { id: 'promo', labelBn: 'প্রোমো ও বিজ্ঞাপন', labelEn: 'Promo & Ad' },
] as const;

const LANGUAGES = [
  { id: 'bn', labelBn: 'বাংলা (Bengali)', labelEn: 'Bengali (বাংলা)' },
  { id: 'en', labelBn: 'ইংরেজি (English)', labelEn: 'English' },
  { id: 'mix', labelBn: 'বাংলা + ইংরেজি মিক্স', labelEn: 'Bengali + English Mix' },
] as const;

interface StarterIdeaItem extends AudioIdeaItem {
  titleEn?: string;
  categoryBn?: string;
  angleBn?: string;
  scriptEn?: string;
}

const STARTER_IDEAS: StarterIdeaItem[] = [
  {
    id: 'starter-1',
    title: 'ভোর ৫টার রুটিনে ৫ মিনিটের ফোকাস হ্যাক',
    titleEn: '5-Minute Focus Hack for a 5 AM Study Routine',
    category: 'Morning & Study',
    categoryBn: 'সকাল ও পড়াশোনা',
    angle: 'High-retention YouTube Shorts / Reels hook for students',
    angleBn: 'শিক্ষার্থীদের জন্য আকর্ষণীয় ইউটিউব শর্টস ও রিলস হুক',
    script:
      'সকালবেলা ঘুম থেকে উঠেই ফোন হাতে নিবেন না! প্রথম ১০ মিনিট শুধু পানি পান করুন আর আজকের সবচেয়ে জরুরি ৩টি কাজের তালিকা লিখুন। দেখবেন পুরো দিনের পড়া আর কাজের গতি দ্বিগুণ হয়ে গেছে।',
    scriptEn:
      'Never grab your phone right after waking up! Spend the first ten minutes drinking water and writing down your top three priorities—and watch your focus double all day.',
    suggestedVoice: 'Kore',
    deliveryStyle: 'Energetic, bright, motivating morning study host in clear Bengali',
  },
  {
    id: 'starter-2',
    title: '২০২৬-এ AI টুল দিয়ে সময় বাঁচানোর ৩টি উপায়',
    titleEn: '3 Ways to Save Hours with AI Voice Tools in 2026',
    category: 'Tech & AI',
    categoryBn: 'টেক ও এআই',
    angle: 'Fast-paced creator explainer with curious opening',
    angleBn: 'কৌতূহল জাগানো দ্রুতগতির ক্রিয়েটর এক্সপ্লেইনার',
    script:
      'আপনি কি এখনও ঘণ্টার পর ঘণ্টা একই কাজ হাতে করছেন? আজকের স্মার্ট অটোমেশন আর ভয়েস এআই ব্যবহার করলে ২ ঘণ্টার স্ক্রিপ্ট ও অডিও কাজ মাত্র ৫ মিনিটে শেষ করা সম্ভব!',
    scriptEn:
      'Are you still spending hours recording repetitive tasks by hand? With modern voice AI workflows, two hours of scripting and production drops down to five minutes!',
    suggestedVoice: 'Puck',
    deliveryStyle: 'Upbeat, crisp, enthusiastic tech creator tone',
  },
  {
    id: 'starter-3',
    title: 'একটি হারানো চিঠির গল্প — রাতের পডকাস্ট',
    titleEn: 'The Lost Letter — Midnight Podcast Monologue',
    category: 'Story & Podcast',
    categoryBn: 'গল্প ও পডকাস্ট',
    angle: 'Atmospheric late-night storytelling monologue',
    angleBn: 'গভীর রাতের আবহময় গল্প বলার ভঙ্গি',
    script:
      'বৃষ্টি থেমে যাওয়ার পর পুরনো বইয়ের তাক থেকে একটা হলুদ খাম মাটিতে পড়ল। খামের ওপর তারিখ লেখা ছিল বিশ বছর আগের—আর ভেতরে ছিল এমন এক সত্য, যা কেউ কোনোদিন জানতে চায়নি।',
    scriptEn:
      'Right after the rain stopped, a yellowed envelope slipped off the top bookshelf. The stamp was dated twenty years ago—and inside waited a truth nobody ever wanted uncovered.',
    suggestedVoice: 'Charon',
    deliveryStyle: 'Deep, calm, suspenseful late-night documentary narrator',
  },
  {
    id: 'starter-4',
    title: 'পড়াশোনায় মনোযোগ ধরে রাখার পমোডোরো নিয়ম',
    titleEn: 'Stay Locked In Using the 25-Minute Pomodoro Rule',
    category: 'Motivation',
    categoryBn: 'মোটিভেশন',
    angle: 'Relatable discipline reminder for exam season',
    angleBn: 'পরীক্ষার সময়ে মনোযোগ ধরে রাখার কার্যকর রিমাইন্ডার',
    script:
      'একটানা তিন ঘণ্টা বইয়ের সামনে বসে থেকেও কিছু মনে থাকে না? ২৫ মিনিট পূর্ণ মনোযোগে পড়ুন আর ৫ মিনিট চোখ বন্ধ করে বিশ্রাম নিন। ছোট ছোট সেশনই বড় সাফল্য এনে দেয়।',
    scriptEn:
      'Staring at a textbook for three straight hours without remembering a line? Study deeply for twenty-five minutes, rest for five, and let small focused sprints build big results.',
    suggestedVoice: 'Zephyr',
    deliveryStyle: 'Warm, clear, encouraging mentor voice',
  },
  {
    id: 'starter-5',
    title: 'অনলাইন শপ বা পেজের জন্য ১৫ সেকেন্ডের প্রোমো ভয়েস',
    titleEn: '15-Second Promo Spot for Online Stores',
    category: 'Promo & Ad',
    categoryBn: 'প্রোমো ও বিজ্ঞাপন',
    angle: 'Crisp commercial voiceover for social video ads',
    angleBn: 'সোশ্যাল ভিডিও বিজ্ঞাপনের জন্য স্পষ্ট কমার্শিয়াল ভয়েসওভার',
    script:
      'ঘরে বসেই সেরা মানের পণ্য অর্ডার করতে চান? আজই ভিজিট করুন আমাদের পেজে—সীমিত সময়ের জন্য পাচ্ছেন বিশেষ ছাড় আর দ্রুত হোম ডেলিভারি সুবিধা!',
    scriptEn:
      'Want curated products delivered straight to your door? Visit our store today for limited-time seasonal savings and express nationwide delivery!',
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
  const [ideas, setIdeas] = useState<StarterIdeaItem[]>(STARTER_IDEAS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userNotice, setUserNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasGeneratedLive, setHasGeneratedLive] = useState(false);
  const { lang, bi } = useLanguage();

  const handleCopyScript = async (idea: StarterIdeaItem) => {
    const scriptText = lang === 'en' && idea.scriptEn ? idea.scriptEn : idea.script;
    const ok = await copyTextSafely(scriptText);
    if (ok) {
      setCopiedId(idea.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleGenerateTrendingIdeas = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setUserNotice(null);

    try {
      const hasBackend = await checkBackendHealth();
      if (!hasBackend) {
        const msg =
          'লাইভ AI ট্রেন্ডিং আইডিয়া তৈরির জন্য ব্যাকএন্ড সার্ভার প্রয়োজন (Static Host)।';
        reportAppIssue({ source: 'TrendingIdeas', severity: 'warning', message: msg });
        if (isAdmin) {
          setError(msg);
        } else {
          setUserNotice(
            bi(
              'এই মুহূর্তে লাইভ AI সার্ভার সংযুক্ত নেই। নিচের স্টার্টার স্ক্রিপ্টগুলো ব্যবহার করতে পারেন।',
              'Live AI idea generator is currently offline. You can use the starter scripts below.'
            )
          );
        }
        return;
      }

      if (onBeforeGenerate) {
        const allowed = await onBeforeGenerate();
        if (!allowed) return;
      }

      const ai = new GoogleGenAI({ apiKey: 'server-side' });
      const categoryLabel =
        CATEGORIES.find((c) => c.id === selectedCategory)?.labelEn || 'All Trending';
      const languageInstruction =
        selectedLanguage === 'bn'
          ? 'Write all titles and speakable scripts in natural, modern Bengali (বাংলা).'
          : selectedLanguage === 'en'
          ? 'Write all titles and speakable scripts in crisp, natural English.'
          : 'Write titles and speakable scripts in natural Bengali with modern English creator keywords where helpful.';

      const previousTitles = ideas
        .map((item) => item.title)
        .filter(Boolean)
        .slice(0, 8)
        .join(' | ');
      const freshSeed = `${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`;

      const voiceNames = voices.map((v) => v.name).join(', ');
      const prompt = `
        You are an expert audio content strategist and viral scriptwriter for YouTube Shorts, Facebook Reels, podcasts, educational study alarms, and voiceovers.

        Generate 5 brand-new, high-engagement, trending audio topic ideas (Session seed: ${freshSeed}).
        Category focus: ${categoryLabel}
        ${nicheInput.trim() ? `User custom topic / audience focus: "${nicheInput.trim()}"` : ''}
        ${previousTitles ? `Do NOT repeat or closely copy these previous topics: ${previousTitles}` : ''}
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
            required: ['ideas'],
            properties: {
              ideas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: [
                    'title',
                    'category',
                    'angle',
                    'script',
                    'suggestedVoice',
                    'deliveryStyle',
                  ],
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

      const rawText = (
        response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        response?.text ||
        '{}'
      )
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      let parsed: any = {};
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('AI response could not be parsed as JSON.');
        }
        parsed = JSON.parse(jsonMatch[0]);
      }

      const validVoiceSet = new Set(voices.map((v) => v.name));
      const fallbackVoice = voices[0]?.name || 'Kore';

      const nextIdeas: AudioIdeaItem[] = Array.isArray(parsed?.ideas)
        ? parsed.ideas
            .filter(
              (item: any) =>
                item &&
                typeof item.title === 'string' &&
                item.title.trim().length > 0 &&
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
        if (isAdmin) {
          setError(msg);
        } else {
          setUserNotice(
            bi(
              'নতুন আইডিয়া তৈরি করা যায়নি। বিষয়টি পরিবর্তন করে আবার চেষ্টা করুন।',
              'No fresh ideas returned. Try another topic and retry.'
            )
          );
        }
        return;
      }

      setIdeas(nextIdeas);
      setHasGeneratedLive(true);
    } catch (err: any) {
      const msg = err?.message || 'ট্রেন্ডিং আইডিয়া তৈরি করতে সমস্যা হয়েছে।';
      reportAppIssue({ source: 'TrendingIdeas', severity: 'error', message: msg });
      if (isAdmin) {
        setError(msg);
      } else {
        setUserNotice(
          bi(
            'ট্রেন্ডিং আইডিয়া তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।',
            'Could not generate trending ideas right now. Please try again.'
          )
        );
      }
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
                  {bi('এআই ট্রেন্ডিং অডিও আইডিয়া', 'AI Trending Audio Ideas')}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-zinc-900 dark:text-white">
                {bi(
                  'কী বিষয় নিয়ে অডিও বানাবেন? AI থেকে ট্রেন্ডিং আইডিয়া নিন',
                  'What Will You Record Next? Generate Trending Audio Ideas'
                )}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {bi(
                  'ক্যাটাগরি বা নিজের বিষয় লিখুন—AI আপনাকে রেডি স্ক্রিপ্ট, সেরা ভয়েস এবং টোন সাজেস্ট করবে।',
                  'Pick a category or enter your niche—AI will prepare ready scripts, voice matches, and delivery notes.'
                )}
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerateTrendingIdeas} className="p-6 sm:p-8 space-y-5">
            {/* Category Tabs */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block">
                {bi('ক্যাটাগরি বেছে নিন', 'Choose Category')}
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
                      {bi(cat.labelBn, cat.labelEn)}
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
                  {bi('নিজের কোনো বিষয় থাকলে লিখুন (ঐচ্ছিক)', 'Custom Topic or Audience (Optional)')}
                </label>
                <input
                  id="trending-niche-input"
                  type="text"
                  value={nicheInput}
                  onChange={(e) => setNicheInput(e.target.value)}
                  maxLength={140}
                  placeholder={bi(
                    'যেমন: ফ্রিল্যান্সিং টিপস, এইচএসসি প্রস্তুতি, রান্নার শর্টস...',
                    'e.g. Freelancing tips, exam study motivation, tech explainers...'
                  )}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label
                  htmlFor="trending-lang-select"
                  className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                >
                  {bi('স্ক্রিপ্টের ভাষা', 'Script Language')}
                </label>
                <select
                  id="trending-lang-select"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value as 'bn' | 'en' | 'mix')}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {bi(l.labelBn, l.labelEn)}
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
                  <span>
                    {loading
                      ? bi('তৈরি হচ্ছে...', 'Generating...')
                      : bi('AI ট্রেন্ডিং আইডিয়া দিন', 'Generate Ideas')}
                  </span>
                </button>
              </div>
            </div>

            {((isAdmin && error) || userNotice) && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{isAdmin && error ? error : userNotice}</span>
              </div>
            )}
          </form>
        </section>

        {/* Ideas Results Header */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {hasGeneratedLive
              ? bi('AI দ্বারা তৈরি নতুন ট্রেন্ডিং আইডিয়া', 'Fresh AI-Generated Trending Ideas')
              : bi('জনপ্রিয় স্টার্টার ট্রেন্ডিং আইডিয়া', 'Popular Starter Trending Ideas')}
            <span aria-hidden="true" className="mx-2">·</span>
            <span className="tabular-nums">
              {bi(`${ideas.length}টি স্ক্রিপ্ট`, `${ideas.length} scripts`)}
            </span>
          </p>
        </div>

        {/* Ideas List */}
        <div className="grid grid-cols-1 gap-4">
          {ideas.map((idea, index) => {
            const displayTitle = lang === 'en' && idea.titleEn ? idea.titleEn : idea.title;
            const displayCategory = lang === 'bn' && idea.categoryBn ? idea.categoryBn : idea.category;
            const displayAngle = lang === 'bn' && idea.angleBn ? idea.angleBn : idea.angle;
            const displayScript =
              !hasGeneratedLive && lang === 'en' && idea.scriptEn ? idea.scriptEn : idea.script;

            return (
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
                    <span>{displayCategory}</span>
                    <span aria-hidden="true">·</span>
                    <span>{bi(`ভয়েস: ${idea.suggestedVoice}`, `Voice: ${idea.suggestedVoice}`)}</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-serif font-medium text-zinc-900 dark:text-white">
                    {displayTitle}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{displayAngle}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyScript(idea)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                    title={bi('স্ক্রিপ্ট কপি করুন', 'Copy script')}
                  >
                    {copiedId === idea.id ? (
                      <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                    <span>{copiedId === idea.id ? bi('কপি হয়েছে', 'Copied') : bi('কপি', 'Copy')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUseIdeaInStudio({
                        text: displayScript,
                        style: idea.deliveryStyle,
                        voiceName: idea.suggestedVoice,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <AudioLines size={14} />
                    <span>{bi('স্টুডিওতে অডিও বানান', 'Open in Studio')}</span>
                  </button>
                </div>
              </div>

              <p className="text-sm sm:text-base leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                "{displayScript}"
              </p>

              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {bi(`প্রস্তাবিত টোন: ${idea.deliveryStyle}`, `Suggested Tone: ${idea.deliveryStyle}`)}
              </p>
            </article>
            );
          })}
        </div>

        <footer className="mt-8 pt-6 border-t border-zinc-200/70 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400 dark:text-zinc-500">
          <span>{bi('© ২০২৬ শ্রাবণ গো — সর্বস্বত্ব সংরক্ষিত', '© 2026 Srabon Go — All Rights Reserved')}</span>
          {onOpenLegal && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onOpenLegal('about')}
                className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                {bi('আমাদের সম্পর্কে', 'About')}
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                {bi('গোপনীয়তা নীতি', 'Privacy Policy')}
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                {bi('শর্তাবলী', 'Terms')}
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('contact')}
                className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                {bi('যোগাযোগ', 'Contact')}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default TrendingIdeas;
