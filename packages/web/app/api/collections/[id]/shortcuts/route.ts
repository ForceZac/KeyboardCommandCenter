import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../lib/auth';
import { CollectionsService } from '../../../../../services/CollectionsService';

const service = new CollectionsService();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const shortcuts = await service.getCollectionShortcuts(session.user.id, id);
    if (shortcuts === null) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    return NextResponse.json(shortcuts);
  } catch (err) {
    console.error('[GET /api/collections/:id/shortcuts] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { shortcutId } = body as { shortcutId?: unknown };
  if (typeof shortcutId !== 'string' || !shortcutId.trim()) {
    return NextResponse.json({ error: 'shortcutId is required' }, { status: 400 });
  }

  try {
    const result = await service.addShortcutToCollection(session.user.id, id, shortcutId);
    if (result === 'not_found') {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[POST /api/collections/:id/shortcuts] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
