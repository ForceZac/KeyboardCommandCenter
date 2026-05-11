import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';
import { SubmissionsService } from '../../../services/SubmissionsService';
import { RateLimitError, DuplicateSubmissionError } from '../../../lib/errors';
import type { SubmissionCreatePayload } from '@kcc/core';

const service = new SubmissionsService();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const submissions = await service.getByUser(session.user.id);
    return NextResponse.json(submissions);
  } catch (err) {
    console.error('[GET /api/submissions] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = body as Partial<SubmissionCreatePayload>;

  if (!payload.type || !['NEW_SHORTCUT', 'CORRECTION', 'APP_REQUEST'].includes(payload.type)) {
    return NextResponse.json({ error: 'type is required and must be a valid SubmissionType' }, { status: 400 });
  }
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    return NextResponse.json({ error: 'data is required and must be an object' }, { status: 400 });
  }

  try {
    const submission = await service.create(session.user.id, payload as SubmissionCreatePayload);
    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof DuplicateSubmissionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (
      err instanceof Error &&
      (err.message.startsWith('appId is required') || err.message.startsWith('shortcutId is required'))
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[POST /api/submissions] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
