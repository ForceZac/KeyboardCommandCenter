import type { ShortcutEntry, PlatformSlug } from '@kcc/core';
import KeyCombo from './KeyCombo';

interface Props {
  shortcut: ShortcutEntry;
  /** Currently selected platform. ShortcutRow falls back to first available if no binding exists. */
  platform: PlatformSlug;
  /** The context heading this row belongs to — used to suppress a redundant context badge. */
  groupContext: string;
}

/**
 * ShortcutRow — one row in the shortcut list.
 * Displays the command description and the KeyCombo for the selected platform.
 * If no binding exists for the selected platform, shows the first available with a note.
 */
export default function ShortcutRow({ shortcut, platform, groupContext }: Props) {
  const binding =
    shortcut.platforms.find((p) => p.platformSlug === platform) ??
    shortcut.platforms[0];

  const isFallback = binding && binding.platformSlug !== platform;

  return (
    <div className="flex items-start justify-between gap-4 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-200">{shortcut.command}</p>
        {/* Suppress context badge when it matches the enclosing group heading */}
        {shortcut.platforms[0] && isFallback && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            No {platform} binding — showing {binding.platformSlug}
          </p>
        )}
      </div>

      <div className="flex-shrink-0">
        {binding ? (
          <KeyCombo combo={binding.keyCombo} />
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">No binding</span>
        )}
      </div>
    </div>
  );
}
