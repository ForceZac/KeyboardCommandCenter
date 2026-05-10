import type { Metadata } from 'next';
import { env } from '@/lib/env';
import type { AppDetail } from '@kcc/core';
import AppPageClient from './AppPageClient';
import Link from 'next/link';

interface Props {
  params: { slug: string };
}

async function getAppDetail(slug: string): Promise<AppDetail | null> {
  try {
    const res = await fetch(`${env.baseUrl}/api/apps/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as AppDetail;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const app = await getAppDetail(params.slug);
  const name = app?.name ?? params.slug;
  return {
    title: `${name} keyboard shortcuts — Keyboard Command Center`,
    description:
      app?.description ??
      `Complete list of ${name} keyboard shortcuts for Windows, Mac, and Linux.`,
  };
}

export default async function AppPage({ params }: Props) {
  const app = await getAppDetail(params.slug);

  if (!app) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 dark:text-gray-400">App not found.</p>
        <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm">
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav aria-label="breadcrumb" className="flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <Link
          href={`/categories/${app.categorySlug}`}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Back
        </Link>
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{app.name}</span>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {app.description && (
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">{app.description}</p>
        )}
        {/* Interactive shell owns platform toggle, search filter, and context groups */}
        <AppPageClient app={app} />
      </main>
    </div>
  );
}
