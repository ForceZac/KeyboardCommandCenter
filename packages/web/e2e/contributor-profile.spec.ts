import { test, expect } from '@playwright/test';

// ── Public profile page tests ───────────────────────────────────────────────

test.describe('Contributor Profile — unauthenticated', () => {
  test('profile API returns 404 for non-existent user', async ({ request }) => {
    const res = await request.get('/api/users/nonexistent-user-id/profile');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'User not found');
  });

  test('profile page renders "User not found" for non-existent user', async ({ page }) => {
    await page.goto('/profile/nonexistent-user-id');
    await expect(page.getByText('User not found')).toBeVisible();
  });

  test('profile page is publicly accessible without auth', async ({ page }) => {
    await page.goto('/profile/test-user-id');
    // Should not redirect to sign-in — profile pages are public
    expect(page.url()).toContain('/profile/test-user-id');
  });
});

// ── Authenticated profile tests ─────────────────────────────────────────────

test.describe('Contributor Profile — authenticated', () => {
  test.use({ storageState: 'e2e/fixtures/authenticated.json' });

  test('profile page loads for the authenticated test user', async ({ page }) => {
    await page.goto('/profile/test-user-id');
    // The test user is "Test User" from auth-setup.ts
    await expect(page.getByRole('heading', { name: /test user/i })).toBeVisible();
    await expect(page.getByText(/member since/i)).toBeVisible();
  });

  test('profile page shows stats cards', async ({ page }) => {
    await page.goto('/profile/test-user-id');
    await expect(page.getByText('Submitted')).toBeVisible();
    await expect(page.getByText('Accepted')).toBeVisible();
    await expect(page.getByText('Acceptance Rate')).toBeVisible();
  });

  test('profile page shows accepted contributions section', async ({ page }) => {
    await page.goto('/profile/test-user-id');
    await expect(page.getByRole('heading', { name: /accepted contributions/i })).toBeVisible();
  });

  test('My Profile link appears in UserMenu dropdown', async ({ page }) => {
    await page.goto('/');
    const menuButton = page.getByRole('button', { name: /user menu for test user/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    const profileLink = page.getByRole('link', { name: /my profile/i });
    await expect(profileLink).toBeVisible();
    await expect(profileLink).toHaveAttribute('href', '/profile/test-user-id');
  });

  test('My Profile link navigates to the correct profile page', async ({ page }) => {
    await page.goto('/');
    const menuButton = page.getByRole('button', { name: /user menu for test user/i });
    await menuButton.click();
    await page.getByRole('link', { name: /my profile/i }).click();
    await page.waitForURL('/profile/test-user-id');
    await expect(page.getByRole('heading', { name: /test user/i })).toBeVisible();
  });

  test('profile API returns correct shape for existing user', async ({ request }) => {
    const res = await request.get('/api/users/test-user-id/profile');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
    expect(body).toHaveProperty('stats');
    expect(body).toHaveProperty('acceptedContributions');
    expect(body.user).toHaveProperty('id', 'test-user-id');
    expect(body.user).toHaveProperty('name');
    expect(body.user).toHaveProperty('memberSince');
    expect(body.stats).toHaveProperty('totalSubmitted');
    expect(body.stats).toHaveProperty('totalAccepted');
    expect(body.stats).toHaveProperty('acceptanceRate');
    expect(Array.isArray(body.acceptedContributions)).toBe(true);
  });
});
