# Rationale: Core data model

## Context

AgentPay coordinates autonomous software agents that execute purchases using PayPal on behalf of human operators. To ensure financial safety, agents must never operate with unchecked authority. The persistence architecture must support strict spending boundaries, category restrictions, and conditional pauses for human review while maintaining an immutable audit history for every action taken.

Several technical forces shape this design:

First, currency representation must be exact. Floating point calculations in financial systems introduce subtle precision bugs over time. Storing values as integer cents (one dollar equals 100 cents) provides arithmetic safety across all budget calculations, threshold comparisons, and PayPal order captures.

Second, agent autonomy requires deterministic guardrails. Each agent needs configurable spending rules, including daily transaction ceilings, single purchase thresholds that trigger manual approval, and category allowlists or blocklists. Because spending limits apply over rolling daily intervals, the data layer must provide verifiable ledger sums rather than relying on mutable counters that drift out of sync after partial failures.

Third, state transitions across agent reasoning, user approvals, and payment provider execution must be traceable. If PayPal rejects an order, a network call times out, or a user denies a purchase, the system must retain the purchase intent, the agent reasoning log, and the corresponding state change.

Fourth, database schemas reside in the shared database package (`packages/db`) and must integrate cleanly with the existing user table from Better Auth. Monorepo applications, including the Next.js web application and background agent workers, depend on type safe Drizzle schemas and Zod validation parsers exported from this single package.

## Options considered

### Option 1: Relational PostgreSQL tables with Drizzle ORM, UUID identifiers, integer cents, and JSONB policy arrays

A normalized relational schema in `packages/db` with five dedicated tables. Primary keys use PostgreSQL random UUID identifiers. Monetary values are stored as integer cents. Core threshold limits reside in dedicated integer columns, while merchant category allowlists, blocklists, and agent reasoning traces use JSONB columns. Status fields use text columns constrained by TypeScript string unions and Zod schemas.

**Pros**:

- Full relational integrity with foreign keys guarantees orphan records cannot exist.
- Integer cents eliminate floating point rounding errors during policy calculations and ledger summaries.
- JSONB columns provide flexibility for complex reasoning steps and category filters without extra join overhead.
- Text status columns with TypeScript unions avoid PostgreSQL enum migration locks when introducing new lifecycle states.
- UUID identifiers provide collision free IDs across distributed client and server operations.

**Cons**:

- Integer cents require unit conversion to decimal strings when calling PayPal APIs.
- Rolling daily limit checks require dynamic SQL aggregation queries over recent transactions.

### Option 2: Document style JSON state per agent with embedded policies and transaction logs

Store an agent record with an embedded JSON document holding its policies, active intents, and historical transaction log.

**Pros**:

- Single table query returns all agent context in one read operation.
- Easy to add arbitrary metadata without schema migrations.

**Cons**:

- Concurrency conflicts occur when multiple transactions or approvals modify the agent document simultaneously.
- Summing daily expenditures across all agents requires expensive table scans or unindexed JSON unnesting.
- Violates first normal form and compromises financial audit guarantees.

### Option 3: Prisma ORM with native PostgreSQL enums and numeric decimal columns

Retain Prisma schemas with native PostgreSQL enum types for lifecycle statuses and `numeric(12, 2)` columns for financial values.

**Pros**:

- Database engine strictly enforces enum values directly at the SQL layer.
- Decimal values match decimal input strings without integer multiplication.

**Cons**:

- Prisma query engine adds binary overhead and slower cold starts compared to Drizzle ORM.
- Altering native PostgreSQL enums in production migrations requires manual SQL scripts or downtime.
- Floating decimals remain prone to precision mismatches across different JavaScript runtime libraries.

## Rationale

Option 1 provides the exact balance of transactional safety, relational integrity, and developer agility needed for AgentPay. Integer cents prevent catastrophic rounding errors in financial transactions (basis: currency representation in financial systems). Using Drizzle ORM in `packages/db` maintains explicit SQL control and zero binary overhead (basis: project stack decision in spec 0001).

Using text columns paired with exported TypeScript const arrays and Zod schemas allows future lifecycle states (such as dispute handling or partial captures) to be added without dangerous database migration locks (basis: schema evolution patterns). Storing reasoning traces and category rules as JSONB gives AI agent tools native flexibility while preserving strict relational foreign keys between agents, intents, approvals, and transactions (basis: hybrid relational and document patterns in PostgreSQL).

## References

**Project sources**:

- `AGENTS.md`: Stack definitions and Tracer Bullet build rules.
- `docs/specs/0001-stack-and-architecture.md`: Turborepo monorepo with Drizzle ORM and PostgreSQL.
- `docs/scope/scope.md`: Feature 3 acceptance goals and feature roadmap.
- `packages/db/src/schema/auth.ts`: Better Auth user table schema.

**Practices & standards**:

- Integer currency representation for financial arithmetic safety.
- Idempotency keys for payment and state transition operations.
- Application layer tenant scoping for secure multi user access.
