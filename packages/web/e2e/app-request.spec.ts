import { test, expect } from '@playwright/test';

/**
 * App Request Form E2E tests — TASK-0031.
 *
 * Tests the "Request this app" button on the no-results search page,
 * the AppRequestModal, and the full submission flow.
 */

// ── Unauthenticated ───────────────────────────────────────────────────────────

test.describe('App request — unauthenticated', () => {
  test('searching for a nonexistent app shows the request button', async ({ page }) => {
    await page.goto('/');
    const input = page.getByRole('searchbox', { name: /search shortcuts/i });
    await input.fill('zzzznonexistentapp');

    await expect(
      page.getByRole('button', { name: /request this app/i }),
    ).toBeVisible({ timeout: 8000 });
  });

  test('clicking request button shows sign-in prompt inside modal', async ({ page }) => {
    await page.goto('/');
    const input = page.getByRole('searchbox', { name: /search shortcuts/i });
    await input.fill('zzzznonexistentapp');

    await page.getByRole('button', { name: /request this app/i }).click();

    await expect(
      page.getByText(/sign in to request a new app/i),
    ).toBeVisible({ timeout: 3000 });

    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('modal closes on Escape key', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: /search shortcuts/i }).fill('zzzznonexistentapp');
    await page.getByRole('button', { name: /request this app/i }).click();
    await expect(page.getByText(/sign in to request a new app/i)).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');

    await expect(page.getByText(/sign in to request a new app/i)).not.toBeVisible({ timeout: 2000 });
  });

  test('modal closes on backdrop click', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: /search shortcuts/i }).fill('zzzznonexistentapp');
    await page.getByRole('button', { name: /request this app/i }).click();
    await expect(page.getByText(/sign in to request a new app/i)).toBeVisible({ timeout: 3000 });

    await page.mouse.click(10, 10);

    await expect(page.getByText(/sign in to request a new app/i)).not.toBeVisible({ timeout: 2000 });
  });
});

// ── Authenticated ─────────────────────────────────────────────────────────────

test.describe('App request — authenticated', () => {
  test.use({ storageState: 'e2e/fixtures/authenticated.json' });

  test('modal shows form fields when signed in', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: /search shortcuts/i }).fill('zzzznonexistentapp');
    await page.getByRole('button', { name: /request this app/i }).click();

    await expect(page.getByLabel(/app name/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel(/website url/i)).toBeVisible();
    await expect(page.getByLabel(/category/i)).toBeVisible();
    await expect(page.getByText(/Windows/)).toBeVisible();
    await expect(page.getByText(/macOS/)).toBeVisible();
    await expect(page.getByText(/Linux/)).toBeVisible();
  });

  test('app name is pre-filled with the search query', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: /search shortcuts/i }).fill('zzzznonexistentapp');
    await page.getByRole('button', { name: /request this app/i }).click();

    await expect(page.getByLabel(/app name/i)).toHaveValue('zzzznonexistentapp', { timeout: 3000 });
  });

  test('submit button disabled when app name is empty', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: /search shortcuts/i }).fill('zzzznonexistentapp');
    await page.getByRole('button', { name: /request this app/i }).click();

    const appNameInput = page.getByLabel(/app name/i);
    await expect(appNameInput).toBeVisible({ timeout: 3000 });
    await appNameInput.fill('');

    await expect(page.getByRole('button', { name: /^request app$/i })).toBeDisabled();
  });

  test('submit button enabled when app name has text', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: /search shortcuts/i }).fill('zzzznonexistentapp');
    await page.getByRole('button', { name: /request this app/i }).click();

    await expect(page.getByLabel(/app name/i)).toBeVisible({ timeout: 3000 });

    await expect(page.getByRole('button', { name: /^request app$/i })).toBeEnabled();
  });

  test('successful submission shows confirmation message', async ({ page }) => {
    await page.goto('/');

    await page.route('**/api/submissions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-app-request-id',
            type: 'APP_REQUEST',
            status: 'PENDING',
            submitterId: 'test-user-id',
            appId: null,
            shortcutId: null,
            data: { appName: 'zzzznonexistentapp' },
            reviewerNotes: null,
            reviewedBy: null,
            reviewedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('searchbox', { name: /search shortcuts/i }).fill('zzzznonexistentapp');
    await page.getByRole('button', { name: /request this app/i }).click();
    await expect(page.getByLabel(/app name/i)).toBeVisible({ timeout: 3000 });

    await page.getByRole('button', { name: /^request app$/i }).click();

    await expect(
      page.getByText(/app request submitted/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test('rate limit (429) shows user-friendly error', async ({ page }) => {
    await page.goto('/');

    await page.route('**/api/submissions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Submission limit reached: max 20 submissions per day' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('searchbox', { name: /search shortcuts/i }).fill('zzzznonexistentapp');
    await page.getByRole('button', { name: /request this app/i }).click();
    await expect(page.getByLabel(/app name/i)).toBeVisible({ timeout: 3000 });

    await page.getByRole('button', { name: /^request app$/i }).click();

    await expect(
      page.getByText(/daily submission limit/i),
    ).toBeVisible({ timeout: 5000 });
  });
});
