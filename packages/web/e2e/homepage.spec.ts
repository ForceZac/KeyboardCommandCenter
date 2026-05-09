import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders search bar', async ({ page }) => {
    await expect(
      page.getByRole('searchbox', { name: /search shortcuts/i }),
    ).toBeVisible();
  });

  test('category grid visible when categories available', async ({ page }) => {
    // The heading is always in the DOM; category tiles appear only when the API responds
    const heading = page.getByRole('heading', { name: /browse by category/i });
    // If the API is unavailable (TASK-0003 not merged), the section is hidden — skip gracefully
    if (await heading.isVisible().catch(() => false)) {
      const tiles = page.locator('a[href^="/categories/"]');
      await expect(tiles.first()).toBeVisible();
    }
  });

  test('typing 2+ chars triggers search and shows results or no-results message', async ({
    page,
  }) => {
    const input = page.getByRole('searchbox', { name: /search shortcuts/i });
    await input.fill('copy');
    // Wait past the 300ms debounce for the query to fire
    await expect(
      page
        .getByRole('article')
        .first()
        .or(page.getByText(/no shortcuts found/i)),
    ).toBeVisible({ timeout: 6000 });
  });

  test('clearing search hides results', async ({ page }) => {
    const input = page.getByRole('searchbox', { name: /search shortcuts/i });
    await input.fill('copy');
    // Wait for results to potentially appear
    await page.waitForTimeout(500);
    await input.fill('');
    // Results section should disappear immediately (clear is not debounced)
    await expect(page.getByRole('article').first()).not.toBeVisible({ timeout: 1000 });
    await expect(page.getByText(/no shortcuts found/i)).not.toBeVisible();
  });

  test('dark mode is active by default', async ({ page }) => {
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('theme toggle switches between dark and light mode', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);

    await page.getByRole('button', { name: /toggle theme/i }).click();
    await expect(html).not.toHaveClass(/dark/);

    await page.getByRole('button', { name: /toggle theme/i }).click();
    await expect(html).toHaveClass(/dark/);
  });

  test('category tiles link to /categories/[slug]', async ({ page }) => {
    const tiles = page.locator('a[href^="/categories/"]');
    const count = await tiles.count();
    if (count === 0) return; // API unavailable — skip

    const href = await tiles.first().getAttribute('href');
    expect(href).toMatch(/^\/categories\/.+/);
  });

  test('no horizontal overflow at 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(320);
  });
});
