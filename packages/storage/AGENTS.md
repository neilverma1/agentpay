# Storage Package

## Overview

S3 compatible object storage client and presigned URL operations for local MinIO and cloud storage.

## Key files

| File                | Owns                                          |
| ------------------- | --------------------------------------------- |
| `src/client.ts`     | S3 client instance and bucket initialization  |
| `src/operations.ts` | Upload and presigned URL generation functions |

## Commands

```bash
# Build
pnpm --filter @workspace/storage build

# Test
pnpm --filter @workspace/storage test
```

## Conventions

- Inherits root Clean Architecture and strict typing rules.
- Storage operations validate bucket presence and keys through Zod schemas.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
