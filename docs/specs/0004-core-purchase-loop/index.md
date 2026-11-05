# 0004. Core purchase loop

**Date**: 2026-11-05
**Status**: Accepted

## Summary

This specification defines the core purchase loop for AgentPay as a thin vertical slice through the entire stack. A natural language prompt in the web dashboard instructs the buyer agent to purchase a digital asset, which prompts the agent to deduce pricing details and execute an order in PayPal sandbox using the Orders v2 API. The transaction settles with server side capture, stores payment identifiers and reasoning traces in PostgreSQL, and renders immediate transaction feedback on the user interface.

## Requirements

**User stories**:

- As an operator, I want to give the buyer agent a natural language purchase goal so that the agent determines the merchant and item details autonomously.
- As a buyer agent, I want to create and capture a real sandbox PayPal order using server side credentials so that the payment settles without interactive human redirection.
- As an auditor, I want the purchase intent, PayPal identifiers, and structured agent reasoning steps persisted in the database so that every agent action is fully traceable.
- As a dashboard user, I want to see immediate visual confirmation of the captured order with its PayPal capture identifier and status so that I know the transaction succeeded.

**Acceptance criteria**:

- **AC-1**: `POST /api/v1/agent/purchase` validates incoming requests with a Zod schema requiring `agentId`, `prompt`, and client `idempotencyKey`, enforcing authenticated session ownership of the agent.
- **AC-2**: The buyer agent uses Vercel AI SDK with Gemini and a structured tool schema to parse the prompt, deduce item details and amount, or apply fallback sandbox defaults for unspecified prices.
- **AC-3**: A dedicated server client in `apps/web/lib/paypal/client.ts` initializes `@paypal/paypal-server-sdk` using Sandbox environment settings from environment variables.
- **AC-4**: The purchase service creates a PayPal order with `intent: CAPTURE`, `custom_id` matching `purchase_intent.id`, and captures it immediately using `ordersCapture`.
- **AC-5**: The purchase intent and transaction records are persisted in PostgreSQL using Drizzle ORM, storing the `paypalOrderId`, `paypalCaptureId`, captured amount in integer cents, and structured agent reasoning steps.
- **AC-6**: External PayPal API calls apply a 10 second timeout and no automatic capture retries, returning HTTP 422 with structured failure records on capture rejection.
- **AC-7**: The web dashboard provides an interactive prompt bar and renders a transaction summary card displaying the PayPal capture identifier, agent reasoning trace, and financial status badge upon completion.

## Decision

**Chosen option**: Option 1: Direct server side Orders v2 create and capture with Vercel AI SDK tool calling.

We will implement the purchase loop using a server singleton PayPal SDK client in `apps/web/lib/paypal/client.ts`, evaluate prompts with Gemini using tool calling, create and immediately capture sandbox orders via Orders API v2, and record immutable transaction rows in the existing database schema.

