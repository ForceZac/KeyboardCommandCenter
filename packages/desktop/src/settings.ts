import Store from 'electron-store';

// Platform-appropriate default hotkeys.
const defaultHotkey =
  process.platform === 'darwin' ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space';
const defaultOverlayHotkey =
  process.platform === 'darwin' ? 'Cmd+Shift+O' : 'Ctrl+Shift+O';

export interface OverlayPrefs {
  enabled: boolean;
  hotkey: string;
  opacity: number;
  position: string;
  size: string;
  /** Auto-dismiss timeout in milliseconds when running on Wayland. 0 = never dismiss. */
  waylandDismissTimeoutMs: number;
}

interface SettingsSchema {
  hotkey: string;
  loginStartup: boolean;
  overlay: OverlayPrefs;
}

const store = new Store<SettingsSchema>({
  defaults: {
    hotkey: defaultHotkey,
    loginStartup: true,
    overlay: {
      enabled: false,
      hotkey: defaultOverlayHotkey,
      opacity: 0.4,
      position: 'Top Right',
      size: 'Standard',
      waylandDismissTimeoutMs: 8000,
    },
  },
});

export function getHotkey(): string {
  return store.get('hotkey');
}

export function setHotkey(accelerator: string): void {
  store.set('hotkey', accelerator);
}

export function getLoginStartup(): boolean {
  return store.get('loginStartup');
}

export function setLoginStartup(enabled: boolean): void {
  store.set('loginStartup', enabled);
}

export function getOverlayPrefs(): OverlayPrefs {
  return store.get('overlay');
}

export function setOverlayEnabled(enabled: boolean): void {
  store.set('overlay.enabled', enabled);
}

export function setOverlayHotkey(accelerator: string): void {
  store.set('overlay.hotkey', accelerator);
}

/** Clamps an opacity float to the 0.2–0.8 allowed range. Exported for use in IPC handlers. */
export function clampOpacity(opacity: number): number {
  return Math.min(0.8, Math.max(0.2, opacity));
}

export function setOverlayOpacity(opacity: number): void {
  store.set('overlay.opacity', clampOpacity(opacity));
}

export function setOverlayPosition(position: string): void {
  store.set('overlay.position', position);
}

export function setOverlaySize(size: string): void {
  store.set('overlay.size', size);
}

export function getOverlayWaylandDismissTimeoutMs(): number {
  return (store.get('overlay') as OverlayPrefs).waylandDismissTimeoutMs;
}

export function setOverlayWaylandDismissTimeoutMs(ms: number): void {
  store.set('overlay.waylandDismissTimeoutMs', ms);
}
