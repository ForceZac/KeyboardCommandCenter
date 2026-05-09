# Backend Standards

_These are the backend coding standards the Reviewer enforces and the Developer follows._

## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express (API server for shortcut database)
- **ORM:** Prisma (PostgreSQL)
- **Auth:** NextAuth.js (optional accounts for sync/favorites)
- **Error tracking:** Sentry
- **Testing:** Vitest + Playwright

## Controller / route patterns

- Thin controllers — validate input, call service, return response. No business logic in route handlers.

## Service / interactor shapes

- One service per domain (ShortcutService, AppService, SearchService). Stateless, composable. Services own their Prisma queries.

## Query patterns

- Prisma ORM for all queries. Raw SQL only for full-text search optimizations. No repository layer — services call Prisma directly.

## Error handling

- Custom AppError class with code, message, statusCode. Errors caught at controller boundary by global error middleware. All errors logged to Sentry in production.

## Testing

- Vitest for unit tests. Integration tests hit a real test database (Docker Compose postgres). Mock only external services (email, analytics). Seed data via Prisma fixtures.
