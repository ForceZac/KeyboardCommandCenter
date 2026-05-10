/**
 * Verifies that the Auth.js createUser event callback creates a default
 * "My Favorites" collection for newly signed-up users.
 *
 * We capture the config passed to NextAuth() via a spy and call the
 * createUser event handler directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    collection: {
      create: vi.fn(),
    },
  },
}));
vi.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

// Capture the config object passed to NextAuth so tests can inspect events.
const { capturedConfig } = vi.hoisted(() => ({ capturedConfig: { current: null as unknown } }));
vi.mock('next-auth', () => ({
  default: vi.fn((config) => {
    capturedConfig.current = config;
    // Return the shape expected by lib/auth.ts destructuring
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  }),
}));
vi.mock('next-auth/providers/github', () => ({ default: vi.fn(() => ({ id: 'github' })) }));
vi.mock('next-auth/providers/google', () => ({ default: vi.fn(() => ({ id: 'google' })) }));
vi.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock('../../lib/env', () => ({
  env: {
    githubId: 'test-github-id',
    githubSecret: 'test-github-secret',
    googleClientId: 'test-google-id',
    googleClientSecret: 'test-google-secret',
  },
}));

// Importing auth triggers the NextAuth() call, populating capturedConfig.
import '../../lib/auth';

// ─── Tests ────────────────────────────────────────────────────────────────────

type AuthConfig = {
  events?: {
    createUser?: (args: { user: { id?: string } }) => Promise<void>;
  };
};

describe('Auth.js createUser event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a default "My Favorites" collection when a new user is created', async () => {
    const config = capturedConfig.current as AuthConfig;
    expect(config?.events?.createUser).toBeDefined();

    await config.events!.createUser!({ user: { id: 'new-user-id' } });

    expect(mockPrisma.collection.create).toHaveBeenCalledOnce();
    expect(mockPrisma.collection.create).toHaveBeenCalledWith({
      data: {
        userId: 'new-user-id',
        name: 'My Favorites',
        isDefault: true,
      },
    });
  });

  it('does nothing when user.id is undefined', async () => {
    const config = capturedConfig.current as AuthConfig;

    await config.events!.createUser!({ user: {} });

    expect(mockPrisma.collection.create).not.toHaveBeenCalled();
  });
});
