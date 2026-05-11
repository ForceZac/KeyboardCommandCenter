/**
 * ProfileService integration tests.
 *
 * Uses a real Prisma client against the test database (requires Docker Compose
 * postgres — see __tests__/setup/globalSetup.ts). Tests will fail on DB
 * connection if Docker is not running; this is expected in environments
 * without a live database.
 *
 * Covers:
 *   - getPublicProfile returns correct user info and stats
 *   - Missing user returns null
 *   - User with zero submissions returns zero stats and empty contributions list
 *   - Stats compute correctly (totalSubmitted, totalAccepted, acceptanceRate)
 *   - Accepted contributions list includes correct data
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../../lib/prisma';
import { ProfileService } from '../../services/ProfileService';

const service = new ProfileService();

const TEST_USER_ID = 'profile-test-user-001';
const TEST_CATEGORY_ID = 'profile-test-cat-001';
const TEST_APP_ID = 'profile-test-app-001';

async function seedFixtures() {
  await prisma.category.upsert({
    where: { id: TEST_CATEGORY_ID },
    create: { id: TEST_CATEGORY_ID, name: 'ProfileTest Category', slug: 'profiletest-category' },
    update: {},
  });
  await prisma.application.upsert({
    where: { id: TEST_APP_ID },
    create: {
      id: TEST_APP_ID,
      name: 'ProfileTest App',
      slug: 'profiletest-app',
      categoryId: TEST_CATEGORY_ID,
    },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: {
      id: TEST_USER_ID,
      email: 'profiletest-user@test.example',
      name: 'Profile Tester',
      isAdmin: false,
    },
    update: {},
  });
}

async function cleanFixtures() {
  await prisma.submission.deleteMany({ where: { submitterId: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  await prisma.application.deleteMany({ where: { id: TEST_APP_ID } });
  await prisma.category.deleteMany({ where: { id: TEST_CATEGORY_ID } });
}

describe('ProfileService', () => {
  beforeEach(async () => {
    await cleanFixtures();
    await seedFixtures();
  });

  afterEach(async () => {
    await cleanFixtures();
  });

  it('returns null for a non-existent user', async () => {
    const result = await service.getPublicProfile('nonexistent-user-id');
    expect(result).toBeNull();
  });

  it('returns profile with zero stats for user with no submissions', async () => {
    const profile = await service.getPublicProfile(TEST_USER_ID);
    expect(profile).not.toBeNull();
    expect(profile!.user.id).toBe(TEST_USER_ID);
    expect(profile!.user.name).toBe('Profile Tester');
    expect(profile!.user.memberSince).toBeTruthy();
    expect(profile!.stats.totalSubmitted).toBe(0);
    expect(profile!.stats.totalAccepted).toBe(0);
    expect(profile!.stats.acceptanceRate).toBe(0);
    expect(profile!.acceptedContributions).toHaveLength(0);
  });

  it('computes correct stats with mixed submission statuses', async () => {
    const now = new Date();

    await prisma.submission.createMany({
      data: [
        {
          type: 'NEW_SHORTCUT',
          status: 'APPROVED',
          submitterId: TEST_USER_ID,
          appId: TEST_APP_ID,
          data: { command: 'Save File' },
          reviewedAt: now,
          reviewedBy: 'admin-1',
        },
        {
          type: 'NEW_SHORTCUT',
          status: 'APPROVED',
          submitterId: TEST_USER_ID,
          appId: TEST_APP_ID,
          data: { command: 'Open File' },
          reviewedAt: now,
          reviewedBy: 'admin-1',
        },
        {
          type: 'CORRECTION',
          status: 'REJECTED',
          submitterId: TEST_USER_ID,
          appId: TEST_APP_ID,
          data: { command: 'Close File' },
          reviewedAt: now,
          reviewedBy: 'admin-1',
        },
        {
          type: 'APP_REQUEST',
          status: 'PENDING',
          submitterId: TEST_USER_ID,
          appId: null,
          data: { appName: 'NewApp' },
        },
      ],
    });

    const profile = await service.getPublicProfile(TEST_USER_ID);
    expect(profile).not.toBeNull();
    expect(profile!.stats.totalSubmitted).toBe(4);
    expect(profile!.stats.totalAccepted).toBe(2);
    expect(profile!.stats.acceptanceRate).toBe(50);
  });

  it('returns accepted contributions with correct fields', async () => {
    const reviewedAt = new Date('2026-05-11T12:00:00Z');

    await prisma.submission.create({
      data: {
        type: 'NEW_SHORTCUT',
        status: 'APPROVED',
        submitterId: TEST_USER_ID,
        appId: TEST_APP_ID,
        data: { command: 'Toggle Sidebar' },
        reviewedAt,
        reviewedBy: 'admin-1',
      },
    });

    const profile = await service.getPublicProfile(TEST_USER_ID);
    expect(profile!.acceptedContributions).toHaveLength(1);

    const contrib = profile!.acceptedContributions[0];
    expect(contrib.type).toBe('NEW_SHORTCUT');
    expect(contrib.command).toBe('Toggle Sidebar');
    expect(contrib.appName).toBe('ProfileTest App');
    expect(contrib.date).toBe(reviewedAt.toISOString());
  });

  it('handles APP_REQUEST contributions correctly', async () => {
    const reviewedAt = new Date('2026-05-11T12:00:00Z');

    await prisma.submission.create({
      data: {
        type: 'APP_REQUEST',
        status: 'APPROVED',
        submitterId: TEST_USER_ID,
        appId: null,
        data: { appName: 'Requested App' },
        reviewedAt,
        reviewedBy: 'admin-1',
      },
    });

    const profile = await service.getPublicProfile(TEST_USER_ID);
    expect(profile!.acceptedContributions).toHaveLength(1);

    const contrib = profile!.acceptedContributions[0];
    expect(contrib.type).toBe('APP_REQUEST');
    expect(contrib.command).toBe('Requested App');
    expect(contrib.appName).toBe('Requested App');
  });
});
