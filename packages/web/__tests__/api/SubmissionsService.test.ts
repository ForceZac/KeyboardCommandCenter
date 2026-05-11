/**
 * SubmissionsService integration tests.
 *
 * Uses a real Prisma client against the test database (requires Docker Compose
 * postgres — see __tests__/setup/globalSetup.ts). Tests will fail on DB
 * connection if Docker is not running; this is expected in environments
 * without a live database.
 *
 * Covers:
 *   - Rate limit boundary (19 → succeeds, 20 → throws RateLimitError)
 *   - Duplicate detection (matching keyCombo → DuplicateSubmissionError)
 *   - approve() for CORRECTION: updates existing Shortcut row
 *   - approve() for APP_REQUEST: inserts new Application row
 *   - approve() status guard: throws on non-PENDING submission
 *   - approve() APP_REQUEST with invalid categoryId: throws (maps to 400)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../../lib/prisma';
import { SubmissionsService } from '../../services/SubmissionsService';
import { RateLimitError, DuplicateSubmissionError } from '../../lib/errors';

const service = new SubmissionsService();

// ─── Shared test fixtures ──────────────────────────────────────────────────────

const TEST_USER_ID = 'svc-test-user-001';
const TEST_ADMIN_ID = 'svc-test-admin-001';
const TEST_CATEGORY_ID = 'svc-test-cat-001';
const TEST_APP_ID = 'svc-test-app-001';
const TEST_PLATFORM_ID = 'svc-test-plat-001';
const TEST_SHORTCUT_ID = 'svc-test-shortcut-001';

async function seedFixtures() {
  // Upsert to avoid failures if a prior test left data
  await prisma.category.upsert({
    where: { id: TEST_CATEGORY_ID },
    create: { id: TEST_CATEGORY_ID, name: 'SvcTest Category', slug: 'svctest-category' },
    update: {},
  });
  await prisma.platform.upsert({
    where: { id: TEST_PLATFORM_ID },
    create: { id: TEST_PLATFORM_ID, name: 'SvcTest Platform', slug: 'svctest-platform' },
    update: {},
  });
  await prisma.application.upsert({
    where: { id: TEST_APP_ID },
    create: {
      id: TEST_APP_ID,
      name: 'SvcTest App',
      slug: 'svctest-app',
      categoryId: TEST_CATEGORY_ID,
    },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: {
      id: TEST_USER_ID,
      email: 'svctest-user@test.example',
      isAdmin: false,
    },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: TEST_ADMIN_ID },
    create: {
      id: TEST_ADMIN_ID,
      email: 'svctest-admin@test.example',
      isAdmin: true,
    },
    update: {},
  });
  await prisma.shortcut.upsert({
    where: { id: TEST_SHORTCUT_ID },
    create: {
      id: TEST_SHORTCUT_ID,
      applicationId: TEST_APP_ID,
      command: 'SvcTest Save File',
      context: 'Global',
    },
    update: {},
  });
  // Seed a binding + step so CORRECTION approve can update it
  const existingBinding = await prisma.shortcutKeyBinding.findUnique({
    where: { shortcutId_platformId: { shortcutId: TEST_SHORTCUT_ID, platformId: TEST_PLATFORM_ID } },
  });
  if (!existingBinding) {
    const binding = await prisma.shortcutKeyBinding.create({
      data: {
        shortcutId: TEST_SHORTCUT_ID,
        platformId: TEST_PLATFORM_ID,
      },
    });
    await prisma.shortcutKeyStep.create({
      data: {
        bindingId: binding.id,
        stepOrder: 1,
        keyCombo: 'Ctrl+S',
        key: 's',
        modifiers: ['Ctrl'],
      },
    });
  }
}

async function teardownFixtures() {
  // Delete submissions and derived data created during tests
  await prisma.submission.deleteMany({ where: { submitterId: TEST_USER_ID } });
  await prisma.submission.deleteMany({ where: { submitterId: TEST_ADMIN_ID } });
  // Delete any applications created by APP_REQUEST approve tests
  await prisma.application.deleteMany({
    where: { slug: { startsWith: 'svctest-requested-' } },
  });
}

// ─── Rate limit ────────────────────────────────────────────────────────────────

describe('SubmissionsService.create — rate limit', () => {
  beforeEach(seedFixtures);
  afterEach(teardownFixtures);

  it('allows submission when user has 19 submissions today', async () => {
    // Seed 19 existing submissions for today
    const startOfDayUTC = new Date();
    startOfDayUTC.setUTCHours(0, 0, 0, 0);

    const existing = Array.from({ length: 19 }, (_, i) => ({
      id: `svc-rate-existing-${i}`,
      type: 'NEW_SHORTCUT' as const,
      status: 'PENDING' as const,
      submitterId: TEST_USER_ID,
      appId: TEST_APP_ID,
      shortcutId: null,
      data: { command: `Rate Cmd ${i}`, platformId: TEST_PLATFORM_ID, keyCombo: `Ctrl+${i}`, key: `${i}`, modifiers: ['Ctrl'] },
      createdAt: new Date(startOfDayUTC.getTime() + i * 1000),
      updatedAt: new Date(startOfDayUTC.getTime() + i * 1000),
    }));
    await prisma.submission.createMany({ data: existing });

    // The 20th submission should succeed
    const result = await service.create(TEST_USER_ID, {
      type: 'NEW_SHORTCUT',
      appId: TEST_APP_ID,
      data: { command: 'New Cmd', platformId: TEST_PLATFORM_ID, keyCombo: 'Ctrl+Z', key: 'z', modifiers: ['Ctrl'] },
    });

    expect(result.status).toBe('PENDING');
    expect(result.submitterId).toBe(TEST_USER_ID);

    // Cleanup seeded rate-limit rows
    await prisma.submission.deleteMany({ where: { id: { startsWith: 'svc-rate-existing-' } } });
  });

  it('throws RateLimitError when user has 20 submissions today', async () => {
    const startOfDayUTC = new Date();
    startOfDayUTC.setUTCHours(0, 0, 0, 0);

    const existing = Array.from({ length: 20 }, (_, i) => ({
      id: `svc-rate-full-${i}`,
      type: 'NEW_SHORTCUT' as const,
      status: 'PENDING' as const,
      submitterId: TEST_USER_ID,
      appId: TEST_APP_ID,
      shortcutId: null,
      data: { command: `Full Cmd ${i}`, platformId: TEST_PLATFORM_ID, keyCombo: `Ctrl+F${i}`, key: `f${i}`, modifiers: ['Ctrl'] },
      createdAt: new Date(startOfDayUTC.getTime() + i * 1000),
      updatedAt: new Date(startOfDayUTC.getTime() + i * 1000),
    }));
    await prisma.submission.createMany({ data: existing });

    await expect(
      service.create(TEST_USER_ID, {
        type: 'NEW_SHORTCUT',
        appId: TEST_APP_ID,
        data: { command: 'Extra Cmd', platformId: TEST_PLATFORM_ID, keyCombo: 'Ctrl+E', key: 'e', modifiers: ['Ctrl'] },
      }),
    ).rejects.toThrow(RateLimitError);

    await prisma.submission.deleteMany({ where: { id: { startsWith: 'svc-rate-full-' } } });
  });
});

// ─── Duplicate detection ──────────────────────────────────────────────────────

describe('SubmissionsService.create — duplicate detection', () => {
  beforeEach(seedFixtures);
  afterEach(teardownFixtures);

  it('throws DuplicateSubmissionError for exact keyCombo match on same app + platform', async () => {
    // 'Ctrl+S' is already seeded for TEST_APP_ID + TEST_PLATFORM_ID via the shortcut fixture
    await expect(
      service.create(TEST_USER_ID, {
        type: 'NEW_SHORTCUT',
        appId: TEST_APP_ID,
        data: { command: 'Duplicate Cmd', platformId: TEST_PLATFORM_ID, keyCombo: 'Ctrl+S', key: 's', modifiers: ['Ctrl'] },
      }),
    ).rejects.toThrow(DuplicateSubmissionError);
  });

  it('succeeds for a different keyCombo on the same app + platform', async () => {
    const result = await service.create(TEST_USER_ID, {
      type: 'NEW_SHORTCUT',
      appId: TEST_APP_ID,
      data: { command: 'Unique Cmd', platformId: TEST_PLATFORM_ID, keyCombo: 'Ctrl+Q', key: 'q', modifiers: ['Ctrl'] },
    });
    expect(result.status).toBe('PENDING');
  });
});

// ─── approve() — CORRECTION ───────────────────────────────────────────────────

describe('SubmissionsService.approve — CORRECTION', () => {
  beforeEach(seedFixtures);
  afterEach(teardownFixtures);

  it('updates the existing Shortcut command when approved', async () => {
    const submission = await prisma.submission.create({
      data: {
        type: 'CORRECTION',
        status: 'PENDING',
        submitterId: TEST_USER_ID,
        appId: TEST_APP_ID,
        shortcutId: TEST_SHORTCUT_ID,
        data: { command: 'Save File (corrected)', platformId: TEST_PLATFORM_ID, keyCombo: 'Ctrl+S', key: 's', modifiers: ['Ctrl'] },
      },
    });

    await service.approve(TEST_ADMIN_ID, submission.id);

    const updated = await prisma.shortcut.findUnique({ where: { id: TEST_SHORTCUT_ID } });
    expect(updated?.command).toBe('Save File (corrected)');
  });

  it('updates the ShortcutKeyStep keyCombo when provided', async () => {
    const submission = await prisma.submission.create({
      data: {
        type: 'CORRECTION',
        status: 'PENDING',
        submitterId: TEST_USER_ID,
        appId: TEST_APP_ID,
        shortcutId: TEST_SHORTCUT_ID,
        data: { platformId: TEST_PLATFORM_ID, keyCombo: 'Ctrl+Shift+S', key: 's', modifiers: ['Ctrl', 'Shift'] },
      },
    });

    await service.approve(TEST_ADMIN_ID, submission.id);

    const binding = await prisma.shortcutKeyBinding.findUnique({
      where: { shortcutId_platformId: { shortcutId: TEST_SHORTCUT_ID, platformId: TEST_PLATFORM_ID } },
      include: { steps: { where: { stepOrder: 1 } } },
    });
    expect(binding?.steps[0]?.keyCombo).toBe('Ctrl+Shift+S');
  });
});

// ─── approve() — APP_REQUEST ──────────────────────────────────────────────────

describe('SubmissionsService.approve — APP_REQUEST', () => {
  beforeEach(seedFixtures);
  afterEach(teardownFixtures);

  it('inserts a new Application row when approved', async () => {
    const slug = 'svctest-requested-new-app';
    const submission = await prisma.submission.create({
      data: {
        type: 'APP_REQUEST',
        status: 'PENDING',
        submitterId: TEST_USER_ID,
        appId: null,
        data: { appName: 'SvcTest Requested App', slug, categoryId: TEST_CATEGORY_ID },
      },
    });

    await service.approve(TEST_ADMIN_ID, submission.id);

    const created = await prisma.application.findUnique({ where: { slug } });
    expect(created).not.toBeNull();
    expect(created?.name).toBe('SvcTest Requested App');
    expect(created?.categoryId).toBe(TEST_CATEGORY_ID);

    // Cleanup: deleteMany in teardown handles svctest-requested-* slugs
  });

  it('throws when categoryId does not exist', async () => {
    const submission = await prisma.submission.create({
      data: {
        type: 'APP_REQUEST',
        status: 'PENDING',
        submitterId: TEST_USER_ID,
        appId: null,
        data: { appName: 'Bad Cat App', slug: 'svctest-requested-bad-cat', categoryId: 'nonexistent-cat-id' },
      },
    });

    await expect(service.approve(TEST_ADMIN_ID, submission.id)).rejects.toThrow('Category not found');
  });
});

// ─── approve() — status guard ─────────────────────────────────────────────────

describe('SubmissionsService.approve — status guard', () => {
  beforeEach(seedFixtures);
  afterEach(teardownFixtures);

  it('throws when approving an already-APPROVED submission', async () => {
    const submission = await prisma.submission.create({
      data: {
        type: 'NEW_SHORTCUT',
        status: 'APPROVED',
        submitterId: TEST_USER_ID,
        appId: TEST_APP_ID,
        data: { command: 'Already Done', platformId: TEST_PLATFORM_ID, keyCombo: 'Ctrl+D', key: 'd', modifiers: ['Ctrl'] },
      },
    });

    await expect(service.approve(TEST_ADMIN_ID, submission.id)).rejects.toThrow(
      'Submission is not in PENDING status',
    );
  });

  it('throws when approving a REJECTED submission', async () => {
    const submission = await prisma.submission.create({
      data: {
        type: 'NEW_SHORTCUT',
        status: 'REJECTED',
        submitterId: TEST_USER_ID,
        appId: TEST_APP_ID,
        data: { command: 'Rejected Cmd', platformId: TEST_PLATFORM_ID, keyCombo: 'Ctrl+R', key: 'r', modifiers: ['Ctrl'] },
      },
    });

    await expect(service.approve(TEST_ADMIN_ID, submission.id)).rejects.toThrow(
      'Submission is not in PENDING status',
    );
  });
});
