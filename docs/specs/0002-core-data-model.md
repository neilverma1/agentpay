# 0002. Core data model

**Date**: 2026-11-05
**Status**: Proposed

## Summary

This specification establishes the core persistence schema for AgentPay in the shared database package. It defines relational tables for autonomous agents, spending policies, purchase intents, approval requests, and financial transactions using Drizzle ORM on PostgreSQL. Storing monetary values as integer cents and tracking spending via ledger queries prevents rounding errors and ensures reliable budget enforcement before payment execution.

## Context

AgentPay coordinates autonomous software agents that execute purchases using PayPal on behalf of human operators. To ensure financial safety, agents must never operate with unchecked authority. The persistence architecture must support strict spending boundaries, category restrictions, and conditional pauses for human review while maintaining an immutable audit history for every action taken.

Several technical forces shape this design:

First, currency representation must be exact. Floating point calculations in financial systems introduce subtle precision bugs over time. Storing values as integer cents (one dollar equals 100 cents) provides arithmetic safety across all budget calculations, threshold comparisons, and PayPal order captures.

Second, agent autonomy requires deterministic guardrails. Each agent needs configurable spending rules, including daily transaction ceilings, single purchase thresholds that trigger manual approval, and category allowlists or blocklists. Because spending limits apply over rolling daily intervals, the data layer must provide verifiable ledger sums rather than relying on mutable counters that drift out of sync after partial failures.

Third, state transitions across agent reasoning, user approvals, and payment provider execution must be traceable. If PayPal rejects an order, a network call times out, or a user denies a purchase, the system must retain the purchase intent, the agent reasoning log, and the corresponding state change.

Fourth, database schemas reside in the shared database package (`packages/db`) and must integrate cleanly with the existing user table from Better Auth. Monorepo applications, including the Next.js web application and background agent workers, depend on type safe Drizzle schemas and Zod validation parsers exported from this single package.

## Requirements

**User stories**:

- As a platform user, I want to create and configure autonomous agents with custom daily limits and approval thresholds so that my agents cannot overspend without my oversight.
- As a buyer agent, I want to evaluate my assigned budget policy against purchase intents so that I know whether to proceed autonomously or pause for human approval.
- As a human operator, I want to review pending approval requests with full agent reasoning and rule trigger context so that I can safely approve or reject high value transactions.
- As an auditor, I want an immutable record of all completed, rejected, and failed transactions linked to PayPal order and capture identifiers so that financial activity is verifiable.

**Acceptance criteria**:

- **AC-1**: The schema defines relational tables for `agent`, `agent_policy`, `purchase_intent`, `approval_request`, and `transaction` in `packages/db/src/schema/` with foreign key relationships referencing the `user` table.
- **AC-2**: All financial amounts, including spending limits, thresholds, and captured amounts, are stored as non negative integer cents in `integer` columns with currency codes defaulting to `USD`.
- **AC-3**: Agent policies enforce a one to one relationship with agents and support daily spend caps, single transaction thresholds, human approval trigger limits, and JSON array category lists.
- **AC-4**: Purchase intents record the full agent reasoning log as structured JSON alongside an idempotency key to prevent duplicate processing on retries.
- **AC-5**: Approval requests capture the triggered policy rule, trigger details, reviewer identity, review status, and timestamps for auditability.
- **AC-6**: Transactions store unique PayPal order and capture identifiers, actual captured amounts, raw provider response payloads, and capture timestamps while preventing cascade deletion when agents are removed.
- **AC-7**: All entity statuses are typed using TypeScript string const unions and validated via exported Zod schemas.

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

## Decision

**Chosen option**: Option 1: Relational PostgreSQL tables with Drizzle ORM, UUID identifiers, integer cents, and JSONB policy arrays.

We will implement the core data model in `packages/db` across five new relational tables (`agent`, `agent_policy`, `purchase_intent`, `approval_request`, and `transaction`), using UUID primary keys, integer cents for monetary calculations, text status fields validated by Zod, and Drizzle ORM definitions exported alongside generated Zod schemas.

