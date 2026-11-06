# 0006. Real time audit telemetry grid

**Date**: 2026-11-06
**Status**: Completed

## Summary

This specification introduces a real time audit telemetry grid and emergency wallet freeze capability for autonomous buyer agents in AgentPay. Operators can inspect all purchase intents, policy evaluations, and PayPal transaction captures in an interactive AG Grid data table featuring live status polling, sorting, filtering, and column pinning. Clicking any row opens an inspection drawer with the agent reasoning steps and provider payloads. An emergency wallet freeze control allows operators to pause agent spending instantly with a single action, creating an immutable audit record and blocking all in flight and future payments until manually unfrozen.

## Requirements

**User stories**:

- As an operator, I want an interactive real time audit grid showing all agent transactions and policy decisions so that I have immediate operational visibility into autonomous wallet activity.
- As an operator, I want to filter, sort, and pin columns across timestamps, merchants, amounts, and statuses so that I can quickly audit specific purchases and spot anomalous behavior.
- As an operator, I want to click any telemetry row to view the complete agent reasoning trace, tool calls, and PayPal order details in a slide out drawer so that I can verify policy compliance.
- As an operator, I want an emergency wallet freeze button that immediately blocks all autonomous purchases for an agent and logs the action for audit compliance.
- As a security auditor, I want every freeze and unfreeze event persisted in an audit log with the actor identity and timestamp so that operator actions remain accountable.

**Acceptance criteria**:

- **AC-1**: `GET /api/agents/[agentId]/telemetry` provides paginated telemetry rows joining purchase intents, transactions, and approval requests, ordered by creation timestamp descending with cursor pagination.
- **AC-2**: Authenticated session ownership check verifies that the session user id matches the agent user id, returning 403 Forbidden on any mismatched tenant access.
- **AC-3**: AG Grid Community interactive table renders columns for timestamp, merchant name, category, amount with currency formatting, status badge, PayPal order and capture identifiers, and reasoning step count with sorting, filtering, and column pinning.
- **AC-4**: Clicking any telemetry row or inspect action opens a slide out drawer rendering the complete step by step AI thoughts, tool call inputs and outputs, policy evaluation breakdown, and PayPal response payload.
- **AC-5**: `POST /api/agents/[agentId]/freeze` atomically updates agent status between active and frozen, records an entry in `agent_audit_log` with actor user id, previous status, new status, and optional reason, and returns the updated status.
- **AC-6**: Purchase execution route `POST /api/purchase` immediately validates agent status before invoking model reasoning or PayPal APIs, rejecting requests with HTTP 423 Locked when frozen, and re verifies status before capturing payment.
- **AC-7**: Live polling engine uses TanStack React Query `useQuery` configured with a 4 second refetch interval, automatic background tab throttling, and manual refresh controls.
- **AC-8**: Dashboard renders a persistent visual freeze banner when the agent is frozen, an emergency freeze toggle button with confirmation feedback, and an empty state card prompting a test purchase when zero transactions exist.

## Decision

**Chosen option**: Option 1: Unified database query projection with AG Grid Community, TanStack React Query polling, and an atomic PostgreSQL freeze audit log.

We will query a unified telemetry projection joining purchase intent, transaction, and approval request records in PostgreSQL, render the results in an AG Grid Community table customized with AgentPay Tailwind CSS tokens, refresh data using a 4 second React Query poll interval, and implement an atomic freeze route backed by a dedicated `agent_audit_log` table.

