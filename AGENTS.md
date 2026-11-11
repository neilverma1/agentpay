# AgentPay

## Stack

- **Language / Runtime**: TypeScript 5+, Node.js 20+
- **Monorepo / Workspace**: Turborepo, pnpm
- **Framework**: Next.js 16 (App Router, React 19)
- **Database / ORM**: PostgreSQL, Drizzle ORM
- **Payment / AI**: @paypal/paypal-server-sdk, Vercel AI SDK (@ai-sdk/google)

## Build approach

- **Tracer Bullet**, vertical end to end slices, thin but complete through every layer

## Commands

```bash
# Install
pnpm install

# Dev server
pnpm dev

# Build
pnpm build

# Test
pnpm test

# Typecheck
pnpm check-types
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`.

## Rules

- Clean Architecture: domain has zero external imports; use cases orchestrate domain logic and interfaces; infrastructure implements interfaces.
- TypeScript strictness: strict types only, no any, strict null checks, and exhaustive matching.
- Folder by feature: colocate UI components, hooks, actions, and schemas by feature slice.
- Validate environment variables at startup and use consistent Result or AppError types for errors.
- UI accessibility baseline: WCAG AA compliance across interactive components.
- Conventional commits: use feat, fix, chore, docs prefixes.

## Git

- integration: on
- branch prefix: feat/
- commit: per-milestone

## Agent skills

- [modern-web-guidance](plugins/modern-web-guidance-plugin/skills/modern-web-guidance/): modern web development best practices, forms, and accessibility
- MCP servers: @paypal/mcp (recommended), @modelcontextprotocol/server-postgres (recommended)

## Context files

- [packages/agent/AGENTS.md](packages/agent/AGENTS.md): Core autonomous agent, catalog, policy, and PayPal settlement
- [apps/web/AGENTS.md](apps/web/AGENTS.md): Next.js web application and UI routes
- [packages/db/AGENTS.md](packages/db/AGENTS.md): PostgreSQL schema and Drizzle ORM migrations
- [packages/auth/AGENTS.md](packages/auth/AGENTS.md): Better Auth server and client integration
- [packages/ui/AGENTS.md](packages/ui/AGENTS.md): Shared React design system and Tailwind components
- [packages/storage/AGENTS.md](packages/storage/AGENTS.md): S3 compatible storage operations and client

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
