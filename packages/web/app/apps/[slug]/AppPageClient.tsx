'use client';

import { useState, useMemo } from 'react';
import type { AppDetail } from '@kcc/core';
import { usePlatform } from '@/hooks/usePlatform';
import PlatformToggle from '@/components/PlatformToggle';
import ContextGroup from '@/components/ContextGroup';
import SubmitShortcutModal from '@/components/SubmitShortcutModal';

interface Props {
  app: AppDetail;
}

/**
 * AppPageClient — interactive shell for the app shortcut page.
 * Owns the platform toggle and in-app search filter.
 * Receives pre-fetched AppDetail from the server component parent.
 */
export default function AppPageClient({ app }: Props) {
  const [platform, setPlatform] = usePlatform();
  const [search, setSearch] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const { contexts } = app;

  // Filter contexts and their shortcuts client-side based on the search string.
  // useMemo ensures this only recomputes when search or contexts changes.
  const filteredContexts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contexts;

    const result: typeof contexts = {};
    for (const [ctx, shortcuts] of Object.entries(contexts)) {
      const matched = shortcuts.filter(
        (s) =>
          s.command.toLowerCase().includes(q) ||
          s.platforms.some((p) => p.keyCombo.toLowerCase().includes(q)),
      );
      if (matched.length > 0) result[ctx] = matched;
    }
    return result;
  }, [contexts, search]);

  const contextEntries = Object.entries(filteredContexts);
  const totalShortcuts = Object.values(contexts).reduce(
    (sum, s) => sum + s.length,
    0,
  );

  return (
    <div>
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <PlatformToggle platform={platform} onPlatformChange={setPlatform} />
        <div className="flex-1">
          <input
            type="search"
            placeholder="Search shortcuts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search shortcuts"
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setSubmitOpen(true)}
          className="px-3 py-1.5 text-sm rounded-lg border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 whitespace-nowrap"
        >
          + Submit a shortcut
        </button>
      </div>

      {/* Stats */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        {contextEntries.length === Object.keys(app.contexts).length
          ? `${totalShortcuts} shortcuts across ${contextEntries.length} context${contextEntries.length !== 1 ? 's' : ''}`
          : `${contextEntries.reduce((s, [, arr]) => s + arr.length, 0)} matching shortcuts`}
      </p>

      {contextEntries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          No shortcuts match &ldquo;{search}&rdquo;
        </p>
      ) : (
        contextEntries.map(([ctx, shortcuts]) => (
          <ContextGroup
            key={ctx}
            context={ctx}
            shortcuts={shortcuts}
            platform={platform}
            showFavoriteToggle
          />
        ))
      )}

      <SubmitShortcutModal
        appId={app.id}
        appName={app.name}
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
      />
    </div>
  );
}
