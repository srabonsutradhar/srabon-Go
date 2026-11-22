/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { useLanguage } from '../utils/i18n';
import { usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'menu' | 'hero' | 'card' | 'footer';
  onActionTaken?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'hero',
  onActionTaken,
}) => {
  const { bi } = useLanguage();
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isEmbeddedIframe,
    install,
  } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!showGuideModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuideModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showGuideModal]);

  if (isInstalled) {
    return null;
  }

  const safeOpenUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '/';

  const handleInstallClick = async () => {
    onActionTaken?.();
    if (isInstallable) {
      setInstalling(true);
      try {
        const accepted = await install();
        if (!accepted) {
          setShowGuideModal(true);
        }
      } finally {
        setInstalling(false);
      }
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      {variant === 'menu' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
        >
          <span className="flex items-center gap-3">
            <Smartphone size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {isInstallable
                ? bi('অ্যান্ড্রয়েড অ্যাপ ইনস্টল করুন', 'Install Android App')
                : bi('অ্যান্ড্রয়েড মোবাইল অ্যাপ ডাউনলোড', 'Download Android App')}
            </span>
          </span>
          <Download size={14} className="shrink-0 opacity-80" />
        </button>
      ) : variant === 'card' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/25 transition-all whitespace-nowrap shrink-0"
        >
          <Download size={17} />
          <span>
            {isInstallable
              ? bi('অ্যান্ড্রয়েড অ্যাপ ইনস্টল করুন', 'Install Android App Now')
              : bi('অ্যান্ড্রয়েড অ্যাপ ডাউনলোড করুন', 'Download Android App')}
          </span>
        </button>
      ) : variant === 'footer' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
        >
          <Smartphone size={13} />
          <span>{bi('অ্যান্ড্রয়েড অ্যাপ', 'Android App')}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          className="inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 font-semibold text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone size={16} />
          <span>
            {isInstallable
              ? bi('অ্যান্ড্রয়েড অ্যাপ ইনস্টল', 'Install Android App')
              : bi('অ্যান্ড্রয়েড অ্যাপ পান', 'Get Android App')}
          </span>
        </button>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-modal-title"
        >
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowGuideModal(false)}
          />

          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 shadow-2xl p-6 space-y-4 animate-slide-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-amber-500 text-white flex items-center justify-center shadow-lg shrink-0">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h3
                    id="pwa-install-modal-title"
                    className="text-base sm:text-lg font-serif font-semibold text-slate-900 dark:text-white"
                  >
                    {bi(
                      'শ্রাবণ গো · অ্যান্ড্রয়েড মোবাইল অ্যাপ',
                      'Srabon Go · Android Mobile App'
                    )}
                  </h3>
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {bi(
                      'ইনস্টলযোগ্য অফলাইন-রেডি মোবাইল অ্যাপ (WebAPK)',
                      'Installable Offline-Ready Mobile App (WebAPK)'
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                aria-label={bi('বন্ধ করুন', 'Close')}
              >
                <X size={16} />
              </button>
            </div>

            {/* App Feature Highlights */}
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900 text-center space-y-1">
                <CheckCircle2 size={15} className="mx-auto text-emerald-600 dark:text-emerald-400" />
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {bi('হোম স্ক্রিন আইকন', 'App Icon')}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900 text-center space-y-1">
                <WifiOff size={15} className="mx-auto text-indigo-600 dark:text-indigo-400" />
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {bi('অফলাইন ক্যাশ', 'Offline Ready')}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900 text-center space-y-1">
                <ShieldCheck size={15} className="mx-auto text-amber-600 dark:text-amber-400" />
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {bi('সুরক্ষিত ও ফাস্ট', 'Fast & Secure')}
                </p>
              </div>
            </div>

            {isEmbeddedIframe && (
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-200 space-y-2 leading-relaxed">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles size={14} className="shrink-0" />
                  <span>
                    {bi(
                      'অ্যান্ড্রয়েড ফোনে ডাউনলোড/ইনস্টল পপআপ দেখতে নতুন ট্যাবে খুলুন',
                      'Open in New Chrome Tab to Download / Install on Android'
                    )}
                  </span>
                </p>
                <p>
                  {bi(
                    'প্রিভিউ ফ্রেমের ভেতর থেকে ব্রাউজার অ্যাপ ইনস্টল পপআপ আটকে দেয়। নিচের বাটনে চাপ দিয়ে সরাসরি Chrome ব্রাউজারে খুললে "Install App" বাটনটি সাথে সাথে কাজ করবে।',
                    'Embedded preview frames suppress browser install prompts. Tap below to open directly in Android Chrome so the native "Install App" prompt appears.'
                  )}
                </p>
                <a
                  href={safeOpenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm transition-colors"
                >
                  <ExternalLink size={15} />
                  <span>
                    {bi(
                      'Chrome / নতুন ট্যাবে খুলুন ও ইনস্টল করুন',
                      'Open in New Tab & Install App'
                    )}
                  </span>
                </a>
              </div>
            )}

            {/* Step-by-step Mobile Install Guide */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2.5 leading-relaxed">
              {isIOS ? (
                <>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {bi('iPhone / iPad (Safari) ইনস্টল নিয়ম:', 'How to Install on iPhone / iPad (Safari):')}
                  </p>
                  <p>
                    {bi(
                      '১. Safari ব্রাউজারের নিচের Share আইকনে ট্যাপ করুন।',
                      '1. Tap the Share icon in the Safari toolbar.'
                    )}
                  </p>
                  <p>
                    {bi(
                      '২. নিচে স্ক্রল করে "Add to Home Screen" সিলেক্ট করে Add চাপুন।',
                      '2. Scroll down, tap "Add to Home Screen", then tap Add.'
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {isAndroid
                      ? bi('অ্যান্ড্রয়েড ফোনে ডাউনলোড ও ইনস্টল নিয়ম:', 'How to Download & Install on Android:')
                      : bi('অ্যান্ড্রয়েড মোবাইল / ডেস্কটপ Chrome ইনস্টল নিয়ম:', 'How to Install on Android Phone / Desktop Chrome:')}
                  </p>
                  <p>
                    {bi(
                      '১. আপনার ফোনের Chrome ব্রাউজারে এই ওয়েবসাইটটি ওপেন করুন।',
                      '1. Open this website in Google Chrome on your Android phone.'
                    )}
                  </p>
                  <p>
                    {bi(
                      '২. Chrome-এর উপরে ডানপাশের থ্রি-ডট (⋮) মেনুতে ট্যাপ করুন এবং "Install app" বা "Add to Home screen" সিলেক্ট করুন।',
                      '2. Tap the top-right ⋮ menu in Chrome and choose "Install app" (or "Add to Home screen").'
                    )}
                  </p>
                  <p>
                    {bi(
                      '৩. কনফার্ম করলে কয়েক সেকেন্ডেই আপনার অ্যান্ড্রয়েড ফোনে অ্যাপ আইকন ডাউনলোড ও ইনস্টল হয়ে যাবে।',
                      '3. Confirm "Install" — the Srabon Go Android app downloads and appears on your home screen & app drawer.'
                    )}
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              {isInstallable && (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-md transition-all"
                >
                  <Download size={16} />
                  <span>{bi('এখনই ইনস্টল করুন', 'Install Now')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className={`${
                  isInstallable ? 'px-5' : 'w-full'
                } py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-colors`}
              >
                {bi('বুঝেছি / বন্ধ করুন', 'Got It / Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallButton;
