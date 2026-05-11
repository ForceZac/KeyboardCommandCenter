'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { detectOs, type DetectedOS } from '@/lib/detectOs';

const GITHUB_BASE =
  'https://github.com/ForceZac/KeyboardCommandCenter/releases/latest/download';

const ASSETS = {
  macos: {
    label: 'Download for macOS',
    href: `${GITHUB_BASE}/KeyboardCommandCenter.dmg`,
    detail: 'Universal (Apple Silicon + Intel) · .dmg',
  },
  windows_x64: {
    label: 'Download for Windows (x64)',
    href: `${GITHUB_BASE}/KeyboardCommandCenter-Setup.exe`,
    detail: 'Windows 10/11 x64 · NSIS installer',
  },
  windows_arm64: {
    label: 'Download for Windows (ARM64)',
    href: `${GITHUB_BASE}/KeyboardCommandCenter-Setup-arm64.exe`,
    detail: 'Windows 11 ARM64 · NSIS installer',
  },
} as const;

interface Props {
  serverDetectedOS: DetectedOS;
}

export default function DownloadPageClient({ serverDetectedOS }: Props) {
  const [resolvedOS, setResolvedOS] = useState<DetectedOS>(serverDetectedOS);

  useEffect(() => {
    // Confirm or refine the server's hint using navigator.userAgent.
    // This matters when the server hint was 'unknown' (e.g. a bot UA on the server
    // but a real browser on the client) or when SSR is bypassed.
    if (serverDetectedOS === 'unknown') {
      const clientOS = detectOs(navigator.userAgent);
      if (clientOS !== 'unknown') {
        setResolvedOS(clientOS);
      }
    }
  }, [serverDetectedOS]);

  const isMac = resolvedOS === 'macos';
  const isWin = resolvedOS === 'windows';

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Keyboard Command Center
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
            10,000+ shortcuts for every app. One hotkey away.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Runs silently in the background. Detects your active app. Shows the right shortcuts
            instantly.
          </p>
        </div>

        {/* Primary download button */}
        <div className="mb-6">
          {isMac && (
            <PrimaryButton
              href={ASSETS.macos.href}
              label={ASSETS.macos.label}
              detail={ASSETS.macos.detail}
            />
          )}
          {isWin && (
            <PrimaryButton
              href={ASSETS.windows_x64.href}
              label={ASSETS.windows_x64.label}
              detail={ASSETS.windows_x64.detail}
            />
          )}
          {!isMac && !isWin && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Choose your platform below to download.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={ASSETS.macos.href}
                  className="px-5 py-2.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors text-center"
                >
                  macOS (Universal)
                </a>
                <a
                  href={ASSETS.windows_x64.href}
                  className="px-5 py-2.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors text-center"
                >
                  Windows (x64)
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Secondary platform links */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              All platforms
            </p>
          </div>

          <SecondaryLink
            href={ASSETS.macos.href}
            label="macOS"
            detail={ASSETS.macos.detail}
            highlighted={isMac}
          />
          <SecondaryLink
            href={ASSETS.windows_x64.href}
            label="Windows x64"
            detail={ASSETS.windows_x64.detail}
            highlighted={isWin}
          />
          <SecondaryLink
            href={ASSETS.windows_arm64.href}
            label="Windows ARM64"
            detail={ASSETS.windows_arm64.detail}
            highlighted={false}
          />
        </div>

        {/* System requirements */}
        <div className="mt-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            System requirements
          </h2>
          <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
            <li>
              <span className="font-medium text-gray-800 dark:text-gray-200">macOS:</span> macOS
              12 Monterey or later · Apple Silicon or Intel
            </li>
            <li>
              <span className="font-medium text-gray-800 dark:text-gray-200">Windows:</span>{' '}
              Windows 10 (version 1903+) or Windows 11 · x64 or ARM64
            </li>
            <li>
              <span className="font-medium text-gray-800 dark:text-gray-200">Memory:</span> 100
              MB RAM (typical usage)
            </li>
          </ul>
        </div>

        {/* Browse link */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-10">
          Want to browse shortcuts without installing?{' '}
          <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            Search the database
          </Link>
        </p>
      </div>
    </main>
  );
}

function PrimaryButton({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center justify-center w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-colors text-white shadow-md"
    >
      <span className="text-lg font-semibold">{label}</span>
      <span className="text-xs text-indigo-200 mt-1">{detail}</span>
    </a>
  );
}

function SecondaryLink({
  href,
  label,
  detail,
  highlighted,
}: {
  href: string;
  label: string;
  detail: string;
  highlighted: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group ${
        highlighted ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''
      }`}
    >
      <div>
        <span
          className={`text-sm font-medium ${
            highlighted
              ? 'text-indigo-700 dark:text-indigo-300'
              : 'text-gray-800 dark:text-gray-200'
          }`}
        >
          {label}
        </span>
        {highlighted && (
          <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
            your platform
          </span>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{detail}</p>
      </div>
      <svg
        className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}
