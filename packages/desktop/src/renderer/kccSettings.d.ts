// Type declarations for the API exposed by settings-preload.ts via contextBridge.
// Included in tsconfig.renderer.json alongside kcc.d.ts.

export interface OverlayPrefs {
  enabled: boolean;
  hotkey: string;
  opacity: number;
  position: string;
  size: string;
}

interface KccSettingsAPI {
  getSettings: () => Promise<{ hotkey: string; loginStartup: boolean }>;
  setHotkey: (accelerator: string) => Promise<{ success: boolean; conflict: boolean; message: string }>;
  setLoginStartup: (enabled: boolean) => Promise<void>;
  overlay: {
    getOverlay: () => Promise<OverlayPrefs>;
    setEnabled: (enabled: boolean) => Promise<void>;
    setHotkey: (accelerator: string) => Promise<{ success: boolean; conflict: boolean; message: string }>;
    setOpacity: (opacity: number) => Promise<void>;
    setPosition: (position: string) => Promise<void>;
    setSize: (size: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    kccSettings: KccSettingsAPI;
  }
}

export {};
