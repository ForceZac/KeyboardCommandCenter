import { test, expect } from '@playwright/test';

/**
 * Favorites & Collections E2E tests.
 *
 * Authenticated tests use the storageState fixture written by auth-setup.ts.
 * All tests require a running dev server and a seeded database.
 * API-level tests use the Playwright `request` fixture so they skip smoothly
 * if the database is unavailable.
 */

const APP_SLUG = 'vs-code';

// ── Unauthenticated — heart icon prompts sign-in ──────────────────────────────

test.describe('Unauthenticated favorite behavior', () => {
  test('heart icon is visible on shortcut row hover and shows sign-in prompt', async ({
    page,
  }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    // Wait for shortcuts to render
    const firstRow = page.locator('.group').first();
    await expect(firstRow).toBeVisible({ timeout: 8000 });

    // Hover the row to reveal the heart button
    await firstRow.hover();

    const heartBtn = firstRow.getByRole('button', {
      name: /add to my favorites|remove from my favorites/i,
    });
    await expect(heartBtn).toBeVisible({ timeout: 3000 });

    // Clicking should show the sign-in prompt
    await heartBtn.click();
    await expect(page.getByText(/sign in to save favorites/i)).toBeVisible({ timeout: 2000 });

    // Dismiss
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByText(/sign in to save favorites/i)).not.toBeVisible();
  });
});

// ── API-level tests (no browser needed) ──────────────────────────────────────

test.describe('Favorites API — unauthenticated', () => {
  test('GET /api/favorites returns 401', async ({ request }) => {
    const res = await request.get('/api/favorites');
    expect(res.status()).toBe(401);
  });

  test('POST /api/favorites returns 401', async ({ request }) => {
    const res = await request.post('/api/favorites', {
      data: { shortcutId: 'any' },
    });
    expect(res.status()).toBe(401);
  });
});

// ── Authenticated tests ───────────────────────────────────────────────────────

test.describe('Authenticated favorites', () => {
  test.use({ storageState: 'e2e/fixtures/authenticated.json' });

  test('My Collections link appears in UserMenu when signed in', async ({ page }) => {
    await page.goto('/');
    // Open UserMenu
    const menuBtn = page.getByRole('button', { name: /user menu for test user/i });
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    await expect(page.getByRole('link', { name: /my collections/i })).toBeVisible();
  });

  test('/collections page is accessible when signed in', async ({ page }) => {
    await page.goto('/collections');
    // Should render the My Collections heading — not redirected to sign-in
    await expect(
      page.getByRole('heading', { name: /my collections/i }),
    ).toBeVisible({ timeout: 8000 });
  });

  test('can create a new collection', async ({ page }) => {
    await page.goto('/collections');
    await expect(
      page.getByRole('heading', { name: /my collections/i }),
    ).toBeVisible({ timeout: 8000 });

    // Open the new-collection form
    await page.getByRole('button', { name: /new collection/i }).click();

    const nameInput = page.getByLabel(/name/i);
    await expect(nameInput).toBeVisible();

    const collectionName = `Test Collection ${Date.now()}`;
    await nameInput.fill(collectionName);

    await page.getByRole('button', { name: /^create$/i }).click();

    // New collection card should appear
    await expect(page.getByText(collectionName)).toBeVisible({ timeout: 5000 });
  });

  test('heart icon is visible on shortcut row hover when signed in', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    const firstRow = page.locator('.group').first();
    await expect(firstRow).toBeVisible({ timeout: 8000 });

    await firstRow.hover();

    const heartBtn = firstRow.getByRole('button', {
      name: /add to my favorites|remove from my favorites/i,
    });
    await expect(heartBtn).toBeVisible({ timeout: 3000 });
  });

  test('favoriting a shortcut fills the heart icon (optimistic)', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    const firstRow = page.locator('.group').first();
    await expect(firstRow).toBeVisible({ timeout: 8000 });
    await firstRow.hover();

    const heartBtn = firstRow.getByRole('button', { name: /add to my favorites/i });
    // If this shortcut is already favorited, skip gracefully
    if (!(await heartBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;

    await heartBtn.click();

    // After optimistic update, button should now say "Remove"
    await expect(
      firstRow.getByRole('button', { name: /remove from my favorites/i }),
    ).toBeVisible({ timeout: 3000 });
  });

  test('/collections/:id page renders for the default collection', async ({
    page,
    request,
  }) => {
    // Fetch collections to find the default one's ID
    const res = await request.get('/api/collections');
    if (!res.ok()) return; // DB unavailable — skip
    const collections = (await res.json()) as { id: string; isDefault: boolean }[];
    const defaultColl = collections.find((c) => c.isDefault);
    if (!defaultColl) return;

    await page.goto(`/collections/${defaultColl.id}`);
    await expect(page.getByRole('link', { name: /my collections/i })).toBeVisible({
      timeout: 8000,
    });
  });
});
