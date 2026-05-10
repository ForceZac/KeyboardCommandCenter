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

export function setOverlayOpacity(opacity: number): void {
  // Clamp to 0.2–0.8 range before persisting.
  const clamped = Math.min(0.8, Math.max(0.2, opacity));
  store.set('overlay.opacity', clamped);
}

export function setOverlayPosition(position: string): void {
  store.set('overlay.position', position);
}

export function setOverlaySize(size: string): void {
  store.set('overlay.size', size);
}
