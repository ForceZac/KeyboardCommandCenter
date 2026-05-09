import { NextRequest, NextResponse } from 'next/server';
import { ShortcutService } from '../../../../services/ShortcutService';

const service = new ShortcutService();

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q');
  const platform = searchParams.get('platform') ?? undefined;

  if (!q || q.trim() === '') {
    return NextResponse.json(
      { error: 'q parameter is required and must not be empty' },
      { status: 400 }
    );
  }

  try {
    const results = await service.search(q.trim(), platform);
    return NextResponse.json(results);
  } catch (err) {
    console.error('[/api/shortcuts/search] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
