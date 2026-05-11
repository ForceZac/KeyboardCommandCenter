// Type declarations for the API exposed by settings-preload.ts via contextBridge.
// Included in tsconfig.renderer.json alongside kcc.d.ts.

export interface OverlayPrefs {
  enabled: boolean;
  hotkey: string;
  opacity: number;
  position: string;
  size: string;
}

// TASK-0023: Auth state and push payload types.
export interface AuthState {
  isAuthenticated: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AuthSignedInPayload {
  displayName: string | null;
  avatarUrl: string | null;
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
    isSupported: () => Promise<boolean>;
  };
  // TASK-0023: auth namespace
  auth: {
    getAuthState: () => Promise<AuthState>;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    onSignedIn: (callback: (payload: AuthSignedInPayload) => void) => void;
    onSignedOut: (callback: () => void) => void;
  };
}

declare global {
  interface Window {
    kccSettings: KccSettingsAPI;
  }
}

export {};
