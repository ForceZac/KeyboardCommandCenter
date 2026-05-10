import { contextBridge, ipcRenderer } from 'electron';

// Expose a typed settings API to the settings renderer.
// Separate from the panel preload — least-privilege: each window gets only what it needs.
contextBridge.exposeInMainWorld('kccSettings', {
  getSettings: (): Promise<{ hotkey: string; loginStartup: boolean }> =>
    ipcRenderer.invoke('settings:get'),

  setHotkey: (
    accelerator: string,
  ): Promise<{ success: boolean; conflict: boolean; message: string }> =>
    ipcRenderer.invoke('settings:set-hotkey', accelerator),

  setLoginStartup: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:set-login-startup', enabled),
});
