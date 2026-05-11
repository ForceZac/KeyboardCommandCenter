import type { ShortcutEntry, PlatformSlug } from '@kcc/core';
import dynamic from 'next/dynamic';
import KeyCombo from './KeyCombo';

// Lazy-loaded: FavoriteToggle depends on TanStack Query + session — not needed on
// the initial server render or in contexts where showFavoriteToggle is false.
const FavoriteToggle = dynamic(() => import('./FavoriteToggle'), { ssr: false });

interface Props {
  shortcut: ShortcutEntry;
  /** Currently selected platform. ShortcutRow falls back to first available if no binding exists. */
  platform: PlatformSlug;
  /** When true, renders the FavoriteToggle heart icon on hover. Default: false. */
  showFavoriteToggle?: boolean;
}

/**
 * ShortcutRow — one row in the shortcut list.
 * Displays the command description and the KeyCombo for the selected platform.
 * If no binding exists for the selected platform, shows the first available with a note.
 */
export default function ShortcutRow({ shortcut, platform, showFavoriteToggle = false }: Props) {
  const binding =
    shortcut.platforms.find((p) => p.platformSlug === platform) ??
    shortcut.platforms[0];

  const isFallback = binding && binding.platformSlug !== platform;

  return (
    <div className="group flex items-start justify-between gap-4 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-200">{shortcut.command}</p>
        {/* Suppress context badge when it matches the enclosing group heading */}
        {shortcut.platforms[0] && isFallback && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            No {platform} binding — showing {binding.platformSlug}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {showFavoriteToggle && (
          <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <FavoriteToggle shortcutId={shortcut.id} />
          </span>
        )}
        {binding ? (
          <KeyCombo combo={binding.keyCombo} />
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">No binding</span>
        )}
      </div>
    </div>
  );
}
