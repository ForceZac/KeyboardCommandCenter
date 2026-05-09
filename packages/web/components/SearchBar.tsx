'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface Props {
  onQueryChange: (q: string) => void;
  isLoading?: boolean;
}

export default function SearchBar({ onQueryChange, isLoading }: Props) {
  const [inputValue, setInputValue] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (value === '') {
      // Propagate clear immediately so results hide without a 300ms lag
      onQueryChange('');
    } else {
      debounceTimer.current = setTimeout(() => onQueryChange(value), 300);
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        {isLoading ? (
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" aria-hidden />
        ) : (
          <Search className="w-5 h-5 text-gray-400" aria-hidden />
        )}
      </div>
      <input
        type="search"
        value={inputValue}
        onChange={handleChange}
        placeholder="Search shortcuts (e.g. undo, save, copy…)"
        aria-label="Search shortcuts"
        className="w-full py-3 pl-12 pr-4 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 placeholder-gray-400 dark:placeholder-gray-500"
      />
    </div>
  );
}
