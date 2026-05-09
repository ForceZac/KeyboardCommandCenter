import { NextRequest, NextResponse } from 'next/server';
import { AppService } from '../../../../services/AppService';

const service = new AppService();

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  try {
    const app = await service.getApp(slug);
    if (!app) {
      return NextResponse.json(
        { error: `App not found: ${slug}` },
        { status: 404 }
      );
    }
    return NextResponse.json(app);
  } catch (err) {
    console.error(`[/api/apps/${slug}] error:`, err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
