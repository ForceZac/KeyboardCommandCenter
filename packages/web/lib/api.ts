/**
 * Centralized API client for @kcc/web.
 * All API calls go through this module — never raw fetch in components.
 */
import type { SearchResult, CategorySummary, AppDetail, AppSummary } from '@kcc/core';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Search shortcuts by query string, optionally filtered to a platform slug. */
export function searchShortcuts(q: string, platform?: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q });
  if (platform) params.set('platform', platform);
  return apiFetch<SearchResult[]>(`/shortcuts/search?${params.toString()}`);
}

/** Fetch all categories with their application counts. */
export function fetchCategories(): Promise<CategorySummary[]> {
  return apiFetch<CategorySummary[]>('/categories');
}

/** Fetch full app detail including shortcuts grouped by context. */
export function fetchApp(slug: string): Promise<AppDetail> {
  return apiFetch<AppDetail>(`/apps/${encodeURIComponent(slug)}`);
}

/** Fetch all apps in a given category slug. */
export function fetchAppsByCategory(category: string): Promise<AppSummary[]> {
  return apiFetch<AppSummary[]>(`/apps?category=${encodeURIComponent(category)}`);
}
