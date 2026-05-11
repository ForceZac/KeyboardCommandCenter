'use client';

import { useState } from 'react';
import { useAdminSubmissions } from '../hooks/useAdminSubmissions';
import SubmissionCard from './SubmissionCard';

const PAGE_SIZE = 50;

export default function AdminReviewQueue() {
  const [page, setPage] = useState(1);
  const { submissions, totalPending, isLoading, error } = useAdminSubmissions(page);
  const totalPages = Math.max(1, Math.ceil(totalPending / PAGE_SIZE));

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="loading-skeleton">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300" data-testid="error-state">
        Failed to load submissions: {error.message}
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400" data-testid="empty-state">
        No pending submissions — queue is clear.
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4">
        {submissions.map((s) => (
          <SubmissionCard key={s.id} submission={s} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2" data-testid="pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
