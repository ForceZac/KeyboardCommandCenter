import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock('../../lib/auth', () => ({ auth: mockAuth }));

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    collection: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    collectionShortcut: {
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET, POST } from '../../app/api/favorites/route';
import { DELETE } from '../../app/api/favorites/[shortcutId]/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';
const SESSION = { user: { id: USER_ID, email: 'test@example.com' } };
const SHORTCUT_ID = 'shortcut-xyz';
const COLLECTION_ID = 'coll-001';

const mockCollection = {
  id: COLLECTION_ID,
  userId: USER_ID,
  name: 'My Favorites',
  isDefault: true,
  description: null,
  createdAt: new Date('2026-05-10T12:00:00Z'),
  updatedAt: new Date('2026-05-10T12:00:00Z'),
};

function makeGETRequest(): NextRequest {
  return new NextRequest('http://localhost/api/favorites');
}

function makePOSTRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/favorites', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function makeDELETERequest(shortcutId: string): NextRequest {
  return new NextRequest(`http://localhost/api/favorites/${shortcutId}`, {
    method: 'DELETE',
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with an empty array when no favorites exist', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns 200 with favorites list when favorites exist', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockCollection);
    mockPrisma.collectionShortcut.findMany.mockResolvedValue([
      {
        id: 'cs-1',
        collectionId: COLLECTION_ID,
        shortcutId: SHORTCUT_ID,
        userId: USER_ID,
        createdAt: new Date('2026-05-10T12:00:00Z'),
        shortcut: {
          id: SHORTCUT_ID,
          command: 'Save File',
          context: 'Global',
          application: { name: 'VS Code', slug: 'vs-code' },
        },
      },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      shortcutId: SHORTCUT_ID,
      collectionId: COLLECTION_ID,
      shortcut: { command: 'Save File', appSlug: 'vs-code' },
    });
  });
});

describe('POST /api/favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makePOSTRequest({ shortcutId: SHORTCUT_ID }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when shortcutId is missing', async () => {
    const res = await POST(makePOSTRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 201 when shortcut is added successfully', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockCollection);
    mockPrisma.collectionShortcut.count.mockResolvedValue(5);
    mockPrisma.collectionShortcut.upsert.mockResolvedValue({});
    const res = await POST(makePOSTRequest({ shortcutId: SHORTCUT_ID }));
    expect(res.status).toBe(201);
  });

  it('returns 403 when favorites limit is reached', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockCollection);
    mockPrisma.collectionShortcut.count.mockResolvedValue(1000);
    const res = await POST(makePOSTRequest({ shortcutId: SHORTCUT_ID }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/limit/i);
  });
});

describe('DELETE /api/favorites/:shortcutId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(makeDELETERequest(SHORTCUT_ID), {
      params: Promise.resolve({ shortcutId: SHORTCUT_ID }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 204 when favorite is removed successfully', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockCollection);
    mockPrisma.collectionShortcut.deleteMany.mockResolvedValue({ count: 1 });
    const res = await DELETE(makeDELETERequest(SHORTCUT_ID), {
      params: Promise.resolve({ shortcutId: SHORTCUT_ID }),
    });
    expect(res.status).toBe(204);
  });

  it('returns 404 when favorite does not exist', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockCollection);
    mockPrisma.collectionShortcut.deleteMany.mockResolvedValue({ count: 0 });
    const res = await DELETE(makeDELETERequest(SHORTCUT_ID), {
      params: Promise.resolve({ shortcutId: SHORTCUT_ID }),
    });
    expect(res.status).toBe(404);
  });
});
