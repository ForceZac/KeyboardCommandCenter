import type { Metadata } from 'next';
import { env } from '@/lib/env';
import type { AppSummary, CategorySummary } from '@kcc/core';
import AppCard from '@/components/AppCard';
import Link from 'next/link';

interface Props {
  params: { slug: string };
}

async function getCategory(slug: string): Promise<CategorySummary | null> {
  try {
    const res = await fetch(`${env.baseUrl}/api/categories`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const categories = (await res.json()) as CategorySummary[];
    return categories.find((c) => c.slug === slug) ?? null;
  } catch {
    return null;
  }
}

async function getApps(category: string): Promise<AppSummary[]> {
  try {
    const res = await fetch(
      `${env.baseUrl}/api/apps?category=${encodeURIComponent(category)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    return (await res.json()) as AppSummary[];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategory(params.slug);
  const name = category?.name ?? params.slug;
  return {
    title: `${name} shortcuts — Keyboard Command Center`,
    description: `Browse all ${name} apps and their keyboard shortcuts in one place.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const [category, apps] = await Promise.all([
    getCategory(params.slug),
    getApps(params.slug),
  ]);

  const categoryName = category?.name ?? params.slug;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav aria-label="breadcrumb" className="flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <Link
          href="/"
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Home
        </Link>
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {categoryName}
        </span>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {categoryName}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {apps.length} app{apps.length !== 1 ? 's' : ''}
          </p>
        </div>

        {apps.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No apps found in this category.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
