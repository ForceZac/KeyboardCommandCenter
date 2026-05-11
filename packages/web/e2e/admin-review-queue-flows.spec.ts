import { test, expect } from '@playwright/test';
import type { IAdminSubmission, AdminSubmissionsResponse } from '@kcc/core';

/**
 * Admin Review Queue — positive-flow E2E tests (TASK-0029).
 *
 * Requires:
 *   - Running dev server with seeded database
 *   - admin-test-id user with isAdmin=true (seeded by auth-setup.ts)
 *
 * Uses page.route() to mock /api/admin/submissions responses so tests
 * have controlled data without depending on real pending submissions.
 */

const MOCK_SUBMISSIONS: IAdminSubmission[] = [
  {
    id: 'sub-e2e-001',
    type: 'NEW_SHORTCUT',
    status: 'PENDING',
    submitterId: 'user-e2e-001',
    appId: 'app-e2e-001',
    shortcutId: null,
    data: { command: 'Save File', keyCombo: 'Ctrl+S', key: 's', modifiers: ['Ctrl'], platformId: 'plat-001' },
    reviewerNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-05-10T06:00:00Z',
    updatedAt: '2026-05-10T06:00:00Z',
    submitterName: 'Jane Doe',
    submitterImage: null,
    appName: 'VS Code',
    appSlug: 'vs-code',
    originalShortcut: null,
  },
  {
    id: 'sub-e2e-002',
    type: 'CORRECTION',
    status: 'PENDING',
    submitterId: 'user-e2e-002',
    appId: 'app-e2e-002',
    shortcutId: 'sc-e2e-001',
    data: { command: 'Paste Special', keyCombo: 'Ctrl+Shift+V', key: 'v', modifiers: ['Ctrl', 'Shift'], platformId: 'plat-001' },
    reviewerNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-05-10T07:00:00Z',
    updatedAt: '2026-05-10T07:00:00Z',
    submitterName: 'John Smith',
    submitterImage: null,
    appName: 'Chrome',
    appSlug: 'chrome',
    originalShortcut: { command: 'Paste', keyCombo: 'Ctrl+V', context: null, platform: 'windows' },
  },
];

function makeMockResponse(submissions: IAdminSubmission[]): AdminSubmissionsResponse {
  return { submissions, totalPending: submissions.length };
}

test.describe('Admin review queue — admin positive flows', () => {
  test.use({ storageState: 'e2e/fixtures/admin-authenticated.json' });

  test('admin sees submission cards with type badges', async ({ page }) => {
    await page.route('**/api/admin/submissions**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeMockResponse(MOCK_SUBMISSIONS)),
      }),
    );

    await page.goto('/admin/review');

    const cards = page.locator('[data-testid="submission-card"]');
    await expect(cards).toHaveCount(2, { timeout: 8000 });

    await expect(page.getByText('New Shortcut')).toBeVisible();
    await expect(page.getByText('Correction')).toBeVisible();
    await expect(page.getByText('Jane Doe')).toBeVisible();
    await expect(page.getByText('John Smith')).toBeVisible();
    await expect(page.getByText('VS Code')).toBeVisible();
    await expect(page.getByText('Chrome')).toBeVisible();
  });

  test('approve action removes a card from the queue', async ({ page }) => {
    let currentSubmissions = [...MOCK_SUBMISSIONS];

    await page.route('**/api/admin/submissions**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeMockResponse(currentSubmissions)),
        });
      }
      return route.continue();
    });

    await page.route('**/api/admin/submissions/sub-e2e-001', (route) => {
      if (route.request().method() === 'PATCH') {
        currentSubmissions = currentSubmissions.filter((s) => s.id !== 'sub-e2e-001');
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_SUBMISSIONS[0], status: 'APPROVED' }),
        });
      }
      return route.continue();
    });

    await page.goto('/admin/review');

    const cards = page.locator('[data-testid="submission-card"]');
    await expect(cards).toHaveCount(2, { timeout: 8000 });

    const approveBtn = page.locator('[data-testid="approve-btn"]').first();
    await approveBtn.click();

    await expect(cards).toHaveCount(1, { timeout: 5000 });
  });

  test('empty state shown when queue is clear', async ({ page }) => {
    await page.route('**/api/admin/submissions**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeMockResponse([])),
      }),
    );

    await page.goto('/admin/review');

    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/queue is clear/i)).toBeVisible();
  });

  test('correction submission shows diff view', async ({ page }) => {
    const correctionOnly = [MOCK_SUBMISSIONS[1]];

    await page.route('**/api/admin/submissions**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeMockResponse(correctionOnly)),
      }),
    );

    await page.goto('/admin/review');

    await expect(page.getByText('Original')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Proposed')).toBeVisible();
    await expect(page.getByText('Paste')).toBeVisible();
    await expect(page.getByText('Paste Special')).toBeVisible();
  });
});
