import { test, expect } from '@playwright/test';

test.describe('Download page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/download');
  });

  test('renders the page heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /keyboard command center/i }),
    ).toBeVisible();
  });

  test('primary download button is present and has a valid href', async ({ page }) => {
    // Primary button (rendered as <a>) should link to a GitHub release asset
    const primaryLink = page
      .locator('a[href*="releases/latest/download"]')
      .first();
    await expect(primaryLink).toBeVisible();
    const href = await primaryLink.getAttribute('href');
    expect(href).toMatch(/github\.com\/ForceZac\/KeyboardCommandCenter\/releases\/latest\/download\//);
  });

  test('macOS download link is present', async ({ page }) => {
    const macLink = page.locator('a[href*="KeyboardCommandCenter.dmg"]');
    await expect(macLink.first()).toBeVisible();
  });

  test('Windows x64 download link is present', async ({ page }) => {
    const winLink = page.locator('a[href*="KeyboardCommandCenter-Setup.exe"]');
    await expect(winLink.first()).toBeVisible();
  });

  test('Windows ARM64 download link is present', async ({ page }) => {
    const winArmLink = page.locator('a[href*="KeyboardCommandCenter-Setup-arm64.exe"]');
    await expect(winArmLink.first()).toBeVisible();
  });

  test('system requirements section is present', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /system requirements/i }),
    ).toBeVisible();
  });

  test('all platforms section is visible', async ({ page }) => {
    await expect(page.getByText(/all platforms/i)).toBeVisible();
  });

  test('no horizontal overflow at 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/download');
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(320);
  });

  test('link back to homepage works', async ({ page }) => {
    await page.getByRole('link', { name: /search the database/i }).click();
    await expect(page).toHaveURL('/');
  });

  // Regression: nav header still renders on download page
  test('site navigation header is present', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: /keyboard command center/i }).first(),
    ).toBeVisible();
  });
});
