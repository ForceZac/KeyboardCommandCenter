import { env } from '@/lib/env';
import type { CategorySummary } from '@kcc/core';
import SearchSection from '@/components/SearchSection';
import CategoryGrid from '@/components/CategoryGrid';

export default async function HomePage() {
  // Fetch categories server-side so the grid is immediately visible on load,
  // avoiding a client-side waterfall for content that rarely changes.
  let categories: CategorySummary[] = [];
  try {
    const res = await fetch(`${env.baseUrl}/api/categories`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      categories = (await res.json()) as CategorySummary[];
    }
  } catch {
    // API unavailable (e.g. TASK-0003 not merged yet) — render with empty grid
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Find any shortcut, instantly.
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Search 10,000+ shortcuts across 50+ apps.
          </p>
        </div>

        <SearchSection />

        {categories.length > 0 && (
          <div className="mt-16">
            <CategoryGrid categories={categories} />
          </div>
        )}
      </main>
    </div>
  );
}
