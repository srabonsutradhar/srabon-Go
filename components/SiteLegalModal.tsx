/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, FileText, Info, Mail, Copy, Check } from 'lucide-react';

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

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopiedEmail(true);
    window.setTimeout(() => setCopiedEmail(false), 2000);
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
              Srabon Go — Information &amp; Legal
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              About, Privacy Policy, Terms of Service, and Contact Support
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            aria-label="Close"
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
            <span>About</span>
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
            <span>Privacy Policy</span>
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
            <span>Terms of Service</span>
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
            <span>Contact</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          {activeTab === 'about' && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                About Srabon Go Voice Library
              </h3>
              <p>
                <strong>Srabon Go</strong> is a multilingual AI Voice Studio and Voice Casting platform built for creators, students, educators, and storytellers. Preview 30 distinct vocal personalities, generate spoken audio in Bengali, English, and global languages, and export crisp 24 kHz WAV recordings.
              </p>
              <p>
                Key capabilities include an expressive Text-to-Speech Studio with Alarm Loop playback, an AI Casting Director that recommends voices and director prompts for your script, synchronized Google Favorites, and a referral rewards program (+10 bonus credits per friend).
              </p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-3 text-xs sm:text-sm">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                Privacy Policy
              </h3>
              <p>
                <strong>1. Account Information:</strong> When you sign in with Google, we store your basic profile fields (name, email address, and profile photo URL) along with your saved voice favorites, daily quota counter, referral code, and bonus credit balance in Firebase Firestore.
              </p>
              <p>
                <strong>2. Scripts &amp; Audio Synthesis:</strong> Text scripts entered into Voice Studio or AI Casting Director are sent securely to our server-side synthesis endpoint to generate audio or voice recommendations and are not archived to your profile.
              </p>
              <p>
                <strong>3. Access Control &amp; Security:</strong> Your profile data is protected by owner-only Firestore security rules. We never sell or rent user email addresses or personal information to third parties.
              </p>
              <p>
                <strong>4. Cookies &amp; Advertising:</strong> Essential browser storage preserves your dark/light theme preference, referral code attribution, and active session. When Google AdSense or Google Ads tags are configured, Google may use cookies in accordance with its advertising policies.
              </p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-3 text-xs sm:text-sm">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                Terms of Service
              </h3>
              <p>
                <strong>1. Acceptable Use:</strong> You agree to use Srabon Go responsibly and not generate unlawful, abusive, deceptive, or impersonating audio content without authorization.
              </p>
              <p>
                <strong>2. Free Quotas, Referrals &amp; Pro Access:</strong> Free accounts receive a daily generation allowance plus bonus credits earned via verified friend referrals (+10 credits per eligible sign-in). Self-referrals and automated abuse are prohibited.
              </p>
              <p>
                <strong>3. Intellectual Property:</strong> © 2026 Srabon Go — All Rights Reserved. Unauthorized copying, cloning, redistribution, or claiming ownership of Srabon Go branding, configuration, or source code is strictly prohibited.
              </p>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                Contact &amp; Support
              </h3>
              <p className="text-sm">
                Need help with Pro activation, referral credits, or technical feedback? Reach out directly to the Srabon Go team:
              </p>
              <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-zinc-400 block">
                    Support Email
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
                  <span>{copiedEmail ? 'Copied' : 'Copy Email'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/70 dark:bg-zinc-900/70">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            © 2026 Srabon Go — All Rights Reserved
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-zinc-900 dark:bg-indigo-600 text-white text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SiteLegalModal;
