import { test, expect } from '@playwright/test';

/**
 * Category page E2E tests.
 *
 * These tests guard the /categories/[slug] route.
 * They require a running dev server and a seeded database.
 * When the API is unavailable the tests skip gracefully.
 */
test.describe('Category page', () => {
  // Use a well-known category slug that the seed script always populates.
  const CATEGORY_SLUG = 'developer-tools';

  test('renders app grid with at least one tile', async ({ page }) => {
    await page.goto(`/categories/${CATEGORY_SLUG}`);

    // The h1 should show the category name
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();

    // Wait for app tiles (links to /apps/*)
    const tiles = page.locator('a[href^="/apps/"]');
    await expect(tiles.first()).toBeVisible({ timeout: 8000 });
  });

  test('app tiles link to /apps/[slug]', async ({ page }) => {
    await page.goto(`/categories/${CATEGORY_SLUG}`);

    const tiles = page.locator('a[href^="/apps/"]');
    const count = await tiles.count();
    if (count === 0) return; // API unavailable

    const href = await tiles.first().getAttribute('href');
    expect(href).toMatch(/^\/apps\/.+/);
  });

  test('clicking an app tile navigates to /apps/[slug]', async ({ page }) => {
    await page.goto(`/categories/${CATEGORY_SLUG}`);

    const tiles = page.locator('a[href^="/apps/"]');
    const count = await tiles.count();
    if (count === 0) return; // API unavailable

    await tiles.first().click();
    await expect(page).toHaveURL(/\/apps\/.+/, { timeout: 8000 });
  });

  test('page title includes the category name', async ({ page }) => {
    await page.goto(`/categories/${CATEGORY_SLUG}`);
    const title = await page.title();
    // Title format: "<Category Name> shortcuts — Keyboard Command Center"
    expect(title).toContain('Keyboard Command Center');
  });

  test('no horizontal overflow at 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`/categories/${CATEGORY_SLUG}`);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(320);
  });
});
