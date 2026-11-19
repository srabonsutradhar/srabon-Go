/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useState } from 'react';
import { Mic, Loader2, AlertCircle, Sun, Moon, ShieldCheck, AudioLines } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

interface GoogleLoginGateProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const GoogleLoginGate: React.FC<GoogleLoginGateProps> = ({ isDarkMode, toggleTheme }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setError('লগইন পপআপ বন্ধ করা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। (Sign-in popup was closed.)');
      } else if (code === 'auth/popup-blocked') {
        setError('ব্রাউজারে পপআপ ব্লক করা আছে। অনুগ্রহ করে পপআপ অনুমতি দিন। (Please allow popups to sign in.)');
      } else if (code === 'auth/unauthorized-domain') {
        setError('এই ডোমেইনটি Firebase Authentication-এ অনুমোদিত নয়। Firebase Console > Authentication > Settings > Authorized domains-এ ডোমেইনটি যোগ করুন।');
      } else {
        setError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#FDFDFD] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans relative overflow-y-auto flex items-center justify-center p-4 transition-colors duration-300">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-50 dark:bg-blue-900/20 blur-3xl opacity-70" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-50 dark:bg-purple-900/20 blur-3xl opacity-60" />
      </div>

      {/* Theme Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-5 right-5 z-20 p-2.5 rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors shadow-sm"
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden animate-fade-in">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#4285F4] via-[#EA4335] via-[#FBBC04] to-[#34A853]" />

        <div className="p-8 sm:p-10 text-center space-y-6">
          {/* Brand Icon */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-zinc-900 dark:bg-zinc-100 rounded-2xl flex items-center justify-center shadow-lg shadow-zinc-900/15">
              <Mic size={26} className="text-white dark:text-zinc-900" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-300 text-xs font-semibold">
              <AudioLines size={12} />
              <span>Srabon Go</span>
            </div>
          </div>

          {/* Headings */}
          <div className="space-y-2.5">
            <h1 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-zinc-900 dark:text-white">
              প্রথমে গুগলে লগইন করুন
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              এই পেজে প্রবেশ করতে এবং ভয়েস স্টুডিও ও আপনার পছন্দের ভয়েসগুলো ব্যবহার করতে অনুগ্রহ করে গুগল অ্যাকাউন্ট দিয়ে সাইন ইন করুন।
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Sign in with Google to access Voice Studio, Casting Director, and synced favorites.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-300 text-xs text-left"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-sm shadow-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC04"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
            )}
            <span>{loading ? 'Signing in with Google...' : 'Continue with Google'}</span>
          </button>

          {/* Footer Note */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>Secured by Firebase Google Authentication</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
              <button
                type="button"
                onClick={() => setShowPrivacy(true)}
                className="hover:text-zinc-700 dark:hover:text-zinc-200 underline underline-offset-2 transition-colors"
              >
                Privacy Policy & Terms
              </button>
              <span>•</span>
              <span>© 2026 Srabon Go — All Rights Reserved</span>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy & Terms Modal */}
      {showPrivacy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-modal-title"
        >
          <div className="absolute inset-0" onClick={() => setShowPrivacy(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 text-left">
            <h2 id="privacy-modal-title" className="text-lg font-serif font-medium text-zinc-900 dark:text-white">
              Srabon Go — Privacy Policy & Terms
            </h2>
            <div className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <p>
                <strong>Google Sign-In:</strong> We collect your Google name, email address, and profile photo solely to authenticate your account and sync your favorite voices across sessions.
              </p>
              <p>
                <strong>Data Storage:</strong> Your preferences are securely stored in Firebase Firestore under owner-only access rules. We never sell or share your personal information with third parties.
              </p>
              <p>
                <strong>Text-to-Speech & Ads:</strong> Scripts you enter in Voice Studio are processed to synthesize audio and are not saved to your profile. If advertising is enabled, third-party vendors such as Google may use cookies to serve relevant ads.
              </p>
              <p>
                <strong>Ownership & Rights:</strong> © 2026 Srabon Go — All Rights Reserved. Unauthorized copying, redistribution, or claiming ownership of Srabon Go branding, configuration, or proprietary code is prohibited.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPrivacy(false)}
                className="px-4 py-2 rounded-full bg-zinc-900 dark:bg-indigo-600 text-white text-xs font-medium hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleLoginGate;
