import { useQuery } from '@tanstack/react-query';
import { fetchContributorProfile } from '@/lib/api';

export function useContributorProfile(userId: string) {
  return useQuery({
    queryKey: ['contributor-profile', userId],
    queryFn: () => fetchContributorProfile(userId),
    staleTime: 60_000,
    enabled: !!userId,
  });
}
