import { useState, useEffect } from 'react';
import type { AppDetail, DetectionPayload, OverlayStatus } from '../types';

interface OverlayDataState {
  status: OverlayStatus;
  appDetail: AppDetail | null;
  processName: string;
}

/**
 * useOverlayData — subscribes to window.kccOverlay.onAppChanged and fetches
 * shortcut data from the main-process prefetch cache on each event.
 *
 * Status transitions:
 *   idle       → loaded        (recognized app, AppDetail received)
 *   idle       → unrecognized  (null slug or null AppDetail)
 *   idle       → no-detection  (detection service emits empty-processName sentinel)
 *   loaded     → * / unrecognized → * / no-detection → * on subsequent events
 *
 * Flash prevention: for recognized-slug events the previous appDetail is kept
 * visible until getShortcutsForApp resolves, then state is updated atomically.
 * This avoids a blank overlay frame between app transitions.
 */
export function useOverlayData(): OverlayDataState {
  const [state, setState] = useState<OverlayDataState>({
    status: 'idle',
    appDetail: null,
    processName: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.kccOverlay) {
      return;
    }

    const unsubscribe = window.kccOverlay.onAppChanged(async (payload: DetectionPayload) => {
      // No-detection sentinel: detection service sets processName to '' when
      // the active window disappears (user reached desktop or minimized all windows).
      if (payload.processName === '') {
        setState({ status: 'no-detection', appDetail: null, processName: '' });
        return;
      }

      if (!payload.appSlug) {
        setState({ status: 'unrecognized', appDetail: null, processName: payload.processName });
        return;
      }

      // Flash prevention: do not clear appDetail before the new data arrives.
      // Previous overlay content remains visible while getShortcutsForApp
      // resolves (prefetch cache serves most calls in < 5ms). State is then
      // updated in a single atomic setState once the data is ready.
      const appDetail: AppDetail | null = await window.kccOverlay.getShortcutsForApp(payload.appSlug);
      if (!appDetail) {
        setState({ status: 'unrecognized', appDetail: null, processName: payload.processName });
        return;
      }

      setState({ status: 'loaded', appDetail, processName: payload.processName });
    });

    return unsubscribe;
  }, []);

  return state;
}
