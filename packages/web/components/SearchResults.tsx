'use client';

import type { SearchResult } from '@kcc/core';
import ShortcutCard from './ShortcutCard';

interface Props {
  results: SearchResult[];
}

export default function SearchResults({ results }: Props) {
  if (results.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
        No shortcuts found. Try a different search term.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((result) => (
        <ShortcutCard key={result.id} result={result} />
      ))}
    </div>
  );
}
