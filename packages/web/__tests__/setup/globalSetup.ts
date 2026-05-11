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

  try {
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
  } catch (err) {
    // Database is not reachable. Mock-based tests will still run correctly
    // (they don't hit the DB). Real integration tests that need a live DB
    // will fail on their own if they lack the data — this is intentional.
    console.warn(
      '[test setup] WARNING: Could not reach database — skipping migrations and seed.',
      '\n  Start Docker Compose to run integration tests: docker compose up -d',
      '\n  Error:', (err as Error).message?.split('\n')[0],
    );
  }
}
