import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock('../../lib/auth', () => ({ auth: mockAuth }));

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    submission: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    shortcutKeyStep: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET, POST } from '../../app/api/submissions/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';
const SESSION = { user: { id: USER_ID, email: 'test@example.com' } };

const BASE_SUBMISSION = {
  id: 'sub-001',
  type: 'NEW_SHORTCUT',
  status: 'PENDING',
  submitterId: USER_ID,
  appId: 'app-001',
  shortcutId: null,
  data: { command: 'Save File', platformId: 'plat-001', keyCombo: 'Ctrl+S', key: 's', modifiers: ['Ctrl'] },
  reviewerNotes: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date('2026-05-11T07:00:00Z'),
  updatedAt: new Date('2026-05-11T07:00:00Z'),
};

function makePOSTRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/submissions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

// ─── GET /api/submissions ─────────────────────────────────────────────────────

describe('GET /api/submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty array when no submissions', async () => {
    mockPrisma.submission.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns 200 with user submissions sorted newest first', async () => {
    mockPrisma.submission.findMany.mockResolvedValue([BASE_SUBMISSION]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: 'sub-001', type: 'NEW_SHORTCUT', status: 'PENDING' });
  });
});

// ─── POST /api/submissions ────────────────────────────────────────────────────

describe('POST /api/submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
    // Default: no prior submissions today, no duplicates
    mockPrisma.submission.count.mockResolvedValue(0);
    mockPrisma.shortcutKeyStep.findFirst.mockResolvedValue(null);
    mockPrisma.submission.create.mockResolvedValue(BASE_SUBMISSION);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(
      makePOSTRequest({ type: 'NEW_SHORTCUT', appId: 'app-001', data: {} }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when type is missing', async () => {
    const res = await POST(makePOSTRequest({ appId: 'app-001', data: {} }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when type is invalid', async () => {
    const res = await POST(makePOSTRequest({ type: 'INVALID', appId: 'app-001', data: {} }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when data is missing', async () => {
    const res = await POST(makePOSTRequest({ type: 'NEW_SHORTCUT', appId: 'app-001' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when appId missing for NEW_SHORTCUT', async () => {
    const res = await POST(
      makePOSTRequest({ type: 'NEW_SHORTCUT', data: { command: 'Save' } }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when appId missing for CORRECTION', async () => {
    const res = await POST(
      makePOSTRequest({ type: 'CORRECTION', shortcutId: 'sc-001', data: {} }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when shortcutId missing for CORRECTION', async () => {
    const res = await POST(
      makePOSTRequest({ type: 'CORRECTION', appId: 'app-001', data: {} }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 201 on successful NEW_SHORTCUT submission', async () => {
    const res = await POST(
      makePOSTRequest({
        type: 'NEW_SHORTCUT',
        appId: 'app-001',
        data: { command: 'Save File', platformId: 'plat-001', keyCombo: 'Ctrl+S', key: 's', modifiers: ['Ctrl'] },
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: 'sub-001', type: 'NEW_SHORTCUT', status: 'PENDING' });
  });

  it('returns 201 on APP_REQUEST with no appId', async () => {
    mockPrisma.submission.create.mockResolvedValue({
      ...BASE_SUBMISSION,
      id: 'sub-002',
      type: 'APP_REQUEST',
      appId: null,
      data: { appName: 'Notion', categoryId: 'cat-001' },
    });
    const res = await POST(
      makePOSTRequest({ type: 'APP_REQUEST', data: { appName: 'Notion', categoryId: 'cat-001' } }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe('APP_REQUEST');
  });

  it('returns 429 when daily submission limit is exceeded', async () => {
    mockPrisma.submission.count.mockResolvedValue(20);
    const res = await POST(
      makePOSTRequest({
        type: 'NEW_SHORTCUT',
        appId: 'app-001',
        data: { command: 'Copy', platformId: 'plat-001', keyCombo: 'Ctrl+C', key: 'c', modifiers: ['Ctrl'] },
      }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/limit/i);
  });

  it('allows 20th submission (count=19 → succeeds)', async () => {
    mockPrisma.submission.count.mockResolvedValue(19);
    const res = await POST(
      makePOSTRequest({
        type: 'NEW_SHORTCUT',
        appId: 'app-001',
        data: { command: 'Copy', platformId: 'plat-001', keyCombo: 'Ctrl+C', key: 'c', modifiers: ['Ctrl'] },
      }),
    );
    expect(res.status).toBe(201);
  });

  it('returns 409 when duplicate NEW_SHORTCUT detected', async () => {
    mockPrisma.shortcutKeyStep.findFirst.mockResolvedValue({ id: 'step-existing' });
    const res = await POST(
      makePOSTRequest({
        type: 'NEW_SHORTCUT',
        appId: 'app-001',
        data: { command: 'Save', platformId: 'plat-001', keyCombo: 'Ctrl+S', key: 's', modifiers: ['Ctrl'] },
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/duplicate|already exists/i);
  });

  it('does not run duplicate check for CORRECTION', async () => {
    mockPrisma.submission.create.mockResolvedValue({
      ...BASE_SUBMISSION,
      type: 'CORRECTION',
      shortcutId: 'sc-001',
    });
    const res = await POST(
      makePOSTRequest({
        type: 'CORRECTION',
        appId: 'app-001',
        shortcutId: 'sc-001',
        data: { keyCombo: 'Ctrl+S', platformId: 'plat-001' },
      }),
    );
    expect(res.status).toBe(201);
    // shortcutKeyStep.findFirst should NOT have been called for CORRECTION
    expect(mockPrisma.shortcutKeyStep.findFirst).not.toHaveBeenCalled();
  });
});
