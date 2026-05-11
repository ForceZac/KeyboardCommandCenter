import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../lib/auth';
import { SubmissionsService } from '../../../../../services/SubmissionsService';
import { NotFoundError } from '../../../../../lib/errors';
import { prisma } from '../../../../../lib/prisma';
import type { SubmissionAdminAction } from '@kcc/core';

const service = new SubmissionsService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify isAdmin flag on the User row
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, reviewerNotes, data } = body as Partial<SubmissionAdminAction>;

  if (!action || !['approve', 'reject', 'edit-and-approve'].includes(action)) {
    return NextResponse.json(
      { error: 'action is required and must be approve, reject, or edit-and-approve' },
      { status: 400 },
    );
  }

  const { id: submissionId } = await params;

  try {
    let result;
    if (action === 'approve') {
      result = await service.approve(session.user.id, submissionId);
    } else if (action === 'reject') {
      result = await service.reject(session.user.id, submissionId, reviewerNotes);
    } else {
      // edit-and-approve
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return NextResponse.json(
          { error: 'data is required for edit-and-approve' },
          { status: 400 },
        );
      }
      result = await service.editAndApprove(session.user.id, submissionId, data);
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof Error && err.message === 'Submission is not in PENDING status') {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof Error && err.message === 'Category not found') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[PATCH /api/admin/submissions/:id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
