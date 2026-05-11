import { NextRequest, NextResponse } from 'next/server';
import { ShortcutService } from '../../../../services/ShortcutService';

const service = new ShortcutService();

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const appId = searchParams.get('appId');
  const platform = searchParams.get('platform');
  const keyCombo = searchParams.get('keyCombo');

  if (!appId || !platform || !keyCombo) {
    return NextResponse.json(
      { error: 'appId, platform, and keyCombo query params are required' },
      { status: 400 },
    );
  }

  try {
    const result = await service.checkDuplicate(appId, platform, keyCombo);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/shortcuts/check-duplicate] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
