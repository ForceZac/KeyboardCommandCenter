import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock('../../lib/auth', () => ({ auth: mockAuth }));

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
    submission: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    shortcut: {
      create: vi.fn(),
      update: vi.fn(),
    },
    shortcutKeyBinding: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    shortcutKeyStep: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    application: {
      create: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET } from '../../app/api/admin/submissions/route';
import { PATCH } from '../../app/api/admin/submissions/[id]/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_ID = 'admin-001';
const USER_ID = 'user-abc';
const ADMIN_SESSION = { user: { id: ADMIN_ID, email: 'admin@example.com' } };
const USER_SESSION = { user: { id: USER_ID, email: 'user@example.com' } };

const ADMIN_USER = { isAdmin: true };
const NON_ADMIN_USER = { isAdmin: false };

const PENDING_SUBMISSION_ROW = {
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
  createdAt: new Date('2026-05-11T06:00:00Z'),
  updatedAt: new Date('2026-05-11T06:00:00Z'),
  submitter: { name: 'Test User', image: 'https://example.com/avatar.png' },
  app: { name: 'VS Code', slug: 'vscode' },
  shortcut: null,
};

const APPROVED_SUBMISSION = {
  id: 'sub-001',
  type: 'NEW_SHORTCUT',
  status: 'APPROVED',
  submitterId: USER_ID,
  appId: 'app-001',
  shortcutId: null,
  data: { command: 'Save File', platformId: 'plat-001', keyCombo: 'Ctrl+S', key: 's', modifiers: ['Ctrl'] },
  reviewerNotes: null,
  reviewedBy: ADMIN_ID,
  reviewedAt: new Date('2026-05-11T07:00:00Z'),
  createdAt: new Date('2026-05-11T06:00:00Z'),
  updatedAt: new Date('2026-05-11T07:00:00Z'),
};

const REJECTED_SUBMISSION = {
  ...APPROVED_SUBMISSION,
  status: 'REJECTED',
  reviewerNotes: 'Duplicate entry',
};

function makeGETRequest(page?: number): NextRequest {
  const url = page
    ? `http://localhost/api/admin/submissions?page=${page}`
    : 'http://localhost/api/admin/submissions';
  return new NextRequest(url);
}

function makePATCHRequest(id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/submissions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─── GET /api/admin/submissions ───────────────────────────────────────────────

describe('GET /api/admin/submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGETRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    mockAuth.mockResolvedValue(USER_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(NON_ADMIN_USER);
    const res = await GET(makeGETRequest());
    expect(res.status).toBe(403);
  });

  it('returns 200 with { submissions, totalPending } for admin', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findMany.mockResolvedValue([PENDING_SUBMISSION_ROW]);
    mockPrisma.submission.count.mockResolvedValue(1);

    const res = await GET(makeGETRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalPending).toBe(1);
    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0]).toMatchObject({
      id: 'sub-001',
      status: 'PENDING',
      submitterName: 'Test User',
      submitterImage: 'https://example.com/avatar.png',
      appName: 'VS Code',
      appSlug: 'vscode',
    });
  });

  it('returns empty submissions array when no pending', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findMany.mockResolvedValue([]);
    mockPrisma.submission.count.mockResolvedValue(0);

    const res = await GET(makeGETRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ submissions: [], totalPending: 0 });
  });

  it('passes page parameter to service for pagination', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findMany.mockResolvedValue([]);
    mockPrisma.submission.count.mockResolvedValue(0);

    await GET(makeGETRequest(3));
    expect(mockPrisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 50 }),
    );
  });

  it('includes originalShortcut for CORRECTION submissions', async () => {
    const correctionRow = {
      ...PENDING_SUBMISSION_ROW,
      type: 'CORRECTION',
      shortcutId: 'sc-001',
      shortcut: {
        command: 'Copy',
        context: 'Editor',
        bindings: [
          {
            platform: { slug: 'windows' },
            steps: [{ keyCombo: 'Ctrl+C' }],
          },
        ],
      },
    };

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findMany.mockResolvedValue([correctionRow]);
    mockPrisma.submission.count.mockResolvedValue(1);

    const res = await GET(makeGETRequest());
    const body = await res.json();
    expect(body.submissions[0].originalShortcut).toEqual({
      command: 'Copy',
      context: 'Editor',
      keyCombo: 'Ctrl+C',
      platform: 'windows',
    });
  });
});

