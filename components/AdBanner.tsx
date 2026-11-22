/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../utils/i18n';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

interface AdBannerProps {
  slotId?: string;
  format?: 'auto' | 'horizontal' | 'rectangle';
  className?: string;
}

const ADSENSE_SCRIPT_ID = 'google-adsense-script';

function ensureAdSenseScript(clientId: string): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(ADSENSE_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
  document.head.appendChild(script);
}

const AdBanner: React.FC<AdBannerProps> = ({
  slotId,
  format = 'auto',
  className = '',
}) => {
  const { bi } = useLanguage();
  const clientId = (import.meta.env.VITE_ADSENSE_CLIENT_ID || '').trim();
  const resolvedSlot = (slotId || import.meta.env.VITE_ADSENSE_SLOT_DEFAULT || '').trim();
  const insRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!clientId || !resolvedSlot) return;
    ensureAdSenseScript(clientId);

    const el = insRef.current;
    if (!el || pushedRef.current) return;
    if (el.getAttribute('data-adsbygoogle-status')) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch (err) {
      console.error('AdSense initialization error:', err);
    }
  }, [clientId, resolvedSlot]);

  if (!clientId || !resolvedSlot) {
    return null;
  }

  return (
    <div className={`w-full flex flex-col items-center justify-center ${className}`}>
      <span className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-1">
        {bi('বিজ্ঞাপন', 'Advertisement')}
      </span>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/60 min-h-[90px] flex items-center justify-center">
        <ins
          ref={insRef}
          className="adsbygoogle block w-full"
          data-ad-client={clientId}
          data-ad-slot={resolvedSlot}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
};

export default AdBanner;
