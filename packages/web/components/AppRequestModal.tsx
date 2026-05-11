'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useSubmitAppRequest } from '@/hooks/useSubmitAppRequest';
import { useCategories } from '@/hooks/useCategories';
import { ApiError } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultAppName?: string;
}

const PLATFORMS = ['Windows', 'macOS', 'Linux'] as const;

export default function AppRequestModal({ open, onClose, defaultAppName = '' }: Props) {
  const { data: session } = useSession();
  const submitMutation = useSubmitAppRequest();
  const { data: categories } = useCategories();

  const [appName, setAppName] = useState(defaultAppName);
  const [website, setWebsite] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);

  useEffect(() => {
    if (open) setAppName(defaultAppName);
  }, [open, defaultAppName]);

  const togglePlatform = useCallback((p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }, []);

  const handleClose = useCallback(() => {
    if (submitMutation.isPending) return;
    setAppName('');
    setWebsite('');
    setCategoryId('');
    setPlatforms([]);
    submitMutation.reset();
    onClose();
  }, [onClose, submitMutation]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    await submitMutation.mutateAsync({
      appName: appName.trim(),
      website: website.trim() || null,
      categoryId: categoryId || null,
      platforms: platforms.length > 0 ? platforms : undefined,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Request an app
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {!session ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Sign in to request a new app.
              </p>
              <a
                href="/api/auth/signin"
                className="inline-block px-5 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Sign in
              </a>
            </div>
          ) : submitMutation.isSuccess ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">✓</div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                App request submitted!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                Thanks for the suggestion. An admin will review it soon.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* App name */}
              <div>
                <label
                  htmlFor="ar-appname"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  App name <span className="text-red-500">*</span>
                </label>
                <input
                  id="ar-appname"
                  type="text"
                  required
                  maxLength={100}
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="e.g. Blender"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Website URL */}
              <div>
                <label
                  htmlFor="ar-website"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Website URL
                  <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  id="ar-website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="e.g. https://www.blender.org"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Category */}
              <div>
                <label
                  htmlFor="ar-category"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Category
                  <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <select
                  id="ar-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a category…</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Platforms */}
              <fieldset>
                <legend className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Platforms
                  <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </legend>
                <div className="flex gap-4">
                  {PLATFORMS.map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={platforms.includes(p)}
                        onChange={() => togglePlatform(p)}
                        className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Error messages */}
              {submitMutation.isError && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
                  {submitMutation.error instanceof ApiError && submitMutation.error.status === 429
                    ? 'You\'ve reached the daily submission limit (20 per day). Try again tomorrow.'
                    : 'Something went wrong. Please try again.'}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitMutation.isPending || !appName.trim()}
                  className="flex-1 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {submitMutation.isPending ? 'Submitting…' : 'Request app'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitMutation.isPending}
                  className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
