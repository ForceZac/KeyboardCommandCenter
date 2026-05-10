import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { FavoritesService } from '../../../../services/FavoritesService';

const service = new FavoritesService();

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ shortcutId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { shortcutId } = await params;

  try {
    const removed = await service.removeFavorite(session.user.id, shortcutId);
    if (!removed) {
      return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/favorites/:shortcutId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
