import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock('../../lib/auth', () => ({ auth: mockAuth }));

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    collection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    collectionShortcut: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as collectionsGET, POST as collectionsPOST } from '../../app/api/collections/route';
import { PATCH, DELETE } from '../../app/api/collections/[id]/route';
import { GET as shortcutsGET, POST as shortcutsPOST } from '../../app/api/collections/[id]/shortcuts/route';
import { DELETE as shortcutDELETE } from '../../app/api/collections/[id]/shortcuts/[shortcutId]/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';
const SESSION = { user: { id: USER_ID, email: 'test@example.com' } };
const COLLECTION_ID = 'coll-001';

const mockDefaultCollection = {
  id: COLLECTION_ID,
  userId: USER_ID,
  name: 'My Favorites',
  description: null,
  isDefault: true,
  createdAt: new Date('2026-05-10T12:00:00Z'),
  updatedAt: new Date('2026-05-10T12:00:00Z'),
  _count: { shortcuts: 3 },
};

const mockNamedCollection = {
  id: 'coll-002',
  userId: USER_ID,
  name: 'Work Tools',
  description: 'My work shortcuts',
  isDefault: false,
  createdAt: new Date('2026-05-10T12:00:00Z'),
  updatedAt: new Date('2026-05-10T12:00:00Z'),
  _count: { shortcuts: 1 },
};

function makeRequest(
  url: string,
  method: string,
  body?: unknown,
): NextRequest {
  return new NextRequest(url, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        }
      : {}),
  });
}

// ─── GET /api/collections ─────────────────────────────────────────────────────

describe('GET /api/collections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await collectionsGET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with a list of collections', async () => {
    mockPrisma.collection.findMany.mockResolvedValue([
      mockDefaultCollection,
      mockNamedCollection,
    ]);
    const res = await collectionsGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ name: 'My Favorites', isDefault: true, shortcutCount: 3 });
    expect(body[1]).toMatchObject({ name: 'Work Tools', isDefault: false, shortcutCount: 1 });
  });
});

// ─── POST /api/collections ────────────────────────────────────────────────────

