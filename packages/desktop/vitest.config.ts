import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Pure unit tests — no Electron, no DB, no native modules.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@kcc/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
