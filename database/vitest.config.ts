import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 120_000,  // 2 minutes — seed subprocess startup + 1000+ upserts is slow
    hookTimeout: 120_000,
  },
})
