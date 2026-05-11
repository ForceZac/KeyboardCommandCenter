import { NextResponse } from 'next/server';
import { ProfileService } from '../../../../../services/ProfileService';

const service = new ProfileService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  try {
    const profile = await service.getPublicProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (err) {
    console.error('[GET /api/users/[userId]/profile] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
