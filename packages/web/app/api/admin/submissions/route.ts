import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { SubmissionsService } from '../../../../services/SubmissionsService';
import { prisma } from '../../../../lib/prisma';

const service = new SubmissionsService();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify isAdmin flag on the User row
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const submissions = await service.getPending();
    return NextResponse.json(submissions);
  } catch (err) {
    console.error('[GET /api/admin/submissions] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
