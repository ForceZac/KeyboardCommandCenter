import { PrismaClient } from '@prisma/client';

// Next.js hot-reload creates a new module instance on every refresh in dev,
// which would exhaust the PostgreSQL connection pool. Cache the client on
// globalThis so it survives module reloads between requests.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
