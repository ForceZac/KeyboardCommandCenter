import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { SubmissionsService } from '../../../../services/SubmissionsService';
import { prisma } from '../../../../lib/prisma';

const service = new SubmissionsService();

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1);

  try {
    const result = await service.getPendingAdmin(page);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/admin/submissions] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
