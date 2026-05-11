import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import CollectionsPageClient from './CollectionsPageClient';

/**
 * /collections — My Collections page.
 * Server shell: reads session server-side to prevent auth flash, then redirects
 * unauthenticated users to sign-in before the client component mounts.
 */
export default async function CollectionsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/api/auth/signin?callbackUrl=/collections');
  }

  return <CollectionsPageClient />;
}