describe('POST /api/collections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await collectionsPOST(
      makeRequest('http://localhost/api/collections', 'POST', { name: 'Test' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    const res = await collectionsPOST(
      makeRequest('http://localhost/api/collections', 'POST', {}),
    );
    expect(res.status).toBe(400);
  });

  it('returns 201 with the created collection', async () => {
    mockPrisma.collection.count.mockResolvedValue(2);
    mockPrisma.collection.create.mockResolvedValue({
      id: 'coll-003',
      userId: USER_ID,
      name: 'New Collection',
      description: null,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await collectionsPOST(
      makeRequest('http://localhost/api/collections', 'POST', { name: 'New Collection' }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ name: 'New Collection', shortcutCount: 0 });
  });

  it('returns 403 when collections limit is reached', async () => {
    mockPrisma.collection.count.mockResolvedValue(50);
    const res = await collectionsPOST(
      makeRequest('http://localhost/api/collections', 'POST', { name: 'Another' }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/limit/i);
  });
});

// ─── PATCH /api/collections/:id ───────────────────────────────────────────────

describe('PATCH /api/collections/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it('returns 200 with updated collection', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockNamedCollection);
    mockPrisma.collection.update.mockResolvedValue({
      ...mockNamedCollection,
      name: 'Renamed',
      _count: { shortcuts: 1 },
    });
    const res = await PATCH(
      makeRequest(`http://localhost/api/collections/${COLLECTION_ID}`, 'PATCH', {
        name: 'Renamed',
      }),
      { params: Promise.resolve({ id: COLLECTION_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Renamed');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(
      makeRequest(`http://localhost/api/collections/${COLLECTION_ID}`, 'PATCH', { name: 'X' }),
      { params: Promise.resolve({ id: COLLECTION_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when no valid fields are provided', async () => {
    const res = await PATCH(
      makeRequest(`http://localhost/api/collections/${COLLECTION_ID}`, 'PATCH', {}),
      { params: Promise.resolve({ id: COLLECTION_ID }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when collection is not found', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(null);
    const res = await PATCH(
      makeRequest(`http://localhost/api/collections/missing-id`, 'PATCH', { name: 'X' }),
      { params: Promise.resolve({ id: 'missing-id' }) },
    );
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/collections/:id ─────────────────────────────────────────────

describe('DELETE /api/collections/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it('returns 204 when collection is deleted', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockNamedCollection);
    mockPrisma.collection.delete.mockResolvedValue(mockNamedCollection);
    const res = await DELETE(
      makeRequest(`http://localhost/api/collections/${COLLECTION_ID}`, 'DELETE'),
      { params: Promise.resolve({ id: COLLECTION_ID }) },
    );
    expect(res.status).toBe(204);
  });

  it('returns 400 when trying to delete the default collection', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockDefaultCollection);
    const res = await DELETE(
      makeRequest(`http://localhost/api/collections/${COLLECTION_ID}`, 'DELETE'),
      { params: Promise.resolve({ id: COLLECTION_ID }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/default/i);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(
      makeRequest(`http://localhost/api/collections/${COLLECTION_ID}`, 'DELETE'),
      { params: Promise.resolve({ id: COLLECTION_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when collection does not exist', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(null);
    const res = await DELETE(
      makeRequest(`http://localhost/api/collections/missing`, 'DELETE'),
      { params: Promise.resolve({ id: 'missing' }) },
    );
    expect(res.status).toBe(404);
  });
});

// ─── GET /api/collections/:id/shortcuts ──────────────────────────────────────

describe('GET /api/collections/:id/shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await shortcutsGET(
      makeRequest(`http://localhost/api/collections/${COLLECTION_ID}/shortcuts`, 'GET'),
      { params: Promise.resolve({ id: COLLECTION_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with shortcuts in the collection', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockDefaultCollection);
    mockPrisma.collectionShortcut.findMany.mockResolvedValue([
      {
        id: 'cs-1',
        collectionId: COLLECTION_ID,
        shortcutId: 'sc-001',
        userId: USER_ID,
        createdAt: new Date('2026-05-10T12:00:00Z'),
        shortcut: {
          id: 'sc-001',
          command: 'Copy',
          context: 'Global',
          application: { name: 'VS Code', slug: 'vs-code' },
        },
      },
    ]);
    const res = await shortcutsGET(
      makeRequest(`http://localhost/api/collections/${COLLECTION_ID}/shortcuts`, 'GET'),
      { params: Promise.resolve({ id: COLLECTION_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].shortcut.command).toBe('Copy');
  });

  it('returns 404 when collection is not owned by user', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(null);
    const res = await shortcutsGET(
      makeRequest(`http://localhost/api/collections/other-coll/shortcuts`, 'GET'),
      { params: Promise.resolve({ id: 'other-coll' }) },
    );
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/collections/:id/shortcuts ─────────────────────────────────────

describe('POST /api/collections/:id/shortcuts', () => {
  const SHORTCUT_ID = 'sc-999';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await shortcutsPOST(
      makeRequest(`http://localhost/api/collections/${COLLECTION_ID}/shortcuts`, 'POST', {
        shortcutId: SHORTCUT_ID,
      }),
      { params: Promise.resolve({ id: COLLECTION_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when shortcutId is missing', async () => {
    const res = await shortcutsPOST(
      makeRequest(`http://localhost/api/collections/${COLLECTION_ID}/shortcuts`, 'POST', {}),
      { params: Promise.resolve({ id: COLLECTION_ID }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when collection does not exist', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(null);
    const res = await shortcutsPOST(
      makeRequest(`http://localhost/api/collections/missing/shortcuts`, 'POST', {
        shortcutId: SHORTCUT_ID,
      }),
      { params: Promise.resolve({ id: 'missing' }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 204 when shortcut is added successfully', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockNamedCollection);
    mockPrisma.collectionShortcut.upsert.mockResolvedValue({});
    const res = await shortcutsPOST(
      makeRequest(`http://localhost/api/collections/${COLLECTION_ID}/shortcuts`, 'POST', {
        shortcutId: SHORTCUT_ID,
      }),
      { params: Promise.resolve({ id: COLLECTION_ID }) },
    );
    expect(res.status).toBe(204);
  });
});

// ─── DELETE /api/collections/:id/shortcuts/:shortcutId ───────────────────────

describe('DELETE /api/collections/:id/shortcuts/:shortcutId', () => {
  const SHORTCUT_ID = 'sc-999';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await shortcutDELETE(
      makeRequest(
        `http://localhost/api/collections/${COLLECTION_ID}/shortcuts/${SHORTCUT_ID}`,
        'DELETE',
      ),
      { params: Promise.resolve({ id: COLLECTION_ID, shortcutId: SHORTCUT_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when collection does not exist', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(null);
    const res = await shortcutDELETE(
      makeRequest(
        `http://localhost/api/collections/missing/shortcuts/${SHORTCUT_ID}`,
        'DELETE',
      ),
      { params: Promise.resolve({ id: 'missing', shortcutId: SHORTCUT_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when shortcut is not in the collection', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockNamedCollection);
    mockPrisma.collectionShortcut.deleteMany.mockResolvedValue({ count: 0 });
    const res = await shortcutDELETE(
      makeRequest(
        `http://localhost/api/collections/${COLLECTION_ID}/shortcuts/${SHORTCUT_ID}`,
        'DELETE',
      ),
      { params: Promise.resolve({ id: COLLECTION_ID, shortcutId: SHORTCUT_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 204 when shortcut is removed successfully', async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(mockNamedCollection);
    mockPrisma.collectionShortcut.deleteMany.mockResolvedValue({ count: 1 });
    const res = await shortcutDELETE(
      makeRequest(
        `http://localhost/api/collections/${COLLECTION_ID}/shortcuts/${SHORTCUT_ID}`,
        'DELETE',
      ),
      { params: Promise.resolve({ id: COLLECTION_ID, shortcutId: SHORTCUT_ID }) },
    );
    expect(res.status).toBe(204);
  });
});
