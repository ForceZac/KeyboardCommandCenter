import type { ShortcutEntry, PlatformSlug } from '@kcc/core';
import ShortcutRow from './ShortcutRow';

interface Props {
  context: string;
  shortcuts: ShortcutEntry[];
  platform: PlatformSlug;
}

/**
 * ContextGroup — a labelled section of shortcuts sharing the same context/scope.
 * Renders the context name as a heading followed by ShortcutRow items.
 */
export default function ContextGroup({ context, shortcuts, platform }: Props) {
  return (
    <section className="mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 px-3">
        {context}
      </h3>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {shortcuts.map((shortcut) => (
          <ShortcutRow
            key={shortcut.id}
            shortcut={shortcut}
            platform={platform}
          />
        ))}
      </div>
    </section>
  );
}
