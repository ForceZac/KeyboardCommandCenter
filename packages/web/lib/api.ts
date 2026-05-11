/**
 * Centralized API client for @kcc/web.
 * All API calls go through this module — never raw fetch in components.
 */
import type {
  SearchResult,
  CategorySummary,
  AppDetail,
  AppSummary,
  FavoriteEntry,
  CollectionSummary,
} from '@kcc/core';

const API_BASE = '/api';

export class ApiError extends Error {
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

async function apiMutate(
  path: string,
  method: 'POST' | 'DELETE' | 'PATCH',
  body?: unknown,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
      : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || res.statusText);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Shortcut browse / search
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

/** GET /api/favorites — shortcuts in the user's default "My Favorites" collection. */
export function fetchFavorites(): Promise<FavoriteEntry[]> {
  return apiFetch<FavoriteEntry[]>('/favorites');
}

/** POST /api/favorites — add a shortcut to the default collection. */
export async function addFavorite(shortcutId: string): Promise<void> {
  await apiMutate('/favorites', 'POST', { shortcutId });
}

/** DELETE /api/favorites/:shortcutId — remove a shortcut from the default collection. */
export async function removeFavorite(shortcutId: string): Promise<void> {
  await apiMutate(`/favorites/${encodeURIComponent(shortcutId)}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

/** GET /api/collections — all user collections with shortcut counts. */
export function fetchCollections(): Promise<CollectionSummary[]> {
  return apiFetch<CollectionSummary[]>('/collections');
}

/** POST /api/collections — create a new named collection. */
export function createCollection(
  name: string,
  description?: string,
): Promise<CollectionSummary> {
  return apiMutate('/collections', 'POST', { name, description }).then(
    (res) => res.json() as Promise<CollectionSummary>,
  );
}

/** PATCH /api/collections/:id — rename or update description. */
export function updateCollection(
  id: string,
  patch: { name?: string; description?: string },
): Promise<CollectionSummary> {
  return apiMutate(`/collections/${encodeURIComponent(id)}`, 'PATCH', patch).then(
    (res) => res.json() as Promise<CollectionSummary>,
  );
}

/** DELETE /api/collections/:id — delete a named collection. */
export async function deleteCollection(id: string): Promise<void> {
  await apiMutate(`/collections/${encodeURIComponent(id)}`, 'DELETE');
}

/** GET /api/collections/:id/shortcuts — shortcuts in a specific collection. */
export function fetchCollectionShortcuts(id: string): Promise<FavoriteEntry[]> {
  return apiFetch<FavoriteEntry[]>(`/collections/${encodeURIComponent(id)}/shortcuts`);
}

/** POST /api/collections/:id/shortcuts — add a shortcut to a specific collection. */
export async function addToCollection(
  collectionId: string,
  shortcutId: string,
): Promise<void> {
  await apiMutate(
    `/collections/${encodeURIComponent(collectionId)}/shortcuts`,
    'POST',
    { shortcutId },
  );
}

/** DELETE /api/collections/:id/shortcuts/:shortcutId — remove shortcut from a specific collection. */
export async function removeFromCollection(
  collectionId: string,
  shortcutId: string,
): Promise<void> {
  await apiMutate(
    `/collections/${encodeURIComponent(collectionId)}/shortcuts/${encodeURIComponent(shortcutId)}`,
    'DELETE',
  );
}
