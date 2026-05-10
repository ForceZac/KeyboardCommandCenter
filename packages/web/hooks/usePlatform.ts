'use client';

import { useState, useEffect } from 'react';
import type { PlatformSlug } from '@kcc/core';

const STORAGE_KEY = 'kcc_platform';

/** Detect the user's OS from userAgent. Falls back to 'windows'. */
function detectPlatform(): PlatformSlug {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = navigator.userAgent;
  if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return 'macos';
  if (/Linux/.test(ua)) return 'linux';
  return 'windows';
}

/**
 * Persistent platform selection.
 * Reads kcc_platform from localStorage on mount; defaults to detected OS.
 * Writes to localStorage on every setPlatform call.
 */
export function usePlatform(): [PlatformSlug, (p: PlatformSlug) => void] {
  const [platform, setPlatformState] = useState<PlatformSlug>('windows');

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as PlatformSlug | null;
    setPlatformState(stored ?? detectPlatform());
  }, []);

  const setPlatform = (p: PlatformSlug) => {
    localStorage.setItem(STORAGE_KEY, p);
    setPlatformState(p);
  };

  return [platform, setPlatform];
}
