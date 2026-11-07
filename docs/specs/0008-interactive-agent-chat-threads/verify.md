# Verify: Interactive agent chat threads · spec 0008 · updated 2026-11-07

_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands

- [x] `pnpm check-types` → all monorepo packages typecheck cleanly → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- [x] `pnpm --filter web test app/api/v1/chat` → tests verify thread creation, message persistence, tenant protection, and route handlers → AC-2, AC-3, AC-7, AC-8
- [x] `pnpm --filter db db:generate` → Drizzle generates migration for chat_thread and chat_message without drift → AC-7

## HTTP and UI / Manual

- [ ] Navigate to `/chat` as authenticated operator → view preset prompt pills, active agent wallet balance, and PromptInput → AC-1
- [ ] Submit prompt "Buy Anthropic developer API credits for $25.00" → verify redirect to `/chat/[id]` and initial user message appears → AC-2
- [ ] Watch streaming response → verify thinking accordion opens and closes with real time reasoning steps → AC-3
- [ ] Inspect tool execution → verify policy evaluation and PayPal order creation display inline with trace components → AC-4
- [ ] Submit prompt exceeding $50 threshold "Purchase enterprise cloud hosting for $85.00" → verify inline confirmation card renders with Approve and Decline buttons → AC-5
- [ ] Click Approve button → verify call to `/api/v1/approvals/[id]/decision` executes PayPal capture and marks card completed without page reload → AC-6
- [ ] Refresh the page at `/chat/[id]` → verify past messages, reasoning logs, and transaction status reload from PostgreSQL → AC-7
- [ ] Send request to `/api/v1/chat/threads/[id]` with unauthenticated or mismatched session → verify HTTP 401 or HTTP 404 response → AC-8

## Acceptance criteria coverage

- AC-1: covered by `/chat` page render test and UI visual check
- AC-2: covered by thread creation API route tests and router navigation
- AC-3: covered by streaming data handler tests and reasoning accordion component
- AC-4: covered by agent tool execution pipeline tests
- AC-5: covered by spending policy evaluator threshold branching tests
- AC-6: covered by inline approval decision API tests and optimistic UI updates
- AC-7: covered by database persistence queries and page hydration tests
- AC-8: covered by session authorization middleware and tenant scoped SQL queries
