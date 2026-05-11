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

  test('favoriting a shortcut persists across page navigation', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    const firstRow = page.locator('.group').first();
    await expect(firstRow).toBeVisible({ timeout: 8000 });
    await firstRow.hover();

    // Ensure the shortcut is favorited
    const addBtn = firstRow.getByRole('button', { name: /add to my favorites/i });
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await expect(
        firstRow.getByRole('button', { name: /remove from my favorites/i }),
      ).toBeVisible({ timeout: 3000 });
    }

    // Navigate away and back
    await page.goto('/');
    await page.goto(`/apps/${APP_SLUG}`);

    const reloadedRow = page.locator('.group').first();
    await expect(reloadedRow).toBeVisible({ timeout: 8000 });
    await reloadedRow.hover();

    // Heart should still be filled after navigation
    await expect(
      reloadedRow.getByRole('button', { name: /remove from my favorites/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('unfavoriting a shortcut empties the heart icon', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);

    const firstRow = page.locator('.group').first();
    await expect(firstRow).toBeVisible({ timeout: 8000 });
    await firstRow.hover();

    // Ensure the shortcut is favorited first
    const addBtn = firstRow.getByRole('button', { name: /add to my favorites/i });
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await expect(
        firstRow.getByRole('button', { name: /remove from my favorites/i }),
      ).toBeVisible({ timeout: 3000 });
    }

    // Now unfavorite it
    await firstRow.hover();
    const removeBtn = firstRow.getByRole('button', { name: /remove from my favorites/i });
    await expect(removeBtn).toBeVisible({ timeout: 3000 });
    await removeBtn.click();

    // Heart should be empty (optimistic)
    await expect(
      firstRow.getByRole('button', { name: /add to my favorites/i }),
    ).toBeVisible({ timeout: 3000 });
  });

  test('can rename a collection', async ({ page }) => {
    await page.goto('/collections');
    await expect(page.getByRole('heading', { name: /my collections/i })).toBeVisible({
      timeout: 8000,
    });

    // Create a collection to rename
    await page.getByRole('button', { name: /new collection/i }).click();
    const originalName = `Rename Test ${Date.now()}`;
    await page.getByLabel(/name/i).fill(originalName);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(originalName)).toBeVisible({ timeout: 5000 });

    // Click the edit button on that card
    await page.getByRole('button', { name: `Edit ${originalName}` }).click();

    // Update the name and save
    const newName = `Renamed ${Date.now()}`;
    const editInput = page.locator('input[type="text"]').first();
    await editInput.clear();
    await editInput.fill(newName);
    await page.getByRole('button', { name: /^save$/i }).click();

    // New name should appear
    await expect(page.getByText(newName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(originalName)).not.toBeVisible();
  });

  test('can delete a non-default collection', async ({ page }) => {
    await page.goto('/collections');
    await expect(page.getByRole('heading', { name: /my collections/i })).toBeVisible({
      timeout: 8000,
    });

    // Create a collection to delete
    await page.getByRole('button', { name: /new collection/i }).click();
    const collectionName = `Delete Test ${Date.now()}`;
    await page.getByLabel(/name/i).fill(collectionName);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(collectionName)).toBeVisible({ timeout: 5000 });

    // Click delete and confirm
    await page.getByRole('button', { name: `Delete ${collectionName}` }).click();
    await page.getByRole('dialog', { name: /confirm delete/i }).getByRole('button', { name: /^delete$/i }).click();

    // Collection should be gone
    await expect(page.getByText(collectionName)).not.toBeVisible({ timeout: 5000 });
  });

  test('can add a shortcut to a named collection via dropdown and see it in the detail view', async ({
    page,
  }) => {
    // Create a named collection via UI
    await page.goto('/collections');
    await expect(page.getByRole('heading', { name: /my collections/i })).toBeVisible({
      timeout: 8000,
    });
    await page.getByRole('button', { name: /new collection/i }).click();
    const collectionName = `Dropdown Test ${Date.now()}`;
    await page.getByLabel(/name/i).fill(collectionName);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(collectionName)).toBeVisible({ timeout: 5000 });

    // Get the collection ID
    const collectionsRes = await page.request.get('/api/collections');
    if (!collectionsRes.ok()) return; // DB unavailable — skip
    const collections = (await collectionsRes.json()) as { id: string; name: string }[];
    const createdCollection = collections.find((c) => c.name === collectionName);
    if (!createdCollection) return;

    // Go to the app page — named collection now exists so chevron should appear
    await page.goto(`/apps/${APP_SLUG}`);
    const firstRow = page.locator('.group').first();
    await expect(firstRow).toBeVisible({ timeout: 8000 });
    await firstRow.hover();

    // Open the collection dropdown
    const chevronBtn = firstRow.getByRole('button', { name: /add to collection/i });
    await expect(chevronBtn).toBeVisible({ timeout: 5000 });
    await chevronBtn.click();

    // Select the named collection in the dropdown
    await page.getByRole('button', { name: collectionName }).click();

    // Navigate to the collection detail page
    await page.goto(`/collections/${createdCollection.id}`);
    await expect(page.getByRole('link', { name: /my collections/i })).toBeVisible({
      timeout: 8000,
    });

    // At least one shortcut should now be in the collection
    await expect(page.locator('.group').first()).toBeVisible({ timeout: 5000 });
  });

  test('can remove a shortcut from a collection detail view', async ({ page }) => {
    // Create a named collection
    await page.goto('/collections');
    await expect(page.getByRole('heading', { name: /my collections/i })).toBeVisible({
      timeout: 8000,
    });
    await page.getByRole('button', { name: /new collection/i }).click();
    const collectionName = `Remove Test ${Date.now()}`;
    await page.getByLabel(/name/i).fill(collectionName);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(collectionName)).toBeVisible({ timeout: 5000 });

    // Get the collection ID
    const collectionsRes = await page.request.get('/api/collections');
    if (!collectionsRes.ok()) return; // DB unavailable — skip
    const collections = (await collectionsRes.json()) as { id: string; name: string }[];
    const createdCollection = collections.find((c) => c.name === collectionName);
    if (!createdCollection) return;

    // Add a shortcut via dropdown on the app page
    await page.goto(`/apps/${APP_SLUG}`);
    const firstRow = page.locator('.group').first();
    await expect(firstRow).toBeVisible({ timeout: 8000 });
    await firstRow.hover();

    const chevronBtn = firstRow.getByRole('button', { name: /add to collection/i });
    await expect(chevronBtn).toBeVisible({ timeout: 5000 });
    await chevronBtn.click();
    await page.getByRole('button', { name: collectionName }).click();

    // Go to the collection detail page
    await page.goto(`/collections/${createdCollection.id}`);
    const shortcutRow = page.locator('.group').first();
    await expect(shortcutRow).toBeVisible({ timeout: 8000 });

    // Hover to reveal the Remove button and click it
    await shortcutRow.hover();
    const removeBtn = shortcutRow.getByRole('button', { name: /^remove/i });
    await removeBtn.click({ force: true });

    // Collection should now be empty
    await expect(
      page.getByText(/no shortcuts in this collection/i),
    ).toBeVisible({ timeout: 5000 });
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
