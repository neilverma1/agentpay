# Web App

## Overview

Next.js 16 web application hosting the user dashboard, settings, auth flows, and API route handlers for agent transactions and storage.

## Key files

| File                                           | Owns                                             |
| ---------------------------------------------- | ------------------------------------------------ |
| `app/(app)/dashboard/page.tsx`                 | Main financial dashboard and live telemetry view |
| `app/api/auth/[...all]/route.ts`               | Better Auth route handlers                       |
| `app/api/v1/storage/presigned-upload/route.ts` | Presigned URL upload handler                     |

## Commands

```bash
# Dev
pnpm --filter web dev

# Build
pnpm --filter web build

# Lint
pnpm --filter web lint

# Test
pnpm --filter web test
```

## Conventions

- Inherits root Clean Architecture, strict typing, and folder by feature conventions.
- App Router pages and layouts use server components where feasible; interactive UI components declare "use client".
- Client forms use react-hook-form with Zod schema resolvers.

## Related specs

- [0001-stack-and-architecture](../../docs/specs/0001-stack-and-architecture.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
