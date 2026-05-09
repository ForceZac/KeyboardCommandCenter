import Link from 'next/link';
import type { SearchResult } from '@kcc/core';
import PlatformBadge from './PlatformBadge';

interface Props {
  result: SearchResult;
}

export default function ShortcutCard({ result }: Props) {
  return (
    <article className="flex items-start justify-between gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {result.command}
        </p>
        {result.context && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{result.context}</p>
        )}
        <Link
          href={`/apps/${result.appSlug}`}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1 inline-block"
        >
          {result.appName}
        </Link>
      </div>

      <div className="flex-shrink-0 space-y-1 text-right">
        {result.platforms.map((binding) => (
          <div key={binding.platformSlug} className="flex items-center gap-1.5 justify-end">
            <PlatformBadge platform={binding.platformSlug} />
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded whitespace-nowrap">
              {binding.keyCombo}
            </kbd>
          </div>
        ))}
      </div>
    </article>
  );
}
