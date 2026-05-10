// Type declarations for the API exposed by settings-preload.ts via contextBridge.
// Included in tsconfig.renderer.json alongside kcc.d.ts.

interface KccSettingsAPI {
  getSettings: () => Promise<{ hotkey: string; loginStartup: boolean }>;
  setHotkey: (accelerator: string) => Promise<{ success: boolean; conflict: boolean; message: string }>;
  setLoginStartup: (enabled: boolean) => Promise<void>;
}

declare global {
  interface Window {
    kccSettings: KccSettingsAPI;
  }
}

export {};
