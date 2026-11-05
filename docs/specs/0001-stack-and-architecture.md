# 0001. Stack and architecture

**Date**: 2026-11-04
**Status**: Accepted

## Summary

This decision establishes the foundational architecture for AgentPay as a Turborepo monorepo scaffolded using Stackbase (`github.com/stackbase-labs/stackbase`), featuring Next.js 16 App Router, Drizzle ORM, and PostgreSQL. It separates concerns into clean workspace packages for the web dashboard, shared database schemas, and backend agent services while keeping build caching, type sharing, and Docker orchestration unified. While Stackbase defaults to Prisma ORM, we replace the query layer with Drizzle ORM to keep SQL queries predictable and memory usage low.

## Context

AgentPay bridges autonomous artificial intelligence agents and PayPal payments with programmable spend guardrails and human in the loop approval controls. The system needs to support four distinct workloads:

1. A responsive financial dashboard for human operators, displaying transaction telemetry, real time audit logs, and one click payment approval prompts.
2. A server runtime to run autonomous buyer agents using the Vercel AI SDK and Google Gemini for semantic policy evaluation and tool execution.
3. A secure payment gateway integration that creates PayPal sandbox orders, captures payments, and verifies cryptographic webhook signatures.
4. A persistence layer that records budget policies, agent run histories, transaction logs, and approval requests with strict relational consistency.

Stackbase provides a preconfigured full stack monorepo framework powered by Turborepo with Next.js 16 and Docker compose. While Stackbase includes Prisma ORM out of the box, our domain demands predictable, lightweight SQL performance without an opaque query engine binary. Configuring Drizzle ORM within the database package gives us full type safety and explicit SQL control while retaining the rest of the Stackbase monorepo strengths.

## Options considered

### Option 1: Turborepo monorepo scaffolded with Stackbase, Next.js 16, Drizzle ORM, and PostgreSQL

A full stack monorepo orchestrated by Turborepo and scaffolded via Stackbase (`pnpm dlx stackbase@latest init`). Next.js 16 App Router powers the web client, Drizzle ORM manages the PostgreSQL database in a shared package, and the official PayPal server SDK and Vercel AI SDK execute payment and agent tasks.

**Pros**:

- Preconfigured monorepo boilerplate from Stackbase eliminates tedious manual workspace wiring.
- Stackbase provides Next.js 16 out of the box with modern React 19 capabilities and Turbopack.
- Strict physical separation between client dashboard, shared database schema, and server execution packages.
- Shared TypeScript types across workspace packages without code duplication.
- Out of the box Docker orchestration for local PostgreSQL services.
- Replacing Prisma with Drizzle ORM yields lighter bundle size, faster cold starts, and SQL aligned query building.

**Cons**:

- Monorepos require understanding workspace dependency declarations and pnpm filters (`pnpm --filter`).
- Requires swapping Stackbase default Prisma package for Drizzle ORM during the initial scaffold step.

### Option 2: Stackbase monorepo keeping Prisma ORM as scaffolded

Use Stackbase exactly as generated with Prisma ORM instead of swapping to Drizzle ORM.

**Pros**:

- Zero adjustments needed to the generated Stackbase database package.
- Familiar Prisma schema DSL and Prisma Studio browser GUI.

**Cons**:

- Prisma query engine adds binary overhead and memory usage in serverless or lightweight containers.
- Drizzle provides more explicit SQL query composition, preferable for transaction ledgers and financial audit records.

### Option 3: Single package Next.js application without monorepo orchestration

A single Next.js project where all database models, agent loops, API routes, and React components reside in a single flat package with internal path aliases.

**Pros**:

- Only one package manifest and one `tsconfig.json` to manage.

**Cons**:

- Lacks clean architectural package boundaries as the codebase grows.
- Loses Stackbase preconfigured Docker services and Turborepo caching benefits.

## Decision

**Chosen option**: Option 1: Turborepo monorepo scaffolded with Stackbase, Next.js 16, Drizzle ORM, and PostgreSQL.

We will bootstrap AgentPay using Stackbase (`pnpm dlx stackbase@latest init`), giving us a Turborepo workspace with Next.js 16 for the web dashboard, swap Prisma for Drizzle ORM for PostgreSQL persistence, and use `@paypal/paypal-server-sdk` for payment operations, `@ai-sdk/google` with Google Gemini for agent reasoning, and Tailwind CSS with shadcn/ui and AG Grid Community for telemetry views.

**Implementation skills**: `modern-web-guidance` (`plugins/modern-web-guidance-plugin/skills/modern-web-guidance/`)

