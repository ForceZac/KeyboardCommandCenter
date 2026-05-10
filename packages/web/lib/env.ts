/** Typed environment config — never read process.env directly outside this module. */
export const env = {
  /** Base URL for server-component API fetches (absolute URL required in RSC). */
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',

  // ─── Auth.js / NextAuth ───────────────────────────────────────────────────
  /** Must be set in .env.local — used to sign JWTs. */
  nextAuthSecret: process.env.NEXTAUTH_SECRET ?? '',
  /** Canonical URL of this deployment (e.g. https://keyboardcommandcenter.com). */
  nextAuthUrl: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  /** GitHub OAuth app credentials — create at github.com/settings/developers */
  githubId: process.env.GITHUB_ID ?? '',
  githubSecret: process.env.GITHUB_SECRET ?? '',
  /** Google OAuth app credentials — create at console.cloud.google.com */
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
} as const;
