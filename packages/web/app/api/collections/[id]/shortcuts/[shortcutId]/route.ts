import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../../lib/auth';
import { CollectionsService } from '../../../../../../services/CollectionsService';

const service = new CollectionsService();

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; shortcutId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, shortcutId } = await params;

  try {
    const result = await service.removeShortcutFromCollection(
      session.user.id,
      id,
      shortcutId,
    );

    if (result === 'not_found') {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    if (result === 'not_in_collection') {
      return NextResponse.json(
        { error: 'Shortcut not in collection' },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/collections/:id/shortcuts/:shortcutId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
