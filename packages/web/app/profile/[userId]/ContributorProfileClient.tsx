'use client';

import { useContributorProfile } from '@/hooks/useContributorProfile';
import { ApiError } from '@/lib/api';
import type { SubmissionType } from '@kcc/core';

interface Props {
  userId: string;
}

const typeLabels: Record<SubmissionType, string> = {
  NEW_SHORTCUT: 'New Shortcut',
  CORRECTION: 'Correction',
  APP_REQUEST: 'App Request',
};

export default function ContributorProfileClient({ userId }: Props) {
  const { data: profile, isLoading, error } = useContributorProfile(userId);

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-sm text-gray-400 py-8 text-center">Loading profile…</div>
      </main>
    );
  }

  if (error) {
    const is404 = error instanceof ApiError && error.status === 404;
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {is404 ? 'User not found' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {is404
              ? 'This contributor profile does not exist.'
              : 'Unable to load this profile. Please try again later.'}
          </p>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  const { user, stats, acceptedContributions } = profile;
  const name = user.name ?? 'Anonymous';
  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const memberSince = new Date(user.memberSince).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* User identity */}
      <div className="flex items-center gap-4 mb-8">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={name}
            width={64}
            height={64}
            className="rounded-full w-16 h-16 object-cover"
          />
        ) : (
          <span className="flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600 text-white text-xl font-semibold select-none">
            {initials}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Member since {memberSince}
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalSubmitted}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Submitted</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalAccepted}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Accepted</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.acceptanceRate}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Acceptance Rate</p>
        </div>
      </div>

      {/* Accepted contributions */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Accepted Contributions
      </h2>

      {acceptedContributions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
          No accepted contributions yet.
        </p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {acceptedContributions.map((contribution, i) => (
            <div
              key={`${contribution.type}-${contribution.command}-${i}`}
              className="flex items-center justify-between gap-4 py-3 px-4 bg-white dark:bg-gray-800"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {contribution.command}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {contribution.appName}
                  <span className="mx-1.5">·</span>
                  <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {typeLabels[contribution.type]}
                  </span>
                </p>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                {contribution.date
                  ? new Date(contribution.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
