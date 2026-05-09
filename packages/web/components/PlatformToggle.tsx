'use client';

import { clsx } from 'clsx';
import type { PlatformSlug } from '@kcc/core';

const PLATFORMS: { slug: PlatformSlug; label: string }[] = [
  { slug: 'windows', label: 'Win' },
  { slug: 'macos', label: 'Mac' },
  { slug: 'linux', label: 'Linux' },
];

interface Props {
  platform: PlatformSlug;
  onPlatformChange: (p: PlatformSlug) => void;
}

/**
 * PlatformToggle — three-button toggle group for Win / Mac / Linux.
 * Controlled component: caller owns [platform, setPlatform] via usePlatform.
 */
export default function PlatformToggle({ platform, onPlatformChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" role="group" aria-label="Platform">
      {PLATFORMS.map(({ slug, label }) => (
        <button
          key={slug}
          type="button"
          onClick={() => onPlatformChange(slug)}
          aria-pressed={platform === slug}
          className={clsx(
            'px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500',
            platform === slug
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
