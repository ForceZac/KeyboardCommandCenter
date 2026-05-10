import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for packages/overlay.
 *
 * - environment: 'jsdom' — provides window/navigator globals needed by the renderer hooks.
 * - globals: true — exposes describe/it/expect without explicit imports in test files.
 * - esbuild.jsx: 'automatic' — transforms .tsx files without needing @vitejs/plugin-react.
 */
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@kcc/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
