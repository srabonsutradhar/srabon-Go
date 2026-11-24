/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, FileText, Info, Mail, Copy, Check } from 'lucide-react';
import { copyTextSafely, useLanguage } from '../utils/i18n';

export type LegalTab = 'about' | 'privacy' | 'terms' | 'contact';

interface SiteLegalModalProps {
  initialTab?: LegalTab;
  onClose: () => void;
}

const SUPPORT_EMAIL = 'srabon10010@gmail.com';

const SiteLegalModal: React.FC<SiteLegalModalProps> = ({
  initialTab = 'about',
  onClose,
}) => {
  const { bi } = useLanguage();
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopyEmail = async () => {
    const ok = await copyTextSafely(SUPPORT_EMAIL);
    if (ok) {
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-legal-title"
    >
      <div
        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-slide-up text-left">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="site-legal-title"
              className="text-xl font-serif font-medium text-zinc-900 dark:text-white"
            >
              {bi('শ্রাবণ গো — তথ্য ও নীতিমালা', 'Srabon Go — Information & Legal')}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {bi(
                'আমাদের সম্পর্কে, গোপনীয়তা নীতি, ব্যবহারের শর্তাবলি ও সাপোর্ট যোগাযোগ',
                'About, Privacy Policy, Terms of Service, and Contact Support'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            aria-label={bi('বন্ধ করুন', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'about'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Info size={13} />
            <span>{bi('পরিচিতি', 'About')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'privacy'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck size={13} />
            <span>{bi('গোপনীয়তা নীতি', 'Privacy Policy')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'terms'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <FileText size={13} />
            <span>{bi('শর্তাবলি', 'Terms of Service')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'contact'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Mail size={13} />
            <span>{bi('যোগাযোগ', 'Contact')}</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          {activeTab === 'about' && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {bi('শ্রাবণ গো ভয়েস লাইব্রেরি সম্পর্কে', 'About Srabon Go Voice Library')}
              </h3>
              <p>
                {bi(
                  'শ্রাবণ গো হলো নির্মাতা, শিক্ষার্থী, শিক্ষক ও গল্পকারদের জন্য নির্মিত একটি বহুভাষিক এআই ভয়েস স্টুডিও এবং ভয়েস কাস্টিং প্ল্যাটফর্ম। এখানে ৩০টি আলাদা কণ্ঠস্বর প্রিভিউ করা, বাংলা ও ইংরেজিসহ বিশ্বব্যাপী বিভিন্ন ভাষায় অডিও তৈরি এবং পরিষ্কার ২৪ kHz WAV ফাইল ডাউনলোড করা যায়।',
                  'Srabon Go is a multilingual AI Voice Studio and Voice Casting platform built for creators, students, educators, and storytellers. Preview 30 distinct vocal personalities, generate spoken audio in Bengali, English, and global languages, and export crisp 24 kHz WAV recordings.'
                )}
              </p>
              <p>
                {bi(
                  'প্রধান সুবিধার মধ্যে রয়েছে অ্যালার্ম লুপসহ টেক্সট-টু-স্পিচ স্টুডিও, এআই কাস্টিং ডিরেক্টর, ব্যক্তিগত ভয়েস রেকর্ডিং ও ক্যালিব্রেশন, পাশাপাশি গুগল সিনক্রোনাইজড ফেভারিটস ও রেফারেল পুরস্কার (+১০ বোনাস ক্রেডিট)।',
                  'Key capabilities include an expressive Text-to-Speech Studio with Alarm Loop playback, an AI Casting Director that recommends voices and director prompts for your script, personal voice recording & calibration, synchronized Google Favorites, and a referral rewards program (+10 bonus credits per friend).'
                )}
              </p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-3 text-xs sm:text-sm">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {bi('গোপনীয়তা নীতি (Privacy Policy)', 'Privacy Policy')}
              </h3>
              <p>
                <strong>{bi('১. অ্যাকাউন্ট তথ্য:', '1. Account Information:')}</strong>{' '}
                {bi(
                  'গুগল দিয়ে সাইন-ইন করলে আমরা আপনার প্রোফাইলের মৌলিক তথ্য (নাম, ইমেইল ও ছবি), সংরক্ষিত পছন্দের ভয়েস, দৈনিক ব্যবহারের হিসাব, রেফারেল কোড এবং বোনাস ক্রেডিট ফায়ারবেস ফায়ারস্টোরে সংরক্ষণ করি।',
                  'When you sign in with Google, we store your basic profile fields (name, email address, and profile photo URL) along with your saved voice favorites, daily quota counter, referral code, and bonus credit balance in Firebase Firestore.'
                )}
              </p>
              <p>
                <strong>{bi('২. স্ক্রিপ্ট ও অডিও জেনারেশন:', '2. Scripts & Audio Synthesis:')}</strong>{' '}
                {bi(
                  'ভয়েস স্টুডিও বা এআই কাস্টিং ডিরেক্টরে লেখা টেক্সট নিরাপদভাবে আমাদের সার্ভার-সাইড এন্ডপয়েন্টে অডিও ও ভয়েস পরামর্শ তৈরির জন্য পাঠানো হয় এবং সার্ভারে সংরক্ষিত থাকে না।',
                  'Text scripts entered into Voice Studio or AI Casting Director are sent securely to our server-side synthesis endpoint to generate audio or voice recommendations and are not archived to your profile.'
                )}
              </p>
              <p>
                <strong>{bi('৩. নিরাপত্তা ও অ্যাক্সেস নিয়ন্ত্রণ:', '3. Access Control & Security:')}</strong>{' '}
                {bi(
                  'আপনার প্রোফাইল ডেটা শুধুমাত্র অ্যাকাউন্ট-মালিকানাধীন ফায়ারস্টোর নিয়ম দ্বারা সুরক্ষিত। আমরা কখনোই ব্যবহারকারীর তথ্য তৃতীয় পক্ষের কাছে বিক্রি বা ভাড়া দিই না।',
                  'Your profile data is protected by owner-only Firestore security rules. We never sell or rent user email addresses or personal information to third parties.'
                )}
              </p>
              <p>
                <strong>{bi('৪. কুকি ও বিজ্ঞাপন:', '4. Cookies & Advertising:')}</strong>{' '}
                {bi(
                  'ব্রাউজার স্টোরেজে আপনার থিম (লাইট/ডার্ক), ভাষা পছন্দ, রেফারেল কোড ও সেশন তথ্য সংরক্ষিত থাকে। Google AdSense বা Ads চালু থাকলে গুগলের নীতিমালা অনুযায়ী কুকি ব্যবহৃত হতে পারে।',
                  'Essential browser storage preserves your dark/light theme preference, language choice, referral code attribution, and active session. When Google AdSense or Google Ads tags are configured, Google may use cookies in accordance with its advertising policies.'
                )}
              </p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-3 text-xs sm:text-sm">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {bi('ব্যবহারের শর্তাবলি (Terms of Service)', 'Terms of Service')}
              </h3>
              <p>
                <strong>{bi('১. বৈধ ব্যবহার:', '1. Acceptable Use:')}</strong>{' '}
                {bi(
                  'আপনি দায়িত্বশীলভাবে শ্রাবণ গো ব্যবহার করবেন এবং অনুমতি ছাড়া কোনো বেআইনি, ক্ষতিকর, প্রতারণামূলক বা অন্যের কণ্ঠস্বর নকল করার কাজে অডিও তৈরি করবেন না।',
                  'You agree to use Srabon Go responsibly and not generate unlawful, abusive, deceptive, or impersonating audio content without authorization.'
                )}
              </p>
              <p>
                <strong>{bi('২. ফ্রি কোটা, রেফারেল ও প্রো অ্যাক্সেস:', '2. Free Quotas, Referrals & Pro Access:')}</strong>{' '}
                {bi(
                  'ফ্রি অ্যাকাউন্টে দৈনিক নির্দিষ্ট জেনারেশন লিমিট ও বৈধ রেফারেলের মাধ্যমে (+১০ ক্রেডিট) বোনাস পাওয়া যায়। ভুয়া রেফারেল বা অটোমেটেড অপব্যবহার নিষিদ্ধ।',
                  'Free accounts receive a daily generation allowance plus bonus credits earned via verified friend referrals (+10 credits per eligible sign-in). Self-referrals and automated abuse are prohibited.'
                )}
              </p>
              <p>
                <strong>{bi('৩. মেধাস্বত্ব:', '3. Intellectual Property:')}</strong>{' '}
                {bi(
                  '© ২০২৬ শ্রাবণ গো — সর্বস্বত্ব সংরক্ষিত। অনুমতি ব্যতীত ব্র্যান্ডিং, কনফিগারেশন বা সোর্স কোড কপি বা পুনঃবিতরণ সম্পূর্ণ নিষিদ্ধ।',
                  '© 2026 Srabon Go — All Rights Reserved. Unauthorized copying, cloning, redistribution, or claiming ownership of Srabon Go branding, configuration, or source code is strictly prohibited.'
                )}
              </p>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {bi('যোগাযোগ ও সহায়তা', 'Contact & Support')}
              </h3>
              <p className="text-sm">
                {bi(
                  'প্রো প্যাক সক্রিয় করা, রেফারেল ক্রেডিট বা যেকোনো কারিগরি সহায়তার জন্য সরাসরি শ্রাবণ গো টিমের সাথে যোগাযোগ করুন:',
                  'Need help with Pro activation, referral credits, or technical feedback? Reach out directly to the Srabon Go team:'
                )}
              </p>
              <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700">
                <div>
                  <span className="text-xs uppercase tracking-wider text-zinc-400 block">
                    {bi('সাপোর্ট ইমেইল', 'Support Email')}
                  </span>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {copiedEmail ? (
                    <Check size={13} className="text-emerald-500" />
                  ) : (
                    <Copy size={13} />
                  )}
                  <span>
                    {copiedEmail ? bi('কপি হয়েছে', 'Copied') : bi('ইমেইল কপি করুন', 'Copy Email')}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/70 dark:bg-zinc-900/70">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {bi('© ২০২৬ শ্রাবণ গো — সর্বস্বত্ব সংরক্ষিত', '© 2026 Srabon Go — All Rights Reserved')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-zinc-900 dark:bg-indigo-600 text-white text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors"
          >
            {bi('বন্ধ করুন', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SiteLegalModal;
