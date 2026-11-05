# 0005. Spending guardrails and approval threshold

**Date**: 2026-11-06
**Status**: Proposed

## Summary

This specification introduces automated spending guardrails and human in the loop approval workflows for autonomous buyer agents in AgentPay. Before creating or capturing PayPal orders, the agent commerce service evaluates the proposed purchase against configured agent policies, calculating accumulated daily expenditure across a rolling 24 hour window. Transactions within normal thresholds execute autonomously, transactions violating hard limits reject immediately, and transactions exceeding the approval threshold pause in a pending state until an authorized human reviews and approves the purchase with one click execution.

## Requirements

**User stories**:

- As a user, I want my autonomous agents constrained by daily budget caps and transaction limits so that agents cannot spend beyond my risk tolerance.
- As a user, I want transactions above a designated dollar threshold held for my explicit approval so that high value purchases require human confirmation before money leaves my account.
- As a user, I want to review pending approval requests with full agent reasoning and merchant details in my dashboard and approve or reject them with a single click.
- As an autonomous agent, I want clear policy evaluation results recorded in my execution trace so that operators can audit why an action executed, paused, or rejected.

**Acceptance criteria**:

- **AC-1**: Policy evaluator validates incoming purchase requests against the agent spending policy (maximum daily spend, single transaction limit, require approval threshold, allowed merchant categories, blocked merchant categories) before initiating any PayPal order creation or capture.
- **AC-2**: Daily spend calculations compute accumulated expenditure across a rolling 24 hour window by querying settled transactions (status completed) for the target agent in PostgreSQL.
- **AC-3**: Dual tier policy enforcement applies immediate hard rejection (status rejected) when a purchase exceeds the daily cap, exceeds the single transaction limit, or matches a blocked merchant category.
- **AC-4**: When estimated purchase amount exceeds require approval threshold (or category is unlisted while allowed categories exist) and no hard limits are tripped, the system halts payment, transitions purchase intent status to requires approval, creates an approval request record with status pending, and records policy trigger reasoning in the reasoning log.
- **AC-5**: `POST /api/v1/approvals/[id]/decision` validates session ownership against agent user identity, executes atomic status transition from pending to approved or rejected, and prevents double execution with 409 Conflict if already decided.
- **AC-6**: Approving a pending request executes immediate server side PayPal order creation and capture, updating transaction to completed and purchase intent to completed, or marking failed with provider error details on capture error without reverting approval status.
- **AC-7**: `GET /api/v1/approvals` provides authenticated retrieval of pending approval requests filtered by status pending, including linked purchase intent details, agent details, and trigger breakdown.
- **AC-8**: Dashboard user interface renders an approval banner and interactive approval cards allowing users to review agent reasoning and execute one click Approve or Reject actions with live feedback.

## Decision

**Chosen option**: Option 1: In line dual tier guardrail evaluation in purchase service with atomic database locking and synchronous approval capture.

We will evaluate policies directly in the agent purchase service before invoking PayPal APIs, enforce a rolling 24 hour spending ledger query, pause high value transactions in an approval request table, and provide a dedicated approval route that atomically captures PayPal payments upon human approval.

