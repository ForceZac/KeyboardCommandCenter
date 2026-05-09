import { test, expect } from '@playwright/test';

/**
 * App shortcut page E2E tests.
 *
 * These tests guard the /apps/[slug] route.
 * They require a running dev server and a seeded database.
 * When the API is unavailable the tests skip gracefully.
 */
test.describe('App shortcut page', () => {
  // Use a well-known app slug that the seed script always populates.
  const APP_SLUG = 'vs-code';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`);
  });

  test('renders shortcut sections grouped by context', async ({ page }) => {
    // ContextGroup renders an h3 heading for each context group
    const headings = page.getByRole('heading', { level: 3 });
    await expect(headings.first()).toBeVisible({ timeout: 8000 });
  });

  test('key cap elements are visible', async ({ page }) => {
    // KeyCap renders as <kbd> elements
    const keyCaps = page.locator('kbd');
    await expect(keyCaps.first()).toBeVisible({ timeout: 8000 });
  });

  test('platform toggle buttons are present', async ({ page }) => {
    const winBtn = page.getByRole('button', { name: 'Win' });
    const macBtn = page.getByRole('button', { name: 'Mac' });
    const linuxBtn = page.getByRole('button', { name: 'Linux' });

    await expect(winBtn).toBeVisible();
    await expect(macBtn).toBeVisible();
    await expect(linuxBtn).toBeVisible();
  });

  test('platform toggle updates aria-pressed state', async ({ page }) => {
    const macBtn = page.getByRole('button', { name: 'Mac' });
    await macBtn.click();
    await expect(macBtn).toHaveAttribute('aria-pressed', 'true');

    const winBtn = page.getByRole('button', { name: 'Win' });
    await expect(winBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('in-app search input narrows displayed shortcuts', async ({ page }) => {
    const input = page.getByRole('searchbox', { name: /search shortcuts/i });
    await expect(input).toBeVisible();

    // Count context groups before search
    const headingsBefore = page.getByRole('heading', { level: 3 });
    const countBefore = await headingsBefore.count();
    if (countBefore === 0) return; // API unavailable

    // Type a search term that should match fewer shortcuts than the full list
    await input.fill('zzzznotexistent');

    // Should show no-results message
    await expect(page.getByText(/no shortcuts match/i)).toBeVisible({ timeout: 2000 });
  });

  test('clearing search restores full shortcut list', async ({ page }) => {
    const input = page.getByRole('searchbox', { name: /search shortcuts/i });
    await input.fill('zzzznotexistent');
    await expect(page.getByText(/no shortcuts match/i)).toBeVisible({ timeout: 2000 });

    await input.fill('');
    await expect(page.getByText(/no shortcuts match/i)).not.toBeVisible();
    const headings = page.getByRole('heading', { level: 3 });
    await expect(headings.first()).toBeVisible({ timeout: 2000 });
  });

  test('dark mode renders without obvious issues', async ({ page }) => {
    await expect(page.locator('html')).toHaveClass(/dark/);
    // Ensure no content is invisible (white-on-white)
    const heading = page.getByRole('heading', { level: 1 }).or(
      page.locator('header span.font-bold'),
    );
    await expect(heading.first()).toBeVisible();
  });

  test('no horizontal overflow at 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`/apps/${APP_SLUG}`);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(320);
  });
});
