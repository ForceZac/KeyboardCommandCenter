import Link from 'next/link';
import type { CategorySummary } from '@kcc/core';

interface Props {
  categories: CategorySummary[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  creative: '🎨',
  'developer-tools': '💻',
  productivity: '⚡',
  gaming: '🎮',
  music: '🎵',
  system: '⚙️',
  browsers: '🌐',
};

export default function CategoryGrid({ categories }: Props) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Browse by Category
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/categories/${cat.slug}`}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
          >
            <span className="text-2xl mb-2" role="img" aria-label={cat.name}>
              {CATEGORY_EMOJI[cat.slug] ?? '📁'}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-center">
              {cat.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {cat.appCount} apps
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