**Implementation skills**: `modern-web-guidance` (`plugins/modern-web-guidance-plugin/skills/modern-web-guidance/`)

## Rationale

Option 1 provides the exact balance of transactional safety, relational integrity, and developer agility needed for AgentPay. Integer cents prevent catastrophic rounding errors in financial transactions (basis: currency representation in financial systems). Using Drizzle ORM in `packages/db` maintains explicit SQL control and zero binary overhead (basis: project stack decision in spec 0001).

Using text columns paired with exported TypeScript const arrays and Zod schemas allows future lifecycle states (such as dispute handling or partial captures) to be added without dangerous database migration locks (basis: schema evolution patterns). Storing reasoning traces and category rules as JSONB gives AI agent tools native flexibility while preserving strict relational foreign keys between agents, intents, approvals, and transactions (basis: hybrid relational and document patterns in PostgreSQL).

## Feature design

**Data model sketch**:

```txt
user (Better Auth)
  id: text (PK)
  name: text
  email: text
  ...
  │
  ├──< agent
  │      id: uuid (PK)
  │      user_id: text (FK -> user.id, cascade delete)
  │      name: text
  │      description: text (nullable)
  │      model: text
  │      status: text ('active' | 'frozen' | 'archived')
  │      created_at: timestamp with time zone
  │      updated_at: timestamp with time zone
  │      │
  │      ├──1:1 agent_policy
  │      │        id: uuid (PK)
  │      │        agent_id: uuid (FK -> agent.id, unique, cascade delete)
  │      │        max_daily_spend_cents: integer
  │      │        single_transaction_limit_cents: integer
  │      │        require_approval_above_cents: integer
  │      │        allowed_merchant_categories: jsonb (string[])
  │      │        blocked_merchant_categories: jsonb (string[])
  │      │        currency: text (default 'USD')
  │      │        created_at: timestamp with time zone
  │      │        updated_at: timestamp with time zone
  │      │
  │      └──< purchase_intent
  │             id: uuid (PK)
  │             agent_id: uuid (FK -> agent.id, cascade delete)
  │             user_id: text (FK -> user.id, cascade delete)
  │             idempotency_key: text (unique)
  │             prompt: text
  │             item_description: text
  │             merchant_name: text
  │             merchant_category: text (nullable)
  │             estimated_amount_cents: integer
  │             currency: text (default 'USD')
  │             status: text ('pending' | 'evaluating_policy' | 'requires_approval' | 'approved' | 'executing_payment' | 'completed' | 'rejected' | 'failed')
  │             reasoning_log: jsonb (structured step log)
  │             rejection_reason: text (nullable)
  │             created_at: timestamp with time zone
  │             updated_at: timestamp with time zone
  │             │
  │             ├──1:1 approval_request (optional, when policy trips)
  │             │        id: uuid (PK)
  │             │        purchase_intent_id: uuid (FK -> purchase_intent.id, unique, cascade delete)
  │             │        agent_id: uuid (FK -> agent.id, cascade delete)
  │             │        reviewer_id: text (FK -> user.id, set null on delete, nullable)
  │             │        status: text ('pending' | 'approved' | 'rejected' | 'expired')
  │             │        rule_triggered: text
  │             │        trigger_details: jsonb
  │             │        notes: text (nullable)
  │             │        reviewed_at: timestamp with time zone (nullable)
  │             │        created_at: timestamp with time zone
  │             │        updated_at: timestamp with time zone
  │             │
  │             └──1:1 transaction (when payment initiated)
  │                      id: uuid (PK)
  │                      purchase_intent_id: uuid (FK -> purchase_intent.id, unique, restrict delete)
  │                      agent_id: uuid (FK -> agent.id, restrict delete)
  │                      user_id: text (FK -> user.id, restrict delete)
  │                      paypal_order_id: text (unique, nullable)
  │                      paypal_capture_id: text (unique, nullable)
  │                      amount_cents: integer
  │                      currency: text (default 'USD')
  │                      status: text ('created' | 'pending_capture' | 'completed' | 'failed' | 'refunded')
  │                      payment_method: text (default 'paypal')
  │                      raw_paypal_response: jsonb (nullable)
  │                      captured_at: timestamp with time zone (nullable)
  │                      created_at: timestamp with time zone
  │                      updated_at: timestamp with time zone
```

