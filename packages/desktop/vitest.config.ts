import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Desktop tests are unit tests only — no real DB, no heavy infra.
    // Run in a forked pool so native module mocking via vi.mock() is isolated.
    pool: 'forks',
    environment: 'node',
    testTimeout: 10_000,
    // Exclude renderer tests (they're browser-only)
    exclude: ['src/renderer/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@kcc/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
