/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GOOGLE_ADS_SCRIPT_ID = 'google-ads-gtag-script';

/**
 * Loads the Google Ads (gtag.js) global site tag when VITE_GOOGLE_ADS_ID is configured
 * (e.g. "AW-XXXXXXXXXX"). Does nothing if unconfigured.
 */
export function initGoogleAdsTag(): void {
  const adsId = (import.meta.env.VITE_GOOGLE_ADS_ID || '').trim();
  if (!adsId || typeof document === 'undefined') return;
  if (document.getElementById(GOOGLE_ADS_SCRIPT_ID)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', adsId);

  const script = document.createElement('script');
  script.id = GOOGLE_ADS_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(adsId)}`;
  document.head.appendChild(script);
}
