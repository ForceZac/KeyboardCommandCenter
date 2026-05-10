import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Pure unit tests — no Electron, no DB, no native modules.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  // Define webpack globals injected by electron-forge at build time so tests
  // that import main-process modules can reference them without a ReferenceError.
  define: {
    MAIN_WINDOW_WEBPACK_ENTRY: JSON.stringify('main-window.html'),
    MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: JSON.stringify('main-preload.js'),
    SETTINGS_WINDOW_WEBPACK_ENTRY: JSON.stringify('settings-window.html'),
    SETTINGS_WINDOW_PRELOAD_WEBPACK_ENTRY: JSON.stringify('settings-preload.js'),
    OVERLAY_WINDOW_WEBPACK_ENTRY: JSON.stringify('overlay-window.html'),
    OVERLAY_WINDOW_PRELOAD_WEBPACK_ENTRY: JSON.stringify('overlay-preload.js'),
  },
  resolve: {
    alias: {
      '@kcc/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
