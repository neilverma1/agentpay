# Verify: Core data model · spec 0002 · updated 2026-11-05

_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands

- [ ] `pnpm --filter @workspace/db check-types` -> passes with zero TypeScript errors -> AC-1, AC-7
- [ ] `pnpm --filter @workspace/db build` -> builds clean declaration and JavaScript output -> AC-1, AC-7
- [ ] Verify migration file `packages/db/drizzle/0001_omniscient_jamie_braddock.sql` exists and includes all 5 tables -> AC-1

## Schema Invariants & Validation

- [ ] Inserting an agent with invalid status string fails `insertAgentSchema` validation -> AC-7
- [ ] Inserting an agent policy with negative cents or where `requireApprovalAboveCents > singleTransactionLimitCents` fails `insertAgentPolicySchema` validation -> AC-2, AC-3, AC-7
- [ ] Submitting two purchase intents with identical `idempotencyKey` values violates the database unique constraint -> AC-4
- [ ] Attempting to delete an agent with completed transactions is blocked by foreign key restriction -> AC-6

## Acceptance-criteria coverage

- AC-1 covered by schema definitions and migration generation
- AC-2 covered by integer cents column types and non negative validation
- AC-3 covered by agent policy 1:1 relation and threshold bounds check
- AC-4 covered by idempotency key unique constraint and reasoning log JSON
- AC-5 covered by approval request rule trigger, details JSON, and timestamps
- AC-6 covered by transaction PayPal order/capture IDs and delete restriction
- AC-7 covered by exported Zod schemas and TypeScript const arrays
