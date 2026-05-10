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
 *   idle → loaded     (recognized app, AppDetail received)
 *   idle → unrecognized (null slug or null AppDetail)
 *   loaded → * / unrecognized → * on subsequent app-changed events
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
      if (!payload.appSlug) {
        setState({ status: 'unrecognized', appDetail: null, processName: payload.processName });
        return;
      }

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
