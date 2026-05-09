# KBCommandCenter

A comprehensive keyboard shortcut database and background utility for power users.

## Running integration tests

Integration tests require a live PostgreSQL instance. Use the provided Docker Compose file:

```bash
# Start PostgreSQL
docker compose up -d

# Apply migrations
DATABASE_URL="postgresql://kcc:kcc@localhost:5432/kcc_test" npx prisma migrate deploy -w database

# Run database integration tests
DATABASE_URL="postgresql://kcc:kcc@localhost:5432/kcc_test" npm test -w database

# Tear down
docker compose down
```
