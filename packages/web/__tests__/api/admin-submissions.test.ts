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

const PENDING_SUBMISSION = {
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

const APPROVED_SUBMISSION = {
  ...PENDING_SUBMISSION,
  status: 'APPROVED',
  reviewedBy: ADMIN_ID,
  reviewedAt: new Date('2026-05-11T07:00:00Z'),
  updatedAt: new Date('2026-05-11T07:00:00Z'),
};

const REJECTED_SUBMISSION = {
  ...PENDING_SUBMISSION,
  status: 'REJECTED',
  reviewedBy: ADMIN_ID,
  reviewedAt: new Date('2026-05-11T07:00:00Z'),
  reviewerNotes: 'Duplicate entry',
  updatedAt: new Date('2026-05-11T07:00:00Z'),
};

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
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    mockAuth.mockResolvedValue(USER_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(NON_ADMIN_USER);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 200 with pending submissions sorted oldest-first for admin', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findMany.mockResolvedValue([PENDING_SUBMISSION]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: 'sub-001', status: 'PENDING' });
  });

  it('returns 200 with empty array when no pending submissions', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

// ─── PATCH /api/admin/submissions/:id ────────────────────────────────────────

describe('PATCH /api/admin/submissions/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    mockPrisma.submission.findUnique.mockResolvedValue(PENDING_SUBMISSION);
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
    // Verify shortcut was created
    expect(mockPrisma.shortcut.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ command: 'Save File', applicationId: 'app-001' }),
      }),
    );
  });

  it('returns 200 and rejects a submission with reviewer notes', async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrisma.submission.findUnique.mockResolvedValue(PENDING_SUBMISSION);
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
      ...PENDING_SUBMISSION,
      data: { ...PENDING_SUBMISSION.data, ...updatedData },
    };
    const approvedMerged = { ...mergedSubmission, status: 'APPROVED', reviewedBy: ADMIN_ID };

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
    // editAndApprove calls findUnique twice (once in editAndApprove, once in approve)
    mockPrisma.submission.findUnique
      .mockResolvedValueOnce(PENDING_SUBMISSION) // for editAndApprove
      .mockResolvedValueOnce({ ...mergedSubmission }) // for approve after update
      .mockResolvedValue({ ...mergedSubmission }); // fallback
    mockPrisma.submission.update
      .mockResolvedValueOnce({ ...mergedSubmission }) // data merge
      .mockResolvedValueOnce({ ...approvedMerged, reviewedAt: new Date() }); // status update
    mockPrisma.shortcut.create.mockResolvedValue({ id: 'sc-new' });
    mockPrisma.shortcutKeyBinding.create.mockResolvedValue({ id: 'binding-new' });
    mockPrisma.shortcutKeyStep.create.mockResolvedValue({ id: 'step-new' });

    const res = await PATCH(
      makePATCHRequest('sub-001', { action: 'edit-and-approve', data: updatedData }),
      makeParams('sub-001'),
    );
    expect(res.status).toBe(200);
    // Verify data was merged before approve
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
      ...PENDING_SUBMISSION,
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
      ...PENDING_SUBMISSION,
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
    const approvedSubmission = { ...PENDING_SUBMISSION, status: 'APPROVED' };
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
      ...PENDING_SUBMISSION,
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
