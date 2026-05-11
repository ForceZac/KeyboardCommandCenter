import { Suspense } from 'react';
import AdminReviewQueue from './components/AdminReviewQueue';

export default function AdminReviewPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Review Queue</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Pending community submissions awaiting review.
      </p>

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
                />
              ))}
            </div>
          }
        >
          <AdminReviewQueue />
        </Suspense>
      </div>
    </main>
  );
}
