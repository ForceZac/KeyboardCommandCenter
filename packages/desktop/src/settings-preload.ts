import { contextBridge, ipcRenderer } from 'electron';
import type { AuthState, AuthSignedInPayload } from './auth';
import type { UpdateStatus } from './update-service';

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

    isSupported: (): Promise<boolean> =>
      ipcRenderer.invoke('overlay:is-supported'),
  },

  // TASK-0023: auth namespace — sign in/out and push event subscriptions.
  auth: {
    getAuthState: (): Promise<AuthState> => ipcRenderer.invoke('auth:get-state'),

    signIn: (): Promise<void> => ipcRenderer.invoke('auth:open-signin'),

    signOut: (): Promise<void> => ipcRenderer.invoke('auth:sign-out'),

    // Push listeners — main process sends these when auth state changes while
    // the settings window is open. The renderer calls getAuthState() on load
    // to initialize state, so missed pushes are recovered on next window open.
    onSignedIn: (callback: (payload: AuthSignedInPayload) => void): void => {
      ipcRenderer.on('auth:signed-in', (_event, payload: AuthSignedInPayload) =>
        callback(payload),
      );
    },

    onSignedOut: (callback: () => void): void => {
      ipcRenderer.on('auth:signed-out', () => callback());
    },
  },

  // TASK-0033: update namespace — check/install actions and status push.
  update: {
    getStatus: (): Promise<UpdateStatus> =>
      ipcRenderer.invoke('update:get-status'),

    checkNow: (): Promise<void> =>
      ipcRenderer.invoke('update:check-now'),

    restartAndInstall: (): Promise<void> =>
      ipcRenderer.invoke('update:restart-and-install'),

    // Push listener — main process sends this when update status changes.
    // Renderer subscribes on load; missed events are recovered via getStatus().
    onStatusChanged: (callback: (status: UpdateStatus) => void): void => {
      ipcRenderer.on('update:status-changed', (_event, payload: { status: UpdateStatus }) =>
        callback(payload.status),
      );
    },
  },

  // TASK-0033: app namespace — version info from main process.
  app: {
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke('app:get-version'),
  },
});
