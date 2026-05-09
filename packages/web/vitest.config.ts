import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Integration tests hit a real test database — run serially to avoid
    // connection pool exhaustion and seed data races.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // Increase timeout for DB-bound integration tests.
    testTimeout: 30_000,
    // Run global setup (migrate + seed) before any test file.
    globalSetup: './__tests__/setup/globalSetup.ts',
  },
  resolve: {
    alias: {
      '@kcc/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
