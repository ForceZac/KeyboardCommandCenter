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

  overlay: {
    getOverlay: (): Promise<{
      enabled: boolean;
      hotkey: string;
      opacity: number;
      position: string;
      size: string;
    }> => ipcRenderer.invoke('overlay:get'),

    setEnabled: (enabled: boolean): Promise<void> =>
      ipcRenderer.invoke('overlay:set-enabled', { enabled }),

    setHotkey: (
      accelerator: string,
    ): Promise<{ success: boolean; conflict: boolean; message: string }> =>
      ipcRenderer.invoke('overlay:set-hotkey', { accelerator }),

    setOpacity: (opacity: number): Promise<void> =>
      ipcRenderer.invoke('overlay:set-opacity', { opacity }),

    setPosition: (position: string): Promise<void> =>
      ipcRenderer.invoke('overlay:set-position', { position }),

    setSize: (size: string): Promise<void> =>
      ipcRenderer.invoke('overlay:set-size', { size }),
  },
});
