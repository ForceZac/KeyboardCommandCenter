/**
 * Seed script for KeyboardCommandCenter database.
 *
 * Reads static JSON files from seeds/apps/ and upserts all data via Prisma.
 * Idempotent — safe to re-run on an existing database; existing records are
 * updated, not duplicated.
 *
 * Usage:
 *   npm run seed -w database
 *   # or from the database/ directory:
 *   npx tsx seeds/seed.ts
 *
 * Requires DATABASE_URL to be set in environment (or .env at repo root).
 */

import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: 'Creative', slug: 'creative' },
  { name: 'Developer Tools', slug: 'developer-tools' },
  { name: 'Productivity', slug: 'productivity' },
  { name: 'Gaming', slug: 'gaming' },
  { name: 'Music', slug: 'music' },
  { name: 'System', slug: 'system' },
  { name: 'Browsers', slug: 'browsers' },
] as const

const PLATFORMS = [
  { name: 'Windows', slug: 'windows' },
  { name: 'macOS', slug: 'macos' },
  { name: 'Linux', slug: 'linux' },
] as const

// ---------------------------------------------------------------------------
// JSON seed file types (mirrors TRD format)
// ---------------------------------------------------------------------------

interface KeyStep {
  keyCombo: string
  key: string
  modifiers: string[]
}

interface PlatformBinding {
  steps: KeyStep[]
}

interface ShortcutSeed {
  command: string
  context?: string
  bindings: Record<string, PlatformBinding>
}

interface AppSeed {
  name: string
  slug: string
  description: string
  category: string
  shortcuts: ShortcutSeed[]
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Starting seed…')

  // --- Step 1: Upsert categories ---
  const categoryMap = new Map<string, string>() // slug → id
  for (const cat of CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: { name: cat.name, slug: cat.slug },
    })
    categoryMap.set(cat.slug, record.id)
  }
  console.log(`  Categories: ${categoryMap.size}`)

  // --- Step 2: Upsert platforms ---
  const platformMap = new Map<string, string>() // slug → id
  for (const plat of PLATFORMS) {
    const record = await prisma.platform.upsert({
      where: { slug: plat.slug },
      update: { name: plat.name },
      create: { name: plat.name, slug: plat.slug },
    })
    platformMap.set(plat.slug, record.id)
  }
  console.log(`  Platforms:  ${platformMap.size}`)

  // --- Step 3: Read all JSON app files ---
  const appsDir = path.join(__dirname, 'apps')
  const files = fs
    .readdirSync(appsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()

  let appCount = 0
  let shortcutCount = 0
  let bindingCount = 0
  let stepCount = 0

  for (const file of files) {
    const raw = fs.readFileSync(path.join(appsDir, file), 'utf-8')
    const data: AppSeed = JSON.parse(raw)

    // Validate category slug against known values
    const categoryId = categoryMap.get(data.category)
    if (!categoryId) {
      throw new Error(
        `Unknown category slug "${data.category}" in ${file}. ` +
          `Valid slugs: ${[...categoryMap.keys()].join(', ')}`
      )
    }

    // Upsert Application
    const app = await prisma.application.upsert({
      where: { slug: data.slug },
      update: { name: data.name, description: data.description },
      create: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        categoryId,
      },
    })
    appCount++

    // Upsert Shortcuts and their bindings
    for (const shortcutData of data.shortcuts) {
      // Shortcuts have no unique constraint in the schema (by design — app-scoped
      // command names may repeat across contexts). Use find-or-create.
      let shortcut = await prisma.shortcut.findFirst({
        where: {
          applicationId: app.id,
          command: shortcutData.command,
          context: shortcutData.context ?? null,
        },
      })
      if (!shortcut) {
        shortcut = await prisma.shortcut.create({
          data: {
            applicationId: app.id,
            command: shortcutData.command,
            context: shortcutData.context ?? null,
          },
        })
      }
      shortcutCount++

      // Upsert per-platform bindings
      for (const [platformSlug, bindingData] of Object.entries(shortcutData.bindings)) {
        const platformId = platformMap.get(platformSlug)
        if (!platformId) {
          throw new Error(
            `Unknown platform slug "${platformSlug}" in ${file} shortcut "${shortcutData.command}". ` +
              `Valid slugs: ${[...platformMap.keys()].join(', ')}`
          )
        }

        const binding = await prisma.shortcutKeyBinding.upsert({
          where: {
            shortcutId_platformId: {
              shortcutId: shortcut.id,
              platformId,
            },
          },
          update: {},
          create: { shortcutId: shortcut.id, platformId },
        })
        bindingCount++

        // Upsert key steps (1-based stepOrder)
        for (let i = 0; i < bindingData.steps.length; i++) {
          const step = bindingData.steps[i]
          await prisma.shortcutKeyStep.upsert({
            where: {
              bindingId_stepOrder: {
                bindingId: binding.id,
                stepOrder: i + 1,
              },
            },
            update: {
              keyCombo: step.keyCombo,
              key: step.key,
              modifiers: step.modifiers,
            },
            create: {
              bindingId: binding.id,
              stepOrder: i + 1,
              keyCombo: step.keyCombo,
              key: step.key,
              modifiers: step.modifiers,
            },
          })
          stepCount++
        }
      }
    }

    process.stdout.write(`  ✓ ${data.name}\n`)
  }

  console.log('\n✅ Seed complete:')
  console.log(`   Apps:      ${appCount}`)
  console.log(`   Shortcuts: ${shortcutCount}`)
  console.log(`   Bindings:  ${bindingCount}`)
  console.log(`   Steps:     ${stepCount}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
