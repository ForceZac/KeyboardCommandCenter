import ContributorProfileClient from './ContributorProfileClient';

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function ContributorProfilePage({ params }: Props) {
  const { userId } = await params;
  return <ContributorProfileClient userId={userId} />;
}
