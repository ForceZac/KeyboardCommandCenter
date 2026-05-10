import { defineConfig } from 'vite';
import path from 'path';

/**
 * Vite build config for the overlay renderer (packages/overlay).
 *
 * Uses esbuild's built-in jsx: 'automatic' for JSX transform — no @vitejs/plugin-react
 * needed since the overlay has no HMR requirement (loaded via Electron loadFile()).
 *
 * base: './' is required so asset paths resolve correctly when loaded from Electron's
 * loadFile() rather than a dev server.
 */
export default defineConfig({
  base: './',
  esbuild: {
    jsx: 'automatic',
  },
  build: {
    outDir: 'dist',
    target: 'chrome110',
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
  },
  resolve: {
    alias: {
      '@kcc/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
