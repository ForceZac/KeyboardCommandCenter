import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';
import { FavoritesService } from '../../../services/FavoritesService';
import { LimitReachedError } from '../../../lib/errors';

const service = new FavoritesService();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const favorites = await service.getFavorites(session.user.id);
    return NextResponse.json(favorites);
  } catch (err) {
    console.error('[GET /api/favorites] error:', err);
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

  const { shortcutId } = body as { shortcutId?: unknown };
  if (typeof shortcutId !== 'string' || !shortcutId.trim()) {
    return NextResponse.json({ error: 'shortcutId is required' }, { status: 400 });
  }

  try {
    await service.addFavorite(session.user.id, shortcutId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof LimitReachedError) {
      return NextResponse.json(
        { error: 'Favorites limit reached (max 1000)' },
        { status: 403 },
      );
    }
    console.error('[POST /api/favorites] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
