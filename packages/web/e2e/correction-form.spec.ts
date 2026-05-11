import { test, expect } from '@playwright/test';

/**
 * Correction Form E2E tests — TASK-0030.
 *
 * Tests the "Suggest edit" pencil icon on shortcut rows, the CorrectionModal,
 * and the correction submission flow on per-app shortcut pages.
 *
 * Authenticated tests use the storageState fixture from auth-setup.ts.
 */

const APP_SLUG = 'vs-code';

// ── Unauthenticated ───────────────────────────────────────────────────────────

test.describe('Correction form — unauthenticated', () => {
  test('Suggest edit icon is visible on shortcut row hover', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    const row = page.locator('.group').first();
    await expect(row).toBeVisible({ timeout: 8000 });
    await row.hover();

    await expect(
      row.getByRole('button', { name: /suggest edit/i }),
    ).toBeVisible({ timeout: 3000 });
  });

  test('clicking Suggest edit shows sign-in prompt inside the modal', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    const row = page.locator('.group').first();
    await expect(row).toBeVisible({ timeout: 8000 });
    await row.hover();

    await row.getByRole('button', { name: /suggest edit/i }).click();

    await expect(
      page.getByText(/sign in to suggest a correction/i),
    ).toBeVisible({ timeout: 3000 });
  });

  test('correction modal closes on Escape key', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    const row = page.locator('.group').first();
    await expect(row).toBeVisible({ timeout: 8000 });
    await row.hover();
    await row.getByRole('button', { name: /suggest edit/i }).click();

    await expect(page.getByText(/sign in to suggest a correction/i)).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.getByText(/sign in to suggest a correction/i)).not.toBeVisible({ timeout: 2000 });
  });
});

// ── Authenticated ─────────────────────────────────────────────────────────────

test.describe('Correction form — authenticated', () => {
  test.use({ storageState: 'e2e/fixtures/authenticated.json' });

  test('correction modal shows pre-filled form when signed in', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    const row = page.locator('.group').first();
    await expect(row).toBeVisible({ timeout: 8000 });
    await row.hover();
    await row.getByRole('button', { name: /suggest edit/i }).click();

    await expect(page.getByText(/suggest a correction/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel(/command name/i)).toBeVisible();

    // Command should be pre-filled (not empty)
    const commandInput = page.getByLabel(/command name/i);
    await expect(commandInput).not.toHaveValue('');

    await expect(page.getByLabel(/platform/i)).toBeVisible();
    await expect(page.getByLabel(/key combination/i)).toBeVisible();
    await expect(page.getByLabel(/context/i)).toBeVisible();
    await expect(page.getByLabel(/reason for correction/i)).toBeVisible();
  });

  test('submit correction button is enabled with pre-filled data', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    const row = page.locator('.group').first();
    await expect(row).toBeVisible({ timeout: 8000 });
    await row.hover();
    await row.getByRole('button', { name: /suggest edit/i }).click();

    await expect(
      page.getByRole('button', { name: /submit correction/i }),
    ).toBeEnabled({ timeout: 3000 });
  });

  test('successful correction submission shows confirmation', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    // Mock POST /api/submissions to return 201
    await page.route('**/api/submissions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-correction-id',
            type: 'CORRECTION',
            status: 'PENDING',
            submitterId: 'test-user-id',
            appId: 'some-app-id',
            shortcutId: 'some-shortcut-id',
            data: {},
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

    const row = page.locator('.group').first();
    await expect(row).toBeVisible({ timeout: 8000 });
    await row.hover();
    await row.getByRole('button', { name: /suggest edit/i }).click();

    await page.getByRole('button', { name: /submit correction/i }).click();

    await expect(
      page.getByText(/correction submitted/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test('rate limit (429) shows user-friendly error', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    // Mock POST /api/submissions to return 429
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

    const row = page.locator('.group').first();
    await expect(row).toBeVisible({ timeout: 8000 });
    await row.hover();
    await row.getByRole('button', { name: /suggest edit/i }).click();

    await page.getByRole('button', { name: /submit correction/i }).click();

    await expect(
      page.getByText(/daily submission limit/i),
    ).toBeVisible({ timeout: 5000 });
  });
});
