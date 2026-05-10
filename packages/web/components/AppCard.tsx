import Link from 'next/link';
import type { AppSummary } from '@kcc/core';

interface Props {
  app: AppSummary;
}

/**
 * AppCard — a tile in the category browse grid.
 * Shows app name, truncated description, and links to /apps/[slug].
 */
export default function AppCard({ app }: Props) {
  return (
    <Link
      href={`/apps/${app.slug}`}
      className="flex flex-col p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
        {app.name}
      </span>
      {app.description && (
        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
          {app.description}
        </span>
      )}
    </Link>
  );
}
