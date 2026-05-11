'use client';

import { useState } from 'react';
import type { SearchResult } from '@kcc/core';
import ShortcutCard from './ShortcutCard';
import AppRequestModal from './AppRequestModal';

interface Props {
  results: SearchResult[];
  searchQuery?: string;
}

export default function SearchResults({ results, searchQuery = '' }: Props) {
  const [requestOpen, setRequestOpen] = useState(false);

  if (results.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          No shortcuts found. Try a different search term.
        </p>
        <button
          type="button"
          onClick={() => setRequestOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          Request this app
        </button>
        <AppRequestModal
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          defaultAppName={searchQuery}
        />
      </div>
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
