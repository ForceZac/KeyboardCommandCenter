import { test, expect } from '@playwright/test';

/**
 * Admin Review Queue E2E tests — TASK-0029.
 *
 * Tests the /admin/review route protection and UI.
 * The authenticated test user (test-user-id) is NOT an admin by default,
 * so tests verify the 403 page is shown. Admin-specific API tests are
 * covered by Vitest mocks in __tests__/api/admin-submissions.test.ts.
 */

// ── Unauthenticated ───────────────────────────────────────────────────────────

test.describe('Admin review queue — unauthenticated', () => {
  test('redirects unauthenticated user away from /admin/review', async ({ page }) => {
    await page.goto('/admin/review');
    // Admin layout redirects to / when no session
    await page.waitForURL('/', { timeout: 8000 });
    await expect(page).toHaveURL('/');
  });

  test('GET /api/admin/submissions returns 401 for unauthenticated request', async ({
    request,
  }) => {
    const res = await request.get('/api/admin/submissions');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Unauthorized');
  });

  test('PATCH /api/admin/submissions/:id returns 401 for unauthenticated request', async ({
    request,
  }) => {
    const res = await request.patch('/api/admin/submissions/fake-id', {
      data: { action: 'approve' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Unauthorized');
  });
});

// ── Authenticated (non-admin) ─────────────────────────────────────────────────

test.describe('Admin review queue — authenticated non-admin', () => {
  test.use({ storageState: 'e2e/fixtures/authenticated.json' });

  test('shows 403 Forbidden page for non-admin user', async ({ page }) => {
    await page.goto('/admin/review');
    await expect(page.getByText('403')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/forbidden/i)).toBeVisible();
    await expect(page.getByText(/do not have admin access/i)).toBeVisible();
  });

  test('GET /api/admin/submissions returns 403 for non-admin user', async ({
    request,
  }) => {
    const res = await request.get('/api/admin/submissions');
    // Non-admin user should get 403
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Forbidden');
  });

  test('PATCH /api/admin/submissions/:id returns 403 for non-admin user', async ({
    request,
  }) => {
    const res = await request.patch('/api/admin/submissions/fake-id', {
      data: { action: 'approve' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Forbidden');
  });
});
