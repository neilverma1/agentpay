# Database Package

## Overview

Persistence package containing the PostgreSQL connection pool, Drizzle ORM schemas, and database migration scripts.

## Key files

| File                 | Owns                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| `src/schema/auth.ts` | Better Auth tables (user, session, account, verification, two_factor) |
| `src/client.ts`      | Node pg Pool and Drizzle client instance                              |
| `drizzle.config.ts`  | Drizzle Kit migration configuration                                   |

## Commands

```bash
# Generate migrations
pnpm --filter @workspace/db db:generate

# Run migrations
pnpm --filter @workspace/db db:migrate

# Open Drizzle Studio
pnpm --filter @workspace/db studio
```

## Conventions

- Inherits root Clean Architecture and strict typing rules.
- Schemas are defined in `src/schema/` with export in `src/index.ts`.
- Migrations are versioned and stored in `drizzle/`.

## Related specs

- [0001-stack-and-architecture](../../docs/specs/0001-stack-and-architecture.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