**State transitions**:

- `agent.status`: `active` -> `frozen` (wallet paused by user or policy trigger), `frozen` -> `active` (unfrozen by user), any -> `archived` (soft retired).
- `purchase_intent.status`: `pending` -> `evaluating_policy` -> `requires_approval` (rule tripped) or `approved` (autonomous pass) -> `executing_payment` -> `completed` or `failed` or `rejected`.
- `approval_request.status`: `pending` -> `approved` (user confirms, intent advances to `approved`), `pending` -> `rejected` (user denies, intent marks `rejected`), `pending` -> `expired` (timeout window passed).
- `transaction.status`: `created` (PayPal order initialized) -> `pending_capture` -> `completed` (capture confirmed) or `failed` (capture error) or `refunded` (reversal).

**API surface**:

Exported from `packages/db`:

| Export Symbol                                                              | Kind            | Description                                                    | Auth / Scope                     | Key Validation Errors                                |
| -------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------- |
| `agent`, `agentPolicy`, `purchaseIntent`, `approvalRequest`, `transaction` | Drizzle PgTable | Core Drizzle schema definitions with relations                 | Application filtered by `userId` | Foreign key violations, unique key collisions        |
| `insertAgentSchema`, `selectAgentSchema`                                   | Zod Schemas     | Inferred Zod validation schemas for agent creation and updates | Application layer                | Invalid name length, invalid model identifier        |
| `insertAgentPolicySchema`, `selectAgentPolicySchema`                       | Zod Schemas     | Validation schemas for budget thresholds and category arrays   | Application layer                | Negative cents values, threshold exceeds daily limit |
| `insertPurchaseIntentSchema`, `selectPurchaseIntentSchema`                 | Zod Schemas     | Validation schemas for incoming intent creation                | Application layer                | Missing prompt, negative estimated cents             |
| `insertApprovalRequestSchema`, `selectApprovalRequestSchema`               | Zod Schemas     | Validation schemas for approval reviews and state changes      | Application layer                | Invalid reviewer status transition                   |
| `insertTransactionSchema`, `selectTransactionSchema`                       | Zod Schemas     | Validation schemas for recording orders and capture logs       | Application layer                | Missing PayPal order identifier                      |

**Value sourcing**:

| Action                   | Value produced / displayed             | Source                                                                                                                                     |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Create agent             | `id`, `created_at`, `status`           | PostgreSQL `gen_random_uuid()`, `now()`, default `'active'`                                                                                |
| Create agent policy      | `agent_id`, limits in cents            | Input params validated against user input                                                                                                  |
| Submit purchase intent   | `idempotency_key`                      | Client provided UUID header or generated nano identifier                                                                                   |
| Evaluate policy          | Current daily spend total              | Dynamic SQL query: `sum(amount_cents)` from `transaction` where `agent_id = ?` and `status = 'completed'` and `created_at >= current_date` |
| Trip approval            | `rule_triggered`, `trigger_details`    | Inferred by agent guardrail evaluation engine comparing intent amount against policy                                                       |
| Record approval decision | `reviewer_id`, `reviewed_at`           | Authenticated session user ID from Better Auth and system timestamp                                                                        |
| Capture transaction      | `paypal_order_id`, `paypal_capture_id` | Returned payload from PayPal Orders and Capture APIs                                                                                       |
| Telemetry audit log      | Agent reasoning trace                  | Structured JSON array accumulated in `purchase_intent.reasoning_log`                                                                       |

**Key invariants**:

