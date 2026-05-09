import { NextRequest, NextResponse } from 'next/server';
import { AppService } from '../../../services/AppService';

const service = new AppService();

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category') ?? undefined;

  try {
    const apps = await service.listApps(category);
    return NextResponse.json(apps);
  } catch (err) {
    console.error('[/api/apps] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
