# Auth Package

## Overview

Authentication layer configuring Better Auth with the Drizzle ORM adapter, email verification, and two factor authentication support.

## Key files

| File                   | Owns                                                     |
| ---------------------- | -------------------------------------------------------- |
| `src/server.ts`        | Better Auth server configuration and plugin registration |
| `src/client.ts`        | Browser client authentication helpers                    |
| `src/next-handlers.ts` | Next.js API route integration handler                    |

## Commands

```bash
# Build
pnpm --filter @workspace/auth build

# Check types
pnpm --filter @workspace/auth check-types
```

## Conventions

- Inherits root Clean Architecture and strict typing rules.
- Exposes separate entrypoints for server, client, and route handlers.

## Related specs

- [0001-stack-and-architecture](../../docs/specs/0001-stack-and-architecture.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
