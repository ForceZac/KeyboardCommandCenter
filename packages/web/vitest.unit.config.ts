import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Unit test config — no globalSetup, no DATABASE_URL required.
// Runs API route + service unit tests using mocked Prisma, plus hook and component
// unit tests that mock all external dependencies.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    include: [
      '__tests__/api/favorites.test.ts',
      '__tests__/api/collections.test.ts',
      '__tests__/api/createUser-event.test.ts',
      '__tests__/hooks/useFavorites.test.ts',
      '__tests__/components/FavoriteToggle.test.tsx',
    ],
    // No globalSetup — unit tests mock Prisma and do not hit a real database.
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@kcc/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
