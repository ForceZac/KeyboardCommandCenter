'use client';

import { useState } from 'react';
import SearchBar from './SearchBar';
import SearchResults from './SearchResults';
import { useSearch } from '@/hooks/useSearch';

/**
 * Client-side wrapper that coordinates SearchBar + SearchResults.
 * Holds the debounced query state so both children share it without prop drilling
 * through the server component parent (page.tsx).
 */
export default function SearchSection() {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useSearch(query);

  return (
    <div className="w-full">
      <SearchBar onQueryChange={setQuery} isLoading={isLoading} />

      {query.trim().length >= 2 && results !== undefined && (
        <div className="mt-4 max-w-2xl mx-auto">
          <SearchResults results={results} searchQuery={query} />
        </div>
      )}
    </div>
  );
}
