/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React from 'react';
import { SocialLinksConfig } from '../types';
import { DEFAULT_SOCIAL_LINKS, isValidHttpsSocialUrl } from '../utils/socialLinks';
import { useLanguage } from '../utils/i18n';

interface SocialLinksRowProps {
  socialLinks?: SocialLinksConfig;
  variant: 'drawer' | 'footer';
  onLinkClick?: () => void;
}

const SocialLinksRow: React.FC<SocialLinksRowProps> = ({
  socialLinks = DEFAULT_SOCIAL_LINKS,
  variant,
  onLinkClick,
}) => {
  const { bi } = useLanguage();

  const items = [
    {
      key: 'facebook',
      label: 'Facebook',
      ariaLabel: bi('ফেসবুকে শ্রাবণ গো', 'Srabon Go on Facebook', 'Srabon Go no Facebook'),
      url: (socialLinks.facebookUrl || '').trim(),
      drawerHover:
        'hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700',
      footerHover: 'hover:text-indigo-600 dark:hover:text-indigo-400',
      icon: (
        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
        </svg>
      ),
    },
    {
      key: 'instagram',
      label: 'Instagram',
      ariaLabel: bi('ইনস্টাগ্রামে শ্রাবণ গো', 'Srabon Go on Instagram', 'Srabon Go no Instagram'),
      url: (socialLinks.instagramUrl || '').trim(),
      drawerHover:
        'hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-700',
      footerHover: 'hover:text-rose-600 dark:hover:text-rose-400',
      icon: (
        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.75 2h8.5A5.75 5.75 0 0122 7.75v8.5A5.75 5.75 0 0116.25 22h-8.5A5.75 5.75 0 012 16.25v-8.5A5.75 5.75 0 017.75 2zm0 2A3.75 3.75 0 004 7.75v8.5A3.75 3.75 0 007.75 20h8.5A3.75 3.75 0 0020 16.25v-8.5A3.75 3.75 0 0016.25 4h-8.5zM12 7a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm5.25-3a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z" />
        </svg>
      ),
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      ariaLabel: bi('লিঙ্কডইনে শ্রাবণ গো', 'Srabon Go on LinkedIn', 'Srabon Go no LinkedIn'),
      url: (socialLinks.linkedinUrl || '').trim(),
      drawerHover:
        'hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-300 dark:hover:border-sky-700',
      footerHover: 'hover:text-sky-600 dark:hover:text-sky-400',
      icon: (
        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
        </svg>
      ),
    },
    {
      key: 'youtube',
      label: 'YouTube',
      ariaLabel: bi('ইউটিউবে শ্রাবণ গো', 'Srabon Go on YouTube', 'Srabon Go no YouTube'),
      url: (socialLinks.youtubeUrl || '').trim(),
      drawerHover:
        'hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700',
      footerHover: 'hover:text-red-600 dark:hover:text-red-400',
      icon: (
        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
    },
  ].filter((item) => item.url.length > 0 && isValidHttpsSocialUrl(item.url));

  if (items.length === 0) return null;

  if (variant === 'drawer') {
    return (
      <div className="pt-2 mt-1 border-t border-zinc-100 dark:border-zinc-800 px-3 py-2.5 space-y-2">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {bi('শ্রাবণ গো সোশ্যাল মিডিয়া', 'Connect with Srabon Go', 'Conecte-se com o Srabon Go')}
        </p>
        <div className={`grid gap-2 ${items.length >= 4 ? 'grid-cols-2' : items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {items.map((item) => (
            <a
              key={item.key}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onLinkClick}
              aria-label={item.ariaLabel}
              className={`min-h-[42px] px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-xs font-medium text-zinc-700 dark:text-zinc-200 ${item.drawerHover} flex items-center justify-center gap-1.5 transition-colors`}
            >
              {item.icon}
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.ariaLabel}
          className={`inline-flex items-center gap-1.5 transition-colors ${item.footerHover}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </a>
      ))}
    </div>
  );
};

export default SocialLinksRow;
