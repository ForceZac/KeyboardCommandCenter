import { defineConfig, devices } from '@playwright/test';
import { TEST_AUTH_SECRET } from './e2e/auth-setup';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  // auth-setup.ts writes e2e/fixtures/authenticated.json before tests run
  globalSetup: './e2e/auth-setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-320',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 320, height: 568 },
      },
    },
  ],
  webServer: {
    // AUTH_SECRET must match TEST_AUTH_SECRET so the dev server accepts injected test cookies
    command: `AUTH_SECRET=${TEST_AUTH_SECRET} npm run dev -w packages/web`,
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
