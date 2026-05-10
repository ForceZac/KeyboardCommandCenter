import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Protect /api/favorites/* and /api/submissions/* — return 401 for unauthenticated requests.
// These routes don't exist yet (TASK-0022, Goal 8) but the guard is scaffolded now so
// those tasks don't need to think about auth wiring.
export default auth((req) => {
  if (!req.auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/api/favorites/:path*', '/api/submissions/:path*'],
};
