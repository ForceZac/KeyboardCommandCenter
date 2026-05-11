import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import CollectionDetailPageClient from './CollectionDetailPageClient';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * /collections/:id — Collection detail page.
 * Server shell: enforces auth, then passes the collection ID to the client shell.
 */
export default async function CollectionDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) {
    redirect('/api/auth/signin?callbackUrl=/collections');
  }

  const { id } = await params;
  return <CollectionDetailPageClient collectionId={id} />;
}
