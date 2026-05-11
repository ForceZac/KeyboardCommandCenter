import { test, expect } from '@playwright/test';

/**
 * Submission Form E2E tests — TASK-0028.
 *
 * Tests the "Submit a shortcut" button, SubmitShortcutModal, and
 * KeyRecorder on per-app shortcut pages.
 *
 * Authenticated tests use the storageState fixture from auth-setup.ts.
 * API-level tests skip gracefully when the database is unavailable.
 */

const APP_SLUG = 'vs-code';

// ── Unauthenticated ───────────────────────────────────────────────────────────

test.describe('Submission form — unauthenticated', () => {
  test('Submit a shortcut button is visible on the app page', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);
    await expect(
      page.getByRole('button', { name: /submit a shortcut/i }),
    ).toBeVisible({ timeout: 8000 });
  });

  test('clicking Submit a shortcut shows sign-in prompt inside the modal', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    const submitBtn = page.getByRole('button', { name: /submit a shortcut/i });
    await expect(submitBtn).toBeVisible({ timeout: 8000 });
    await submitBtn.click();

    // Modal opens with sign-in prompt (not the form)
    await expect(
      page.getByText(/sign in to submit a shortcut/i),
    ).toBeVisible({ timeout: 3000 });

    // Sign in link should be present
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('modal closes on Escape key', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);
    await page.getByRole('button', { name: /submit a shortcut/i }).click();
    await expect(page.getByText(/sign in to submit a shortcut/i)).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.getByText(/sign in to submit a shortcut/i)).not.toBeVisible({ timeout: 2000 });
  });

  test('modal can be dismissed by clicking the backdrop', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    await page.getByRole('button', { name: /submit a shortcut/i }).click();
    await expect(
      page.getByText(/sign in to submit a shortcut/i),
    ).toBeVisible({ timeout: 3000 });

    // Click the backdrop (outside the modal content)
    await page.mouse.click(10, 10);

    await expect(
      page.getByText(/sign in to submit a shortcut/i),
    ).not.toBeVisible({ timeout: 2000 });
  });

  test('modal can be dismissed by clicking the close button', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    await page.getByRole('button', { name: /submit a shortcut/i }).click();
    await expect(
      page.getByText(/sign in to submit a shortcut/i),
    ).toBeVisible({ timeout: 3000 });

    await page.getByRole('button', { name: /close/i }).click();

    await expect(
      page.getByText(/sign in to submit a shortcut/i),
    ).not.toBeVisible({ timeout: 2000 });
  });
});

// ── Authenticated ─────────────────────────────────────────────────────────────

test.describe('Submission form — authenticated', () => {
  test.use({ storageState: 'e2e/fixtures/authenticated.json' });

  test('modal shows the full submission form when signed in', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    await page.getByRole('button', { name: /submit a shortcut/i }).click();

    // Form fields should be visible
    await expect(page.getByLabel(/command name/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel(/platform/i)).toBeVisible();
    await expect(page.getByLabel(/key combination/i)).toBeVisible();
    await expect(page.getByLabel(/context/i)).toBeVisible();
    await expect(page.getByLabel(/notes/i)).toBeVisible();
  });

  test('submit button is disabled when required fields are empty', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);
    await page.getByRole('button', { name: /submit a shortcut/i }).click();

    const submitBtn = page.getByRole('button', { name: /^submit shortcut$/i });
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await expect(submitBtn).toBeDisabled();
  });

  test('submit button becomes enabled when command + key combo are filled', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);
    await page.getByRole('button', { name: /submit a shortcut/i }).click();

    // Fill command name
    await page.getByLabel(/command name/i).fill('Test Shortcut');

    // Click the KeyRecorder and press a key combo
    const keyRecorder = page.getByRole('textbox', { name: /key combo recorder/i });
    await keyRecorder.click();
    await page.keyboard.press('Control+Shift+T');

    // Submit button should now be enabled
    await expect(
      page.getByRole('button', { name: /^submit shortcut$/i }),
    ).toBeEnabled({ timeout: 3000 });
  });

  test('KeyRecorder captures and displays key combo on keystroke', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);
    await page.getByRole('button', { name: /submit a shortcut/i }).click();

    const keyRecorder = page.getByRole('textbox', { name: /key combo recorder/i });
    await expect(keyRecorder).toBeVisible({ timeout: 3000 });
    await keyRecorder.click();

    await page.keyboard.press('Control+Shift+K');

    // The recorder should display the normalized key combo
    await expect(keyRecorder).toHaveText(/Ctrl\+Shift\+K/i, { timeout: 2000 });
  });

  test('KeyRecorder clear button removes the recorded combo', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);
    await page.getByRole('button', { name: /submit a shortcut/i }).click();

    const keyRecorder = page.getByRole('textbox', { name: /key combo recorder/i });
    await keyRecorder.click();
    await page.keyboard.press('Control+K');

    // Combo should appear
    await expect(keyRecorder).toHaveText(/Ctrl\+K/i, { timeout: 2000 });

    // Click the clear button
    await page.getByRole('button', { name: /clear key combo/i }).click();

    // Recorder should be empty (shows placeholder)
    await expect(keyRecorder).not.toHaveText(/Ctrl/);
  });

  test('successful submission shows confirmation message', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    // Mock POST /api/submissions to return a 201 success
    await page.route('**/api/submissions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-submission-id',
            type: 'NEW_SHORTCUT',
            status: 'PENDING',
            submitterId: 'test-user-id',
            appId: 'some-app-id',
            shortcutId: null,
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

    await page.getByRole('button', { name: /submit a shortcut/i }).click();
    await page.getByLabel(/command name/i).fill('Test Shortcut');

    const keyRecorder = page.getByRole('textbox', { name: /key combo recorder/i });
    await keyRecorder.click();
    await page.keyboard.press('Control+Shift+T');

    await page.getByRole('button', { name: /^submit shortcut$/i }).click();

    // Confirmation message should appear
    await expect(
      page.getByText(/shortcut submitted/i),
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

    await page.getByRole('button', { name: /submit a shortcut/i }).click();
    await page.getByLabel(/command name/i).fill('Rate Limited Shortcut');

    const keyRecorder = page.getByRole('textbox', { name: /key combo recorder/i });
    await keyRecorder.click();
    await page.keyboard.press('Control+Y');

    await page.getByRole('button', { name: /^submit shortcut$/i }).click();

    // User-friendly rate limit message
    await expect(
      page.getByText(/daily submission limit/i),
    ).toBeVisible({ timeout: 5000 });
  });
});

// ── API-level: check-duplicate endpoint ──────────────────────────────────────

test.describe('check-duplicate API', () => {
  test('GET /api/shortcuts/check-duplicate returns 400 when params missing', async ({
    request,
  }) => {
    const res = await request.get('/api/shortcuts/check-duplicate');
    expect(res.status()).toBe(400);
  });

  test('GET /api/shortcuts/check-duplicate returns result shape', async ({ request }) => {
    // Use a known app slug — may not find a match but should return valid shape
    const appsRes = await request.get('/api/apps?category=developer-tools');
    if (!appsRes.ok()) return; // DB unavailable — skip
    const apps = (await appsRes.json()) as { id: string }[];
    if (apps.length === 0) return;

    const res = await request.get('/api/shortcuts/check-duplicate', {
      params: {
        appId: apps[0].id,
        platform: 'windows',
        keyCombo: 'Ctrl+S',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('exact');
    expect(body).toHaveProperty('fuzzy');
    expect(Array.isArray(body.fuzzy)).toBe(true);
  });
});
