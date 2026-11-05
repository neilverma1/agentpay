# Verify: Real time audit telemetry grid · spec 0006 · updated 2026-11-06

_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Navigate to `/dashboard` with an active agent → verify the Audit Telemetry Grid renders with column headers (Time, Merchant, Category, Amount, Status, PayPal IDs, Reasoning Steps) → AC-3, AC-8
- [ ] In the dashboard purchase bench, submit a prompt to purchase cloud compute credits for 10 dollars → observe new row appears in the telemetry grid within 4 seconds with status completed → AC-1, AC-3, AC-7
- [ ] Click the newly created telemetry row → verify slide out drawer opens displaying complete step by step AI thoughts, tool call payloads, and PayPal capture details → AC-4
- [ ] Click the Emergency Wallet Freeze button above the grid → confirm the action in the prompt → observe status banner changes to Frozen (red) and freeze button updates to Unfreeze Agent → AC-5, AC-8
- [ ] While frozen, submit a prompt in the purchase bench → verify the request immediately fails with a notification that the agent wallet is frozen, without creating a PayPal order → AC-6
- [ ] Click the Unfreeze Agent button → verify status banner returns to Active → submit purchase prompt and verify transaction succeeds normally → AC-5, AC-6
- [ ] Switch to a new account with no transactions → verify the telemetry grid renders a clear empty state card with guidance to run a sample purchase → AC-8

## Commands

- [ ] `pnpm check-types` → TypeScript compilation passes across all workspaces with zero type errors → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- [ ] `pnpm --filter web test` → all unit and component tests pass cleanly → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- [ ] `curl -X GET http://localhost:3000/api/agents/00000000-0000-0000-0000-000000000001/telemetry` → returns HTTP 401 Unauthorized for unauthenticated requests → AC-1, AC-2
- [ ] `curl -X POST http://localhost:3000/api/agents/00000000-0000-0000-0000-000000000001/freeze -H "Content-Type: application/json" -d "{\"action\":\"freeze\"}"` → returns HTTP 401 Unauthorized for unauthenticated requests → AC-5

## Acceptance criteria coverage

- AC-1: Telemetry API endpoint joining purchase intents, transactions, and approvals with cursor pagination → covered by endpoint tests and grid data loading
- AC-2: Session ownership check verifying session user id matches agent user id → covered by authorization route tests
- AC-3: Interactive AG Grid table rendering timestamps, merchants, amounts, status badges, and PayPal identifiers with sorting and filtering → covered by component tests and UI verification
- AC-4: Slide out reasoning inspection drawer displaying detailed thoughts, tool calls, and PayPal payloads → covered by drawer UI verification
- AC-5: Emergency wallet freeze route updating agent status and logging to `agent_audit_log` atomically → covered by freeze route tests and database queries
- AC-6: Immediate pre execution freeze gate in purchase route returning HTTP 423 Locked → covered by purchase route tests
- AC-7: React Query polling at 4 second intervals with automatic tab throttling → covered by client hook integration tests
- AC-8: Dashboard freeze status banner, toggle button, and empty state card → covered by UI component tests
