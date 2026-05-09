// Type declarations for the API exposed by preload.ts via contextBridge.
// This file is included in tsconfig.renderer.json so the renderer's TypeScript
// knows the shape of window.kcc without importing from the main process.

interface KccAPI {
  hidePanel: () => void;
}

declare global {
  interface Window {
    kcc: KccAPI;
  }
}

export {};
