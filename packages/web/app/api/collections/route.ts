import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';
import { CollectionsService } from '../../../services/CollectionsService';
import { LimitReachedError } from '../../../lib/errors';

const service = new CollectionsService();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const collections = await service.listCollections(session.user.id);
    return NextResponse.json(collections);
  } catch (err) {
    console.error('[GET /api/collections] error:', err);
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

  const { name, description } = body as { name?: unknown; description?: unknown };
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  try {
    const created = await service.createCollection(
      session.user.id,
      name.trim(),
      typeof description === 'string' ? description.trim() || undefined : undefined,
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof LimitReachedError) {
      return NextResponse.json(
        { error: 'Collections limit reached (max 50)' },
        { status: 403 },
      );
    }
    console.error('[POST /api/collections] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
