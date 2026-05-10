import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Unit test config — no globalSetup, no DATABASE_URL required.
// Runs API route + service unit tests using mocked Prisma.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    include: ['__tests__/**/*.test.ts'],
    // No globalSetup — unit tests mock Prisma and do not hit a real database.
  },
  resolve: {
    alias: {
      '@kcc/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
