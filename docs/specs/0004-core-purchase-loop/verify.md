# Verify: Core purchase loop · spec 0004 · updated 2026-11-05

_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Open dashboard at `/dashboard` with an active session → locate prompt bar → submit "Buy cloud compute credits for 10 dollars" → observe processing spinner and agent steps → expect live summary card with PayPal capture identifier and captured badge → AC-7
- [ ] Submit duplicate purchase prompt with identical idempotency key → expect instant retrieval of existing transaction record without duplicate order creation → AC-1, AC-5
- [ ] Click copy button beside PayPal Capture ID → expect identifier copied to clipboard with checkmark indicator → AC-7
- [ ] Inspect reasoning trace accordion on summary card → verify three sequential steps (parse intent, create PayPal order, capture PayPal order) with timestamps → AC-2, AC-5

## Commands

- [ ] `pnpm --filter web test lib/paypal/service.test.ts components/purchase/purchase-bench.test.tsx` → all unit and component tests pass → AC-3, AC-4, AC-7
- [ ] `pnpm check-types` → TypeScript compilation passes across all packages with zero errors → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
- [ ] `curl -X POST http://localhost:3000/api/v1/agent/purchase -H "Content-Type: application/json" -d "{}"` → returns HTTP 401 Unauthorized → AC-1

## Acceptance criteria coverage

- AC-1: Input schema validation, session authentication, and idempotency key enforcement → covered by route handler and command curl test
- AC-2: Buyer agent prompt parsing and tool calling with fallback sandbox defaults → covered by agent purchase service and UI manual walkthrough
- AC-3: PayPal server SDK client singleton and Sandbox environment configuration → covered by apps/web/lib/paypal/client.ts and unit tests
- AC-4: PayPal Orders v2 create order with intent CAPTURE and immediate ordersCapture call → covered by apps/web/lib/paypal/service.ts
- AC-5: PostgreSQL persistence for purchase intent and transaction with structured reasoning logs → covered by Drizzle schema operations in apps/web/lib/agent/purchase.ts
- AC-6: External API timeout protection and structured error handling returning HTTP 422 on failure → covered by PayPal service error mapping in route handler
- AC-7: Interactive dashboard prompt bar and live transaction summary card with financial status badges → covered by PurchaseBench component and component test