- Monetary values (`max_daily_spend_cents`, `single_transaction_limit_cents`, `require_approval_above_cents`, `estimated_amount_cents`, `amount_cents`) must always be greater than or equal to zero.
- `require_approval_above_cents` must be less than or equal to `single_transaction_limit_cents`.
- `single_transaction_limit_cents` must be less than or equal to `max_daily_spend_cents`.
- Deleting an `agent` cascades to its `agent_policy`, `purchase_intent`, and `approval_request` records, but is restricted if any completed `transaction` records exist to preserve financial auditability.
- An `idempotency_key` is unique across all purchase intents to prevent duplicate payment attempts.
- `paypal_order_id` and `paypal_capture_id` are unique across all transactions.

**Security model**:

- Tenancy is enforced at the application layer: every database query for agents, intents, approvals, or transactions must include the authenticated `user_id` obtained from the validated session.
- User roles: A single role owner model applies. Every authenticated user is an account owner who provisions their own agents, sets budget policies, and acts as the human reviewer for their own agents' approval requests. Dedicated team roles (such as separate approver or auditor accounts) are deferred.
- Only the owning user can freeze an agent, modify budget policies, or review pending approval requests.
- Sensitive payment tokens or raw banking credentials are never stored. Only PayPal order and capture references are persisted.
- Audit records in `transaction` cannot be deleted through standard application routes.

**Configuration required**:

- No new environment variables required for schema definition. Existing `DATABASE_URL` configured in `packages/db/.env` powers connection and migrations.

**Critical test scenarios**:

- Happy path: Create an agent with policy, register an autonomous intent under threshold, record approved transaction, and verify ledger spend calculation, verifies **AC-1**, **AC-2**, **AC-3**, **AC-6**.
- Failure case: Submitting a purchase intent with a duplicate idempotency key is rejected with a unique constraint violation, verifies **AC-4**.
- Policy threshold trigger: Submitting an intent exceeding `require_approval_above_cents` automatically generates an `approval_request` linked to the intent, verifies **AC-5**.
- Cascade restriction: Attempting to delete an agent with existing transactions is blocked by foreign key restriction, verifies **AC-6**.
- Type validation: Inserting negative cents or invalid status string fails Zod schema validation, verifies **AC-2**, **AC-7**.

## Build plan

Following the Tracer Bullet build approach, tasks are sliced to establish a working database persistence thread first, followed by schema exports and type validation.

1. Create schema definition file `packages/db/src/schema/agent.ts` with tables `agent` and `agent_policy`, satisfies **AC-1**, **AC-2**, **AC-3**.
2. Create schema definition file `packages/db/src/schema/commerce.ts` with tables `purchase_intent`, `approval_request`, and `transaction`, satisfies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-6**.
3. Define table relations and foreign key constraints linking to the existing `user` table in `packages/db/src/schema/relations.ts`, satisfies **AC-1**, **AC-3**, **AC-6**.
4. Generate and export Zod insert and select schemas alongside TypeScript inferred types in `packages/db/src/schema/validation.ts`, satisfies **AC-7**.
5. Export all tables, relations, types, and schemas through `packages/db/src/schema/index.ts` and `packages/db/src/index.ts`, satisfies **AC-1**, **AC-7**.
6. Run `pnpm --filter @workspace/db db:generate` to generate PostgreSQL migration SQL files and verify migration build cleanly, satisfies **AC-1**, **AC-2**.

## Consequences

**Positive**:

- Single source of truth for all domain entities in `packages/db` shared by web UI and agent runtimes.
- Integer cents eliminate precision errors and simplify arithmetic across guardrail checks.
- Structured JSONB columns allow AI reasoning traces and category rules to evolve without frequent database migrations.
- Strict foreign key constraints protect audit records from accidental deletion.

**Negative / tradeoffs**:

- Requires explicit dollar to cents conversion (`amount * 100`) when presenting values in the user interface and calling PayPal APIs.
- Rolling daily limit checks execute SQL aggregation queries rather than reading a static cached counter.

**Neutral**:

- Monorepo packages importing `@workspace/db` gain direct access to both Drizzle table schemas and Zod validation types.

## Follow-up

- [ ] Execute `pnpm --filter @workspace/db db:generate` once schema implementation files are written in `/develop core data model`.
- [ ] Connect PostgreSQL MCP server for visual schema inspection during Slice 1.

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
