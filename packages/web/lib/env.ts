/** Typed environment config — never read process.env directly outside this module. */
export const env = {
  /** Base URL for server-component API fetches (absolute URL required in RSC). */
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',
} as const;
