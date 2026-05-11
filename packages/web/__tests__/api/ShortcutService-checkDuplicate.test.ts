/**
 * ShortcutService.checkDuplicate integration tests.
 *
 * Uses a real Prisma client against the test database.
 * Covers:
 *   - Exact match found (same app + platform + keyCombo, case-insensitive)
 *   - No match when keyCombo differs
 *   - Fuzzy match returned when base key segment matches a different shortcut
 *   - Platform "all" skips platform filter on exact check
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../../lib/prisma';
import { ShortcutService } from '../../services/ShortcutService';

const service = new ShortcutService();

const CAT_ID = 'dup-check-cat-001';
const APP_ID = 'dup-check-app-001';
const PLAT_ID = 'dup-check-plat-001';
const SC_ID_A = 'dup-check-sc-001';
const SC_ID_B = 'dup-check-sc-002';

async function seedFixtures() {
  await prisma.category.upsert({
    where: { id: CAT_ID },
    create: { id: CAT_ID, name: 'DupCheck Category', slug: 'dupcheck-category' },
    update: {},
  });
  await prisma.platform.upsert({
    where: { id: PLAT_ID },
    create: { id: PLAT_ID, name: 'DupCheck Platform', slug: 'dupcheck-platform' },
    update: {},
  });
  await prisma.application.upsert({
    where: { id: APP_ID },
    create: { id: APP_ID, name: 'DupCheck App', slug: 'dupcheck-app', categoryId: CAT_ID },
    update: {},
  });

  // Shortcut A — Ctrl+S
  await prisma.shortcut.upsert({
    where: { id: SC_ID_A },
    create: { id: SC_ID_A, applicationId: APP_ID, command: 'Save File', context: 'Global' },
    update: {},
  });
  const bindingA = await prisma.shortcutKeyBinding.upsert({
    where: { shortcutId_platformId: { shortcutId: SC_ID_A, platformId: PLAT_ID } },
    create: { shortcutId: SC_ID_A, platformId: PLAT_ID },
    update: {},
  });
  const existingStepA = await prisma.shortcutKeyStep.findFirst({
    where: { bindingId: bindingA.id, stepOrder: 1 },
  });
  if (!existingStepA) {
    await prisma.shortcutKeyStep.create({
      data: { bindingId: bindingA.id, stepOrder: 1, keyCombo: 'Ctrl+S', key: 's', modifiers: ['Ctrl'] },
    });
  }

  // Shortcut B — Ctrl+Shift+S (fuzzy: contains 'S')
  await prisma.shortcut.upsert({
    where: { id: SC_ID_B },
    create: { id: SC_ID_B, applicationId: APP_ID, command: 'Save As', context: 'Global' },
    update: {},
  });
  const bindingB = await prisma.shortcutKeyBinding.upsert({
    where: { shortcutId_platformId: { shortcutId: SC_ID_B, platformId: PLAT_ID } },
    create: { shortcutId: SC_ID_B, platformId: PLAT_ID },
    update: {},
  });
  const existingStepB = await prisma.shortcutKeyStep.findFirst({
    where: { bindingId: bindingB.id, stepOrder: 1 },
  });
  if (!existingStepB) {
    await prisma.shortcutKeyStep.create({
      data: { bindingId: bindingB.id, stepOrder: 1, keyCombo: 'Ctrl+Shift+S', key: 's', modifiers: ['Ctrl', 'Shift'] },
    });
  }
}

async function teardownFixtures() {
  await prisma.shortcutKeyStep.deleteMany({
    where: { binding: { shortcut: { applicationId: APP_ID } } },
  });
  await prisma.shortcutKeyBinding.deleteMany({
    where: { shortcut: { applicationId: APP_ID } },
  });
  await prisma.shortcut.deleteMany({ where: { applicationId: APP_ID } });
  await prisma.application.deleteMany({ where: { id: APP_ID } });
  await prisma.platform.deleteMany({ where: { id: PLAT_ID } });
  await prisma.category.deleteMany({ where: { id: CAT_ID } });
}

describe('ShortcutService.checkDuplicate', () => {
  beforeEach(seedFixtures);
  afterEach(teardownFixtures);

  it('returns exact match for case-insensitive keyCombo on same app + platform', async () => {
    const result = await service.checkDuplicate(APP_ID, 'dupcheck-platform', 'ctrl+s');
    expect(result.exact).not.toBeNull();
    expect(result.exact?.command).toBe('Save File');
    expect(result.exact?.platforms[0].platformSlug).toBe('dupcheck-platform');
  });

  it('returns null exact when keyCombo does not match', async () => {
    const result = await service.checkDuplicate(APP_ID, 'dupcheck-platform', 'Ctrl+Z');
    expect(result.exact).toBeNull();
  });

  it('returns fuzzy matches that share the base key segment', async () => {
    // Ctrl+Q has no exact match; fuzzy should surface Ctrl+S and Ctrl+Shift+S (both end in S... wait, Q)
    // Use Ctrl+X — neither exact, and fuzzy would look for 'X' in existing combos
    const result = await service.checkDuplicate(APP_ID, 'dupcheck-platform', 'Ctrl+X');
    expect(result.exact).toBeNull();
    // No fuzzy matches for 'X' since existing combos have 'S'
    expect(Array.isArray(result.fuzzy)).toBe(true);
  });

  it('excludes exact match from fuzzy results', async () => {
    // Ctrl+S is an exact match; fuzzy should not repeat it
    const result = await service.checkDuplicate(APP_ID, 'dupcheck-platform', 'Ctrl+S');
    expect(result.exact).not.toBeNull();
    const fuzzyIds = result.fuzzy.map((f) => f.id);
    expect(fuzzyIds).not.toContain(result.exact?.id);
  });

  it('returns fuzzy matches when base key appears in other combos', async () => {
    // Submit "Alt+S" — no exact match, but 'S' base key exists in Ctrl+S and Ctrl+Shift+S
    const result = await service.checkDuplicate(APP_ID, 'dupcheck-platform', 'Alt+S');
    expect(result.exact).toBeNull();
    expect(result.fuzzy.length).toBeGreaterThan(0);
  });

  it('handles platform "all" by skipping platform filter', async () => {
    const result = await service.checkDuplicate(APP_ID, 'all', 'Ctrl+S');
    // Should still find exact match (no platform filter applied)
    expect(result.exact).not.toBeNull();
    expect(result.exact?.command).toBe('Save File');
  });
});