**Implementation skills**: `modern-web-guidance` (`plugins/modern-web-guidance-plugin/skills/modern-web-guidance/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

Reuses existing schema from `packages/db` without migrations:

- `agent_policy` (`packages/db/src/schema/agent.ts`):
  - `id`: uuid (Primary Key)
  - `agentId`: uuid (Foreign Key agent.id, unique, cascade delete)
  - `maxDailySpendCents`: integer (not null)
  - `singleTransactionLimitCents`: integer (not null)
  - `requireApprovalAboveCents`: integer (not null)
  - `allowedMerchantCategories`: jsonb array of string category names
  - `blockedMerchantCategories`: jsonb array of string category names
  - `currency`: text (default USD)
- `purchase_intent` (`packages/db/src/schema/commerce.ts`):
  - `id`: uuid (Primary Key)
  - `agentId`: uuid (Foreign Key agent.id)
  - `userId`: text (Foreign Key user.id)
  - `status`: text (pending, evaluating_policy, requires_approval, approved, executing_payment, completed, rejected, failed)
  - `estimatedAmountCents`: integer
  - `reasoningLog`: jsonb array of step objects
  - `rejectionReason`: text (nullable)
- `approval_request` (`packages/db/src/schema/commerce.ts`):
  - `id`: uuid (Primary Key)
  - `purchaseIntentId`: uuid (Foreign Key purchase_intent.id, unique, cascade delete)
  - `agentId`: uuid (Foreign Key agent.id)
  - `reviewerId`: text (Foreign Key user.id, nullable)
  - `status`: text (pending, approved, rejected, expired)
  - `ruleTriggered`: text (e.g. require_approval_above_cents, category_review_required)
  - `triggerDetails`: jsonb (trigger context: amount, limit, spent in last 24 hours)
  - `notes`: text (reviewer comment, nullable)
  - `reviewedAt`: timestamp with time zone (nullable)
- `transaction` (`packages/db/src/schema/commerce.ts`):
  - `id`: uuid (Primary Key)
  - `purchaseIntentId`: uuid (Foreign Key purchase_intent.id, restrict delete)
  - `amountCents`: integer
  - `status`: text (created, pending_capture, completed, failed, refunded)
  - `paypalOrderId`: text (nullable)
  - `paypalCaptureId`: text (nullable)
  - `capturedAt`: timestamp with time zone (nullable)

**State transitions**:

- Autonomous purchase (under threshold):
  `purchase_intent`: `pending` -> `evaluating_policy` -> `executing_payment` -> `completed`
- Guardrail hard rejection:
  `purchase_intent`: `pending` -> `evaluating_policy` -> `rejected`
- Approval required path:
  `purchase_intent`: `pending` -> `evaluating_policy` -> `requires_approval`
  `approval_request`: `pending` -> `approved` -> `purchase_intent`: `executing_payment` -> `completed`
  (or `approval_request`: `pending` -> `rejected` -> `purchase_intent`: `rejected`)

**API surface**:

| Endpoint                          | Method | Key inputs                                                                      | Key outputs                                                                                         | Auth                | Key errors                                                                                                          |
| --------------------------------- | ------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/agent/purchase`          | POST   | `agentId: string` (req), `prompt: string` (req), `idempotencyKey: string` (req) | `purchaseIntentId: string`, `status: string`, `approvalRequestId?: string`, `reasoningLog: array`   | Better Auth session | 400 invalid schema, 401 unauthorized, 403 forbidden agent, 409 duplicate key, 422 rejected or failed                |
| `/api/v1/approvals`               | GET    | query param `status?: string` (opt, defaults to pending)                        | `approvals: array` of approval requests with intent and agent fields                                | Better Auth session | 401 unauthorized                                                                                                    |
| `/api/v1/approvals/[id]/decision` | POST   | `action: 'approve' \| 'reject'` (req), `notes?: string` (opt)                   | `approvalRequestId: string`, `status: string`, `transactionId?: string`, `paypalCaptureId?: string` | Better Auth session | 400 invalid action, 401 unauthorized, 403 forbidden owner, 404 not found, 409 already processed, 422 capture failed |

**Value sourcing**:

| Action                 | Value produced / displayed            | Source                                                                                                                                       |
| ---------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Evaluate policy        | `spentLast24HoursCents`               | Sum of `transaction.amountCents` where `agentId` matches, `status = 'completed'`, and `createdAt >= now() - interval '24 hours'`             |
| Evaluate policy        | `ruleTriggered`                       | Derived rule name in policy engine when estimated amount or category trips threshold                                                         |
| Evaluate policy        | `triggerDetails`                      | JSON snapshot containing `estimatedAmountCents`, `thresholdCents`, and `spentLast24HoursCents`                                               |
| List approvals         | `pendingApprovals`                    | Database query on `approval_request` joined with `purchase_intent` where `purchase_intent.userId` matches session user and status is pending |
| Decide approval        | `reviewerId`                          | Better Auth session user identifier                                                                                                          |
| Decide approval        | `reviewedAt`                          | Current timestamp generated on server at decision time                                                                                       |
| Capture approved order | `paypalOrderId` and `paypalCaptureId` | Returned by `@paypal/paypal-server-sdk` ordersCreate and ordersCapture calls                                                                 |

**Key invariants**:

- No payment orders or captures are ever created in PayPal before policy evaluation succeeds.
- An approval request can transition from pending exactly once (atomic conditional check prevents duplicate captures).
- Only the authenticated owner of the agent may approve or reject transactions for that agent.
- Rolling daily spend only counts completed transactions, ensuring failed or rejected purchases do not consume budget.

**Security model**:

- Session authentication required on all purchase and approval endpoints using Better Auth.
- Strict resource ownership validation: user can only evaluate purchases or decide approvals for agents where `agent.userId = session.user.id`.
- Monetary values strictly typed as integer cents to avoid floating point precision leaks.

**Configuration required**:

No new environment variables required. Reuses existing `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENVIRONMENT`, and `GOOGLE_GENERATIVE_AI_API_KEY`.

**Critical test scenarios**:

- Happy path autonomous: purchase under approval threshold executes immediately without human review, verifies AC-1 and AC-2.
- Approval threshold pause: purchase exceeding require approval threshold halts with status requires approval and creates pending approval record, verifies AC-4.
- Hard limit rejection: purchase exceeding daily spend cap or single transaction limit halts with status rejected and no PayPal call, verifies AC-3.
- One click approval capture: approving pending request triggers PayPal capture and transitions intent and transaction to completed, verifies AC-5 and AC-6.
- Concurrent decision guard: rapid duplicate approval clicks return 409 Conflict on the second attempt without double capturing, verifies AC-5.
- Capture failure handling: PayPal sandbox failure during approval updates transaction to failed while keeping approval marked as approved, verifies AC-6.

## Build plan

**Phase 1: Policy evaluator and rolling ledger**

- Create `apps/web/lib/agent/policy.ts` defining policy evaluation types, default policy generator, and rolling 24 hour spend aggregation query (satisfies AC-1, AC-2).
- Implement category validation and dual tier decision logic returning auto approve, requires approval, or reject (satisfies AC-1, AC-3, AC-4).

**Phase 2: Purchase loop integration**

- Update `executeAgentPurchaseLoop` in `apps/web/lib/agent/purchase.ts` to load or seed agent policy, evaluate policy after intent parsing, and branch execution (satisfies AC-1, AC-3, AC-4).
- Persist approval request records and update purchase intent statuses for paused or rejected flows (satisfies AC-4).

**Phase 3: Approvals REST API**

- Implement `GET /api/v1/approvals` in `apps/web/app/api/v1/approvals/route.ts` with authentication and user ownership filters (satisfies AC-7).
- Implement `POST /api/v1/approvals/[id]/decision` in `apps/web/app/api/v1/approvals/[id]/decision/route.ts` with atomic status update, ownership verification, and PayPal order capture (satisfies AC-5, AC-6).

**Phase 4: Dashboard UI and review actions**

- Create `apps/web/components/purchase/approval-card.tsx` to render pending approval details, trigger rule badges, and one click Approve or Reject buttons (satisfies AC-8).
- Integrate pending approvals section into `/dashboard` with optimistic status update and live refresh (satisfies AC-8).

## Consequences

**Positive**:

- Protects financial accounts from unbounded autonomous agent spending.
- Gives users complete transparency into why an agent paused a purchase.
- Enables safe execution of high value transactions with human oversight.

**Negative**:

- Rolling 24 hour database queries add an extra read query to the purchase loop before payment.
- Paused transactions require human intervention before business workflows can complete.

## Follow-up

- [ ] Add policy configuration UI in dashboard so users can customize limits and approval thresholds per agent without direct database editing.
- [ ] Implement email or push notifications when an agent creates an approval request.
