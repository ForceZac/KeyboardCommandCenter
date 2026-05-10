import { useState, useEffect } from 'react';
import type { OverlayPrefs } from '../types';

const DEFAULT_PREFS: OverlayPrefs = {
  opacity: 0.4,
  size: 'Standard',
};

/**
 * useOverlayPrefs — reads overlay display preferences from electron-store
 * once on mount via window.kccOverlay.getOverlayPrefs().
 *
 * Returns DEFAULT_PREFS while the promise resolves so the overlay renders
 * immediately with sensible defaults.
 */
export function useOverlayPrefs(): OverlayPrefs {
  const [prefs, setPrefs] = useState<OverlayPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.kccOverlay) {
      return;
    }

    window.kccOverlay.getOverlayPrefs().then(fetched => {
      setPrefs(fetched);
    });
  }, []);

  return prefs;
}
