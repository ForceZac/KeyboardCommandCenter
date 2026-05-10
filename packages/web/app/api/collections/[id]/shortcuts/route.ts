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