## Rationale

Stackbase provides a battle tested starting point that removes hours of initial monorepo configuration (basis: monorepo framework for rapid production setup). It gives the project clean boundaries between user interface code and server execution while Turborepo ensures fast builds and deterministic script execution. Stackbase already configures Next.js 16, allowing us to leverage the latest React 19 compiler optimizations and streaming server components.

Replacing Prisma with Drizzle ORM in `packages/db` gives us lightweight, type safe SQL queries with zero hidden magic, perfectly suited for financial records and audit ledgers (basis: relational database with type safe query builder). Using Server Sent Events from Next.js route handlers streams agent reasoning and approval notifications directly to the browser without requiring a standalone WebSocket broker.

## Proposed stack

| Layer                     | Choice                                     | Reason                                                                                       |
| ------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Monorepo Orchestration    | Turborepo (via Stackbase)                  | Fast workspace build pipelines, remote caching, and clean package boundaries.                |
| Scaffold Framework        | Stackbase (`stackbase-labs/stackbase`)     | Production ready monorepo foundation with preconfigured Docker, Next.js 16, and scripts.     |
| Language                  | TypeScript 5+                              | End to end type safety across shared database packages, agent tools, and web UI.             |
| Application Framework     | Next.js 16 (App Router, React 19)          | Modern server and client environment with built in API route handlers and streaming.         |
| Primary Database          | PostgreSQL                                 | Proven ACID relational database supporting strict financial ledger data and JSON attributes. |
| ORM and Migrations        | Drizzle ORM (`drizzle-orm`, `drizzle-kit`) | Lightweight type safe SQL query builder replacing Prisma for transparent SQL control.        |
| Payment SDK               | `@paypal/paypal-server-sdk`                | Official modern PayPal server SDK handling OAuth tokens, order creation, and capture.        |
| Agent Engine              | Vercel AI SDK (`ai`, `@ai-sdk/google`)     | Native streaming and tool execution loop powered by Google Gemini 2.5 Flash.                 |
| UI Components and Styling | Tailwind CSS, shadcn/ui, Radix UI          | Accessible, clean financial dashboard styling with complete component customization.         |
| Telemetry Grid            | AG Grid Community (`ag-grid-react`)        | Enterprise grade high density data grid for sorting, filtering, and live audit telemetry.    |
| Real time Telemetry       | Server Sent Events (SSE)                   | Native HTTP streaming for agent logs and approval requests without external broker state.    |
| Container Orchestration   | Docker and Docker Compose (via Stackbase)  | Out of the box local PostgreSQL service and reproducible environment setup.                  |
| Package Manager           | pnpm                                       | Fast, disk efficient package manager with native workspace protocol support.                 |

## Consequences

**Positive**:

- Stackbase provides an immediate, working monorepo scaffold with Docker and Next.js 16 ready on day one.
- Turborepo caches builds and tests across packages, speeding up verification loops.
- Clear separation of concerns between web presentation (`apps/web`), database schemas (`packages/db`), and shared utilities.
- Drizzle ORM reduces runtime memory overhead compared to Prisma and makes SQL transactions explicit.

**Negative / tradeoffs**:

- Developers must use pnpm workspace filtering syntax (such as `pnpm --filter web dev`).
- The initial scaffold step requires swapping out the default Prisma files for Drizzle in `packages/db`.

**Neutral**:

- The project adopts Stackbase folder naming conventions across `apps/` and `packages/`.

## Follow-up

- [x] Scaffold the project using `pnpm dlx stackbase@latest init`.
- [x] Swap Prisma for Drizzle ORM in the database workspace package.
- [ ] Connect PostgreSQL MCP server for AI assisted database inspection during subsequent feature slices.

## References

**Project sources**:

- `docs/scope/scope.md`: Feature 1 specification and Tracer Bullet build approach.
- `README.md`: AgentPay project vision and PayPal AI Hackathon requirements.

**Practices & standards**:

- Monorepo architecture for shared typing and modular package boundaries.
- Relational data model for financial transactions and audit logging.
- Server Sent Events for unidirectional telemetry and log streaming.

**Links**:

- Stackbase Monorepo Framework: <https://github.com/stackbase-labs/stackbase>
- PayPal Server SDK on npm: <https://www.npmjs.com/package/@paypal/paypal-server-sdk>
- Model Context Protocol PostgreSQL Server: <https://github.com/modelcontextprotocol/servers-archived/tree/main/src/postgres>
