import { handlers } from '@/lib/auth';

// Re-export the Auth.js catch-all route handlers for the Next.js App Router.
// All /api/auth/* requests (OAuth redirects, callbacks, CSRF, etc.) are handled here.
export const { GET, POST } = handlers;
