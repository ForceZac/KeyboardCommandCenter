import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { CollectionsService } from '../../../../services/CollectionsService';

const service = new CollectionsService();

export async function PATCH(
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

  const patch = body as { name?: unknown; description?: unknown };
  const update: { name?: string; description?: string } = {};
  if (typeof patch.name === 'string' && patch.name.trim()) {
    update.name = patch.name.trim();
  }
  if (typeof patch.description === 'string') {
    update.description = patch.description.trim();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: 'At least one of name or description must be provided' },
      { status: 400 },
    );
  }

  try {
    const updated = await service.updateCollection(session.user.id, id, update);
    if (!updated) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PATCH /api/collections/:id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await service.deleteCollection(session.user.id, id);

    if (result === 'not_found') {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    if (result === 'is_default') {
      return NextResponse.json(
        { error: 'Cannot delete the default collection' },
        { status: 400 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/collections/:id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
