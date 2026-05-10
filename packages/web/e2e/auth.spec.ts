import { test, expect } from '@playwright/test';

test.describe('Auth header UI', () => {
  test('Sign In button is visible in unauthenticated state', async ({ page }) => {
    await page.goto('/');
    // layout.tsx calls auth() server-side — no session → renders SignInButton
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('global header always shows brand name', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /keyboard command center/i })).toBeVisible();
  });

  test('theme toggle is present alongside Sign In button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /toggle theme/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('header Sign In button appears on all pages — app detail page', async ({ page }) => {
    await page.goto('/apps/vscode');
    // Sign In should appear in global header regardless of page
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  // ── Middleware guard tests ───────────────────────────────────────────────
  // These confirm the protected route scaffolding (TASK-0021) returns 401.
  // The actual /api/favorites and /api/submissions routes don't exist yet
  // (TASK-0022 and Goal 8) — middleware intercepts the request before it
  // reaches any route handler.

  test('protected /api/favorites route returns 401 for unauthenticated request', async ({
    request,
  }) => {
    const res = await request.get('/api/favorites');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Unauthorized');
  });

  test('protected /api/submissions route returns 401 for unauthenticated request', async ({
    request,
  }) => {
    const res = await request.get('/api/submissions');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Unauthorized');
  });
});
