/**
 * Integration tests for TASK-0002: Seed Script & Data for 50+ Applications
 *
 * Prerequisites:
 *   1. TASK-0001 (goals/1-prisma-schema) must be merged to main
 *   2. PostgreSQL must be running with DATABASE_URL set
 *   3. Run `prisma migrate deploy` (applies both migrations) before running tests
 *   4. Run `npm run seed -w database` to populate data
 *
 * These tests verify the acceptance criteria from backlog.md TASK-0002:
 *   - Seed script completes without errors on a fresh database
 *   - 50+ applications seeded across all PRD-specified categories
 *   - Each application has at least 10 verified shortcuts
 *   - Full-text search index exists and returns results in <100ms
 *   - Script is idempotent (re-run produces same counts)
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'node:child_process'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'node:path'

const prisma = new PrismaClient()

// Helper: run a raw FTS query and return elapsed ms + row count
async function ftsBenchmark(query: string): Promise<{ count: number; ms: number }> {
  const start = performance.now()
  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT s.id
    FROM shortcuts s
    WHERE to_tsvector('english', s.command) @@ to_tsquery('english', ${query})
    LIMIT 100
  `
  const ms = performance.now() - start
  return { count: results.length, ms }
}

describe('TASK-0002: Seed data', () => {
  beforeAll(async () => {
    // Run the seed script before tests to ensure data is present.
    // This is idempotent — safe on an already-seeded database.
    const seedScript = path.resolve(__dirname, '../seeds/seed.ts')
    execSync(`npx tsx ${seedScript}`, {
      env: { ...process.env },
      stdio: 'inherit',
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('seeds 50 or more applications', async () => {
    const count = await prisma.application.count()
    expect(count).toBeGreaterThanOrEqual(50)
  })

  it('seeds all 7 PRD-specified categories', async () => {
    const categories = await prisma.category.findMany({ select: { slug: true } })
    const slugs = categories.map((c) => c.slug)
    expect(slugs).toContain('creative')
    expect(slugs).toContain('developer-tools')
    expect(slugs).toContain('productivity')
    expect(slugs).toContain('gaming')
    expect(slugs).toContain('music')
    expect(slugs).toContain('system')
    expect(slugs).toContain('browsers')
  })

  it('seeds all 3 platforms', async () => {
    const platforms = await prisma.platform.findMany({ select: { slug: true } })
    const slugs = platforms.map((p) => p.slug)
    expect(slugs).toContain('windows')
    expect(slugs).toContain('macos')
    expect(slugs).toContain('linux')
  })

  it('each application has at least 10 shortcuts', async () => {
    const apps = await prisma.application.findMany({
      include: { _count: { select: { shortcuts: true } } },
    })
    const below = apps.filter((a) => a._count.shortcuts < 10)
    if (below.length > 0) {
      const names = below.map((a) => `${a.slug} (${a._count.shortcuts})`).join(', ')
      throw new Error(`Applications with fewer than 10 shortcuts: ${names}`)
    }
    expect(below).toHaveLength(0)
  })

  it('returns FTS results for "undo" in <100ms', async () => {
    const { count, ms } = await ftsBenchmark('undo')
    expect(count).toBeGreaterThan(0)
    expect(ms).toBeLessThan(100)
  })

  it('returns FTS results for "save" in <100ms', async () => {
    const { count, ms } = await ftsBenchmark('save')
    expect(count).toBeGreaterThan(0)
    expect(ms).toBeLessThan(100)
  })

  it('is idempotent — re-running seed does not create duplicate apps', async () => {
    const countBefore = await prisma.application.count()

    // Re-run the seed
    const seedScript = path.resolve(__dirname, '../seeds/seed.ts')
    execSync(`npx tsx ${seedScript}`, {
      env: { ...process.env },
      stdio: 'pipe', // suppress output for second run
    })

    const countAfter = await prisma.application.count()
    expect(countAfter).toEqual(countBefore)
  })

  it('is idempotent — re-running seed does not create duplicate shortcuts', async () => {
    const countBefore = await prisma.shortcut.count()

    const seedScript = path.resolve(__dirname, '../seeds/seed.ts')
    execSync(`npx tsx ${seedScript}`, {
      env: { ...process.env },
      stdio: 'pipe',
    })

    const countAfter = await prisma.shortcut.count()
    expect(countAfter).toEqual(countBefore)
  })

  it('seeds applications across all categories', async () => {
    const categoryCounts = await prisma.category.findMany({
      include: { _count: { select: { applications: true } } },
    })
    for (const cat of categoryCounts) {
      expect(cat._count.applications).toBeGreaterThan(0)
    }
  })
})
