import { execSync } from 'child_process';
import path from 'path';

/**
 * Global Vitest setup — runs once before any test file.
 *
 * Applies Prisma migrations and seeds the test database so integration tests
 * have a stable dataset to query.
 *
 * Requires:
 *   - DATABASE_URL env var pointing to a running test PostgreSQL instance
 *   - Docker Compose postgres container running (see docker-compose.yml at repo root)
 */
export async function setup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required for integration tests. ' +
      'Run: docker compose up -d  then set DATABASE_URL in your env.'
    );
  }

  const dbRoot = path.resolve(__dirname, '../../../../database');

  console.log('[test setup] Applying Prisma migrations...');
  execSync('npx prisma migrate deploy', {
    cwd: dbRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  console.log('[test setup] Seeding test database...');
  execSync('npx ts-node seeds/seed.ts', {
    cwd: dbRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  console.log('[test setup] Database ready.');
}
