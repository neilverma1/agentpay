# Verify: Spending guardrails and approval threshold · spec 0005 · updated 2026-11-06

_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Submit prompt for low value item below approval threshold (e.g. 5 dollars) in `/dashboard` → verify purchase executes autonomously to completion without approval pause → AC-1, AC-2
- [ ] Submit prompt for high value item exceeding approval threshold (e.g. 35 dollars) in `/dashboard` → observe purchase intent transitions to requires approval state and pending approval card appears in dashboard → AC-4, AC-8
- [ ] In pending approval card, inspect agent evaluation trace and triggered threshold rule breakdown → click Approve button → verify one click PayPal capture succeeds and transaction card updates to completed → AC-5, AC-6, AC-8
- [ ] Submit second purchase exceeding approval threshold → in pending approval card, click Reject button with optional note → verify purchase intent transitions to rejected and card clears → AC-5, AC-8
- [ ] Submit purchase attempting to exceed daily spend limit (e.g. over 100 dollars total in 24 hours) → verify immediate rejection with clear daily cap exceeded error message in reasoning log → AC-2, AC-3

## Commands

- [ ] `pnpm --filter web test lib/agent/policy.test.ts` → all policy engine unit tests pass across rolling spend, category rules, and threshold checks → AC-1, AC-2, AC-3, AC-4
- [ ] `pnpm check-types` → TypeScript compilation passes across all packages with zero errors → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- [ ] `curl -X GET http://localhost:3000/api/v1/approvals` → returns HTTP 401 Unauthorized for unauthenticated requests → AC-7
- [ ] `curl -X POST http://localhost:3000/api/v1/approvals/test-id/decision -H "Content-Type: application/json" -d "{}"` → returns HTTP 401 Unauthorized for unauthenticated requests → AC-5

## Acceptance criteria coverage

- AC-1: Policy evaluator checks spending limits and merchant categories before external calls → covered by policy evaluator unit tests and manual execution
- AC-2: Rolling 24 hour spend aggregation querying settled transactions in PostgreSQL → covered by policy query unit tests
- AC-3: Dual tier rule enforcement applying hard rejections for cap breaches and blocked categories → covered by purchase loop error handling
- AC-4: Pausing high value purchases in requires approval state and creating pending approval records → covered by UI manual walkthrough and approval query tests
- AC-5: Secure approval decision route with atomic status transition and 409 Conflict guard → covered by decision route handler and tests
- AC-6: Direct PayPal order creation and capture upon human approval with error recording → covered by decision handler integration
- AC-7: Authenticated retrieval of pending approvals with linked intent details → covered by GET approvals endpoint tests
- AC-8: Dashboard approval banner and interactive review cards with one click action buttons → covered by approval card component tests