**Implementation skills**: `modern-web-guidance` (`plugins/modern-web-guidance-plugin/skills/modern-web-guidance/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

New table in `packages/db/src/schema/agent.ts`:

- `agent_audit_log`:
  - `id`: uuid (Primary Key, default random)
  - `agentId`: uuid (Foreign Key `agent.id`, cascade on delete, not null, indexed)
  - `actorUserId`: text (Foreign Key `user.id`, cascade on delete, not null)
  - `action`: text (not null, values: `freeze`, `unfreeze`)
  - `previousStatus`: text (not null)
  - `newStatus`: text (not null)
  - `reason`: text (nullable)
  - `createdAt`: timestamp with time zone (default now, not null, indexed)

Existing schema utilized for unified telemetry projection:

- `agent` (`packages/db/src/schema/agent.ts`):
  - `id`: uuid
  - `userId`: text
  - `name`: text
  - `status`: text (`active`, `frozen`, `archived`)
- `purchase_intent` (`packages/db/src/schema/commerce.ts`):
  - `id`: uuid
  - `agentId`: uuid
  - `userId`: text
  - `prompt`: text
  - `itemDescription`: text
  - `merchantName`: text
  - `merchantCategory`: text (nullable)
  - `estimatedAmountCents`: integer
  - `currency`: text
  - `status`: text (`pending`, `evaluating_policy`, `requires_approval`, `approved`, `executing_payment`, `completed`, `rejected`, `failed`)
  - `reasoningLog`: jsonb array of step objects
  - `rejectionReason`: text (nullable)
  - `createdAt`: timestamp with time zone
- `approval_request` (`packages/db/src/schema/commerce.ts`):
  - `id`: uuid
  - `purchaseIntentId`: uuid (unique)
  - `status`: text (`pending`, `approved`, `rejected`, `expired`)
  - `ruleTriggered`: text
  - `triggerDetails`: jsonb
  - `reviewedAt`: timestamp with time zone (nullable)
- `transaction` (`packages/db/src/schema/commerce.ts`):
  - `id`: uuid
  - `purchaseIntentId`: uuid (unique)
  - `paypalOrderId`: text (nullable)
  - `paypalCaptureId`: text (nullable)
  - `amountCents`: integer
  - `status`: text (`created`, `pending_capture`, `completed`, `failed`, `refunded`)
  - `rawPaypalResponse`: jsonb (nullable)
  - `capturedAt`: timestamp with time zone (nullable)

**State transitions**:

Agent wallet freeze state machine:

```txt
[active] --(operator POST /freeze)--> [frozen] (logs to agent_audit_log)
[frozen] --(operator POST /freeze)--> [active] (logs to agent_audit_log)
```

Purchase intent state behavior when agent is frozen:

```txt
[incoming purchase request]
       |
[check agent.status == 'frozen']
       |
       +--(yes)--> [HTTP 423 Locked: Agent wallet is frozen] (no intent created, no PayPal call)
       |
       +--(no)---> [normal purchase and policy pipeline]
```

**API surface**:

| Endpoint                          | Method | Key inputs                                                       | Key outputs                                                                  | Auth           | Key errors                                                            |
| --------------------------------- | ------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------- |
| `/api/agents/[agentId]/telemetry` | GET    | `cursor?: string`, `limit?: number` (max 100), `status?: string` | `items: TelemetryRow[]`, `nextCursor: string \| null`, `agentStatus: string` | Session cookie | 401 Unauthorized, 403 Forbidden, 404 Agent Not Found                  |
| `/api/agents/[agentId]/freeze`    | POST   | `action: 'freeze' \| 'unfreeze'`, `reason?: string`              | `success: boolean`, `agentId: string`, `status: string`, `updatedAt: string` | Session cookie | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Agent Not Found |

**Value sourcing**:

| Action             | Value produced / displayed | Source                                                                                           |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------------ |
| Telemetry Grid Row | Timestamp                  | `purchase_intent.createdAt` ISO string                                                           |
| Telemetry Grid Row | Merchant Name              | `purchase_intent.merchantName`                                                                   |
| Telemetry Grid Row | Merchant Category          | `purchase_intent.merchantCategory` or `'Uncategorized'`                                          |
| Telemetry Grid Row | Dollar Amount              | `transaction.amountCents` if present, else `purchase_intent.estimatedAmountCents` divided by 100 |
| Telemetry Grid Row | Currency                   | `purchase_intent.currency`                                                                       |
| Telemetry Grid Row | Overall Status             | `purchase_intent.status` mapped to status badge                                                  |
| Telemetry Grid Row | PayPal Order ID            | `transaction.paypalOrderId`                                                                      |
| Telemetry Grid Row | PayPal Capture ID          | `transaction.paypalCaptureId`                                                                    |
| Telemetry Grid Row | Triggered Rule             | `approval_request.ruleTriggered`                                                                 |
| Telemetry Grid Row | Reasoning Step Count       | Length of `purchase_intent.reasoningLog` array                                                   |
| Reasoning Drawer   | Thoughts and Tool Traces   | `purchase_intent.reasoningLog` objects                                                           |
| Reasoning Drawer   | Policy Evaluation Details  | `approval_request.triggerDetails` object                                                         |
| Reasoning Drawer   | Provider Raw Response      | `transaction.rawPaypalResponse` object                                                           |
| Emergency Freeze   | Agent Status Indicator     | `agent.status` from database                                                                     |
| Freeze Audit Log   | Actor User Identity        | `session.user.id` from authenticated Better Auth session                                         |

**Key invariants**:

- Only the user owning an agent can query its telemetry or modify its freeze status (`agent.userId = session.user.id`).
- When an agent is frozen, no new purchase intent can execute reasoning or initiate a PayPal transaction.
- When an agent is frozen during mid execution of an intent, payment capture must abort and mark the intent failed.
- Every change to agent freeze status must insert a record into `agent_audit_log` within the same database transaction.
- Telemetry rows are ordered strictly by creation timestamp descending.

**Security model**:

- Authentication relies on Better Auth session verification via `requireUser()`.
- Authorization enforces strict tenant isolation by scoping database queries to `agent.userId = session.user.id`.
- Emergency freeze mutations require an active session and validate ownership before applying changes.
- The telemetry endpoint does not expose raw PayPal credentials, API tokens, or other users' transaction data.

**Configuration required**:

No new environment variables or secret keys are required. The feature utilizes the existing PostgreSQL database connection and Better Auth configuration.

**Critical test scenarios**:

- Telemetry retrieval happy path: Authenticated user queries `GET /api/agents/[agentId]/telemetry` and receives paginated rows with linked transactions, verifying **AC-1** and **AC-3**.
- Multi tenant authorization protection: User attempts to fetch telemetry or freeze an agent owned by another user and receives 403 Forbidden, verifying **AC-2**.
- Emergency wallet freeze execution: Operator calls `POST /api/agents/[agentId]/freeze` with action `freeze`, verifying agent status transitions to `frozen` and an entry is recorded in `agent_audit_log`, verifying **AC-5**.
- Frozen purchase rejection: Purchase request submitted to `/api/purchase` while agent is frozen returns HTTP 423 Locked with zero PayPal calls, verifying **AC-6**.
- Slide out reasoning inspection: User selects a telemetry row and verifies the drawer renders reasoning steps, tool outputs, and PayPal capture details, verifying **AC-4**.
- Live polling update: A new purchase executed in another tab appears in the grid within 4 seconds without manual page reload, verifying **AC-7**.
- Empty state and UI feedback: An agent with zero transactions renders a clean empty state card with guidance to create a test purchase, verifying **AC-8**.

## Build plan

Following the Tracer Bullet build approach, tasks deliver vertical slices through every layer:

- [x] 1. **Schema migration and types**: Define `agent_audit_log` in `packages/db/src/schema/agent.ts`, add table relations, export insert and select types, and generate Drizzle migration. Satisfies **AC-5**.
- [x] 2. **Telemetry query service and route**: Implement `GET /api/agents/[agentId]/telemetry` with keyset cursor pagination, joined purchase intent, transaction, and approval data, and session ownership check. Satisfies **AC-1**, **AC-2**.
- [x] 3. **Emergency freeze route and purchase gate**: Implement `POST /api/agents/[agentId]/freeze` with atomic transaction logging to `agent_audit_log`. Add freeze pre check and pre capture check in `POST /api/purchase` returning HTTP 423 Locked. Satisfies **AC-5**, **AC-6**.
- [x] 4. **Grid package setup and token styling**: Install `ag-grid-react` and `ag-grid-community` in `apps/web`. Create AG Grid Quartz theme token overrides in `apps/web` matching AgentPay Tailwind variables for dark and light modes. Satisfies **AC-3**.
- [x] 5. **Interactive telemetry grid component**: Build `AuditTelemetryGrid` component with AG Grid column definitions (timestamp, merchant, category, amount, status badge, PayPal identifiers, reasoning steps), custom cell renderers using `@workspace/ui`, sorting, filtering, and 4 second polling via `@tanstack/react-query`. Satisfies **AC-3**, **AC-7**, **AC-8**.
- [x] 6. **Reasoning trace drawer and freeze banner**: Implement `TelemetryDetailDrawer` using `@workspace/ui/components/sheet` or slide out panel with Shiki formatted traces. Implement `AgentFreezeControl` banner and toggle button with toast notifications. Satisfies **AC-4**, **AC-8**.
- [x] 7. **Dashboard integration and end to end verification**: Embed the telemetry grid and freeze controls on `apps/web/app/(app)/dashboard/page.tsx`. Verify live updates, drawer inspection, emergency freeze enforcement, and unit tests. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**.

## Consequences

**What this makes easier**:

- Operators have immediate visibility into autonomous financial decisions, policy triggers, and PayPal transactions in one place.
- In anomalous conditions, operators have an instant kill switch to halt agent spending without modifying code or restarting servers.
- Complete AI reasoning logs are accessible directly alongside financial ledger records for auditability.

**What this makes harder**:

- AG Grid bundle size adds to client assets, requiring dynamic imports or modular bundle configuration to avoid slowing initial dashboard page load.
- Short interval polling creates recurring lightweight database queries that scale with active dashboard tabs.

## Follow-up

- Consider adding WebSocket or Server Sent Events streaming when multi user real time volume demands lower latency than 4 second polling.
- Explore agent wallet budget recharge and automated unfreeze schedules.