// ─── PATCH /api/admin/submissions/:id ────────────────────────────────────────

describe('PATCH /api/admin/submissions/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const PENDING_FOR_PATCH = {
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
    createdAt: new Date('2026-05-11T06:00:00Z'),
    updatedAt: new Date('2026-05-11T06:00:00Z'),
  };

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makePATCHRequest('sub-001', { action: 'approve' }), makeParams('sub-001'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    mockAuth.mockResolvedValue(USER_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(NON_ADMIN_USER);
    const res = await PATCH(makePATCHRequest('sub-001', { action: 'approve' }), makeParams('sub-001'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when action is missing', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    const res = await PATCH(makePATCHRequest('sub-001', {}), makeParams('sub-001'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when action is invalid', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    const res = await PATCH(makePATCHRequest('sub-001', { action: 'delete' }), makeParams('sub-001'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when submission not found', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePATCHRequest('bad-id', { action: 'approve' }), makeParams('bad-id'));
    expect(res.status).toBe(404);
  });

  it('returns 200 and approves a NEW_SHORTCUT submission', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findUnique.mockResolvedValue(PENDING_FOR_PATCH);
    mockPrisma.shortcut.create.mockResolvedValue({ id: 'sc-new' });
    mockPrisma.shortcutKeyBinding.create.mockResolvedValue({ id: 'binding-new' });
    mockPrisma.shortcutKeyStep.create.mockResolvedValue({ id: 'step-new' });
    mockPrisma.submission.update.mockResolvedValue(APPROVED_SUBMISSION);

    const res = await PATCH(
      makePATCHRequest('sub-001', { action: 'approve' }),
      makeParams('sub-001'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('APPROVED');
    expect(body.reviewedBy).toBe(ADMIN_ID);
    expect(mockPrisma.shortcut.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ command: 'Save File', applicationId: 'app-001' }),
      }),
    );
  });

  it('returns 200 and rejects a submission with reviewer notes', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findUnique.mockResolvedValue(PENDING_FOR_PATCH);
    mockPrisma.submission.update.mockResolvedValue(REJECTED_SUBMISSION);

    const res = await PATCH(
      makePATCHRequest('sub-001', { action: 'reject', reviewerNotes: 'Duplicate entry' }),
      makeParams('sub-001'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('REJECTED');
    expect(body.reviewerNotes).toBe('Duplicate entry');
    expect(mockPrisma.submission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED', reviewerNotes: 'Duplicate entry' }),
      }),
    );
  });

  it('returns 200 and edit-and-approves — merges data before applying', async () => {
    const updatedData = { command: 'Save All Files', keyCombo: 'Ctrl+Shift+S', key: 's', modifiers: ['Ctrl', 'Shift'] };
    const mergedSubmission = {
      ...PENDING_FOR_PATCH,
      data: { ...PENDING_FOR_PATCH.data, ...updatedData },
    };
    const approvedMerged = { ...mergedSubmission, status: 'APPROVED', reviewedBy: ADMIN_ID };

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findUnique
      .mockResolvedValueOnce(PENDING_FOR_PATCH)
      .mockResolvedValueOnce({ ...mergedSubmission })
      .mockResolvedValue({ ...mergedSubmission });
    mockPrisma.submission.update
      .mockResolvedValueOnce({ ...mergedSubmission })
      .mockResolvedValueOnce({ ...approvedMerged, reviewedAt: new Date() });
    mockPrisma.shortcut.create.mockResolvedValue({ id: 'sc-new' });
    mockPrisma.shortcutKeyBinding.create.mockResolvedValue({ id: 'binding-new' });
    mockPrisma.shortcutKeyStep.create.mockResolvedValue({ id: 'step-new' });

    const res = await PATCH(
      makePATCHRequest('sub-001', { action: 'edit-and-approve', data: updatedData }),
      makeParams('sub-001'),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.submission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ data: expect.objectContaining({ command: 'Save All Files' }) }),
      }),
    );
  });

  it('returns 400 when edit-and-approve is called without data', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    const res = await PATCH(
      makePATCHRequest('sub-001', { action: 'edit-and-approve' }),
      makeParams('sub-001'),
    );
    expect(res.status).toBe(400);
  });

  it('approves CORRECTION — updates existing shortcut row', async () => {
    const correctionSubmission = {
      ...PENDING_FOR_PATCH,
      type: 'CORRECTION',
      shortcutId: 'sc-existing',
      data: { command: 'Save Document', keyCombo: 'Ctrl+S', platformId: 'plat-001', key: 's', modifiers: ['Ctrl'] },
    };
    const approvedCorrection = { ...correctionSubmission, status: 'APPROVED', reviewedBy: ADMIN_ID, reviewedAt: new Date() };

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findUnique.mockResolvedValue(correctionSubmission);
    mockPrisma.shortcut.update.mockResolvedValue({ id: 'sc-existing', command: 'Save Document' });
    mockPrisma.shortcutKeyBinding.findUnique.mockResolvedValue({
      id: 'binding-001',
      steps: [{ id: 'step-001', stepOrder: 1, keyCombo: 'Ctrl+S', key: 's', modifiers: ['Ctrl'] }],
    });
    mockPrisma.shortcutKeyStep.update.mockResolvedValue({ id: 'step-001' });
    mockPrisma.submission.update.mockResolvedValue(approvedCorrection);

    const res = await PATCH(
      makePATCHRequest('sub-001', { action: 'approve' }),
      makeParams('sub-001'),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.shortcut.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sc-existing' },
        data: expect.objectContaining({ command: 'Save Document' }),
      }),
    );
  });

  it('approves APP_REQUEST — creates new Application row', async () => {
    const appRequestSubmission = {
      ...PENDING_FOR_PATCH,
      type: 'APP_REQUEST',
      appId: null,
      data: { appName: 'Notion', slug: 'notion', categoryId: 'cat-productivity' },
    };
    const approvedAppRequest = { ...appRequestSubmission, status: 'APPROVED', reviewedBy: ADMIN_ID, reviewedAt: new Date() };

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findUnique.mockResolvedValue(appRequestSubmission);
    mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-productivity', name: 'Productivity', slug: 'productivity' });
    mockPrisma.application.create.mockResolvedValue({ id: 'app-new', name: 'Notion', slug: 'notion' });
    mockPrisma.submission.update.mockResolvedValue(approvedAppRequest);

    const res = await PATCH(
      makePATCHRequest('sub-001', { action: 'approve' }),
      makeParams('sub-001'),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Notion', slug: 'notion' }),
      }),
    );
  });

  it('returns 409 when approving a non-PENDING submission', async () => {
    const approvedSubmission = { ...PENDING_FOR_PATCH, status: 'APPROVED' };
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findUnique.mockResolvedValue(approvedSubmission);
    const res = await PATCH(
      makePATCHRequest('sub-001', { action: 'approve' }),
      makeParams('sub-001'),
    );
    expect(res.status).toBe(409);
  });

  it('returns 400 when APP_REQUEST approve has invalid categoryId', async () => {
    const appRequestSubmission = {
      ...PENDING_FOR_PATCH,
      type: 'APP_REQUEST',
      appId: null,
      data: { appName: 'Some App', slug: 'some-app', categoryId: 'nonexistent-cat' },
    };
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findUnique.mockResolvedValue(appRequestSubmission);
    mockPrisma.category.findUnique.mockResolvedValue(null);
    const res = await PATCH(
      makePATCHRequest('sub-001', { action: 'approve' }),
      makeParams('sub-001'),
    );
    expect(res.status).toBe(400);
  });
});