**Implementation skills**: `modern-web-guidance` (`plugins/modern-web-guidance-plugin/skills/modern-web-guidance/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

Reuses existing schema from `packages/db` without migrations:

- `agent` (`packages/db/src/schema/agent.ts`):
  - `id`: uuid (Primary Key)
  - `userId`: text (Foreign Key user.id)
  - `name`: text
  - `status`: text (active, paused, terminated)
  - `dailyBudgetCents`: integer
- `purchase_intent` (`packages/db/src/schema/commerce.ts`):
  - `id`: uuid (Primary Key)
  - `agentId`: uuid (Foreign Key agent.id, cascade delete)
  - `userId`: text (Foreign Key user.id, cascade delete)
  - `idempotencyKey`: text (unique)
  - `prompt`: text
  - `itemDescription`: text
  - `merchantName`: text
  - `estimatedAmountCents`: integer
  - `currency`: text (default USD)
  - `status`: text (pending, executing_payment, completed, failed)
  - `reasoningLog`: jsonb array of step objects with step index, tool name, input arguments, output result, and timestamp
- `transaction` (`packages/db/src/schema/commerce.ts`):
  - `id`: uuid (Primary Key)
  - `purchaseIntentId`: uuid (Foreign Key purchase_intent.id, restrict delete, unique)
  - `agentId`: uuid (Foreign Key agent.id, restrict delete)
  - `userId`: text (Foreign Key user.id, restrict delete)
  - `paypalOrderId`: text (unique, nullable)
  - `paypalCaptureId`: text (unique, nullable)
  - `amountCents`: integer
  - `currency`: text (default USD)
  - `status`: text (created, pending_capture, completed, failed)
  - `paymentMethod`: text (default paypal)
  - `rawPaypalResponse`: jsonb (nullable)
  - `capturedAt`: timestamp with time zone (nullable)

**State transitions**:

- `purchase_intent.status`: `pending` -> `executing_payment` -> `completed` (or `failed`)
- `transaction.status`: `created` -> `pending_capture` -> `completed` (or `failed`)

**API surface**:

| Endpoint                 | Method | Key inputs                                                                      | Key outputs                                                                                                                                                             | Auth                | Key errors                                                                                       |
| ------------------------ | ------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `/api/v1/agent/purchase` | POST   | `agentId: string` (req), `prompt: string` (req), `idempotencyKey: string` (req) | `purchaseIntentId: string`, `transactionId: string`, `paypalOrderId: string`, `paypalCaptureId: string`, `amountCents: number`, `status: string`, `reasoningLog: array` | Better Auth session | 400 invalid schema, 401 unauthorized, 403 forbidden agent, 409 duplicate key, 422 capture failed |

**Value sourcing**:

| Action                 | Value produced / displayed   | Source                                                                               |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| Create purchase intent | `agentId`                    | Request body parameter validated against user ownership                              |
| Create purchase intent | `prompt`                     | Request body parameter                                                               |
| Create purchase intent | `idempotencyKey`             | Request body parameter generated as UUID on client                                   |
| Create purchase intent | `userId`                     | Better Auth session user identifier                                                  |
| Create purchase intent | `itemDescription`            | Extracted by AI tool call from prompt text                                           |
| Create purchase intent | `merchantName`               | Extracted by AI tool call from prompt text or default                                |
| Create purchase intent | `estimatedAmountCents`       | Extracted by AI tool call from prompt text or default                                |
| Create PayPal order    | `paypalOrderId`              | PayPal Orders API ordersCreate response `id`                                         |
| Capture PayPal order   | `paypalCaptureId`            | PayPal Orders API ordersCapture response `purchase_units[0].payments.captures[0].id` |
| Persist transaction    | `amountCents`                | Captured amount string from PayPal response converted to integer cents               |
| Render summary card    | Displayed capture identifier | `transaction.paypalCaptureId` from API response                                      |
| Render summary card    | Displayed reasoning steps    | `purchase_intent.reasoningLog` from API response                                     |

**Key invariants**:

- Every purchase execution requires a unique `idempotencyKey` to prevent duplicate billing.
- Financial values are converted and stored as integer cents to eliminate floating point rounding errors.
- Autonomous agent capture uses server credentials without requiring customer interactive login.
- The `paypalOrderId` and `paypalCaptureId` must remain unique across the entire transaction ledger.
- Cascade deletion is restricted on transactions so financial history cannot be wiped if an agent is deleted.

**Security model**:

- Session user authentication is required through Better Auth.
- Users can only trigger purchases for agents they own (`agent.userId == session.user.id`).
- PayPal API credentials remain protected server side in environment variables and are never exposed to browser clients.

**Configuration required**:

- `PAYPAL_CLIENT_ID`: PayPal Developer Sandbox app client identifier
- `PAYPAL_CLIENT_SECRET`: PayPal Developer Sandbox app secret key
- `PAYPAL_ENVIRONMENT`: Sandbox environment selector (defaults to `sandbox`)
- `GOOGLE_GENERATIVE_AI_API_KEY`: API key for Gemini model through Vercel AI SDK

**Critical test scenarios**:

- Happy path: user submits purchase goal, agent extracts asset details, creates PayPal sandbox order, captures payment, persists completed records, and returns capture identifier, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-7**
- Failure case: invalid PayPal credentials or sandbox order rejection transitions transaction to failed status, stores error details, and returns HTTP 422, verifies **AC-6**
- Idempotency protection: submitting a duplicate `idempotencyKey` returns the existing transaction without triggering a second PayPal order, verifies **AC-1**, **AC-5**
- Auth protection: unauthenticated requests or requests targeting an agent owned by another user receive HTTP 401 or HTTP 403, verifies **AC-1**

## Build plan

Following the Tracer Bullet build approach, tasks stand up a thin end to end thread through every layer first, then complete UI presentation:

1. [x] Configure PayPal SDK client singleton in `apps/web/lib/paypal/client.ts` with environment variable validation, satisfies **AC-3**
2. [x] Implement backend PayPal purchase service functions for `createOrder` and `captureOrder` with error handling and integer cents conversion, satisfies **AC-4**, **AC-6**
3. [x] Create agent commerce service in `apps/web/lib/agent/purchase.ts` integrating Vercel AI SDK tool calling, reasoning step assembly, and Drizzle database persistence, satisfies **AC-2**, **AC-5**
4. [x] Implement route handler `POST /api/v1/agent/purchase` with Zod validation, session auth verification, and error response formatting, satisfies **AC-1**, **AC-6**
5. [x] Build interactive prompt bar and live transaction summary card in `apps/web/components/purchase/` using financial badges and trace components from `packages/ui`, satisfies **AC-7**

## Consequences

**Positive**:

- Proves real end to end integration with PayPal sandbox Orders API early in the project lifecycle.
- Establishes a reusable pattern for autonomous agent tool execution and structured reasoning audit logs.
- Protects against duplicate payments through strict idempotency key enforcement.

**Negative / tradeoffs**:

- Direct server side capture in sandbox bypasses interactive consumer authorization, which works for autonomous agents but requires merchant vaulting or partner onboarding for real customer wallets in production.
- Gemini tool calling introduces latency (1 to 2 seconds) before the PayPal order is initiated.

**Neutral**:

- Relies on sandbox environment credentials which must be present in local `.env` files for end to end verification.

## Follow-up

- [ ] Verify that `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` sandbox credentials exist in `.env.local`
- [ ] Integrate spending guardrail checks in Slice 2 before calling `createOrder`
