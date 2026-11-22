/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '../utils/i18n';
import { useOnlineStatus } from '../utils/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { bi } = useLanguage();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-[100] inline-flex items-center gap-2 rounded-xl bg-amber-600 text-white px-3.5 py-2 text-xs font-semibold shadow-xl border border-amber-400/50"
    >
      <WifiOff size={14} className="shrink-0" />
      <span>
        {bi(
          'অফলাইন মোড — ক্যাশ করা অ্যাপ ডেটা ব্যবহৃত হচ্ছে',
          'Offline Mode — Cached app data is being used.'
        )}
      </span>
    </div>
  );
};

export default OfflineIndicator;
