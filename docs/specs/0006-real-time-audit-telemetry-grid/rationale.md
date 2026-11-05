# 0006. Real time audit telemetry grid: Rationale

## Context

Autonomous AI agents executing financial transactions require real time observability and fail safe operational controls. Without immediate visibility into what an agent is purchasing, why it decided to buy, and whether it adhered to spending guardrails, operators cannot safely delegate commerce responsibilities to autonomous software.

When an agent enters a loop, hallucinates merchant requirements, or behaves anomalously, operators must possess an immediate emergency stop mechanism. If that kill switch does not exist or requires server redeployment, the financial risk is unacceptable. Furthermore, compliance and governance demand that emergency freeze actions are permanently recorded in an audit trail rather than silently toggled in memory.

The telemetry view must display both executed PayPal transactions and blocked or paused purchase attempts. Operators need to inspect high density tabular records with sorting, filtering, and column pinning while maintaining the ability to drill down into the step by step reasoning and tool call payloads produced by the model.

## Options considered

### Option 1: Unified database query projection with AG Grid Community, TanStack React Query polling, and atomic PostgreSQL freeze audit log (Chosen)

This option projects telemetry directly from the existing `purchase_intent`, `transaction`, and `approval_request` tables using an indexed join query, ordered by creation time descending with cursor pagination. Live updates are delivered using TanStack React Query short polling at a 4 second interval, automatically pausing when the browser tab is hidden. The data grid uses AG Grid Community styled with AgentPay design tokens, providing sorting, filtering, and responsive column pinning. Emergency freeze status is stored directly on the `agent` record in PostgreSQL with every status change logged to an immutable `agent_audit_log` table within the same transaction.

**Pros**:

- Eliminates data duplication by reading directly from indexed source tables.
- Serverless friendly polling avoids connection limits and hanging WebSockets.
- AG Grid Community provides out of the box sorting, column pinning, and virtualized high density rendering.
- Emergency freeze changes are permanently audited and enforced atomically at the database level.

**Cons**:

- Short interval polling produces periodic database queries while dashboard tabs remain active.
- AG Grid client bundle increases overall JavaScript payload on the dashboard route.

### Option 2: Dedicated immutable audit event ledger table with WebSocket streaming

This option writes every state transition, tool call, policy evaluation, and payment event to a dedicated `audit_event` ledger table. A WebSocket connection or Server Sent Events stream using PostgreSQL LISTEN/NOTIFY broadcasts events to the browser in real time.

**Pros**:

- Sub second latency for event delivery to active clients.
- Decouples audit log storage completely from application domain tables.

**Cons**:

- Introduces significant infrastructure complexity in serverless Next.js environments where persistent WebSocket connections require external services like Pusher or dedicated connection brokers.
- Duplicates transaction and intent state across multiple tables.
- Substantially higher development surface area for the hackathon timeline.

### Option 3: Lightweight static HTML table with manual refresh and in memory agent freeze flag

This option renders a plain HTML table using standard Tailwind CSS classes and relies on manual browser refreshes or simple client timers. Agent freeze status is kept in an application level in memory store or cache without a dedicated database audit table.

**Pros**:

- Minimal client bundle size and zero third party grid dependencies.
- Simple to implement within hours.

**Cons**:

- In memory freeze flags fail across multiple serverless instances and vanish upon cold starts.
- Lacks sorting, column resizing, filtering, and high density financial data presentation required for serious operator tooling.
- Fails audit compliance requirements due to missing freeze history.

## Rationale

Option 1 provides the optimal balance of engineering rigor, operational reliability, and user experience.

In a Next.js App Router environment running on modern infrastructure, persistent WebSocket servers introduce connection leakage and operational overhead that is unnecessary for monitoring purchase volume. Polling with TanStack React Query at 4 second intervals delivers an experience that feels real time to human operators while cleanly handling tab visibility and serverless scaling.

Using AG Grid Community ensures operators have the high density data manipulation tools standard in financial dashboards, including sorting by amount or timestamp, filtering by status or merchant, and pinning key columns. Storing freeze events in an explicit `agent_audit_log` table ensures that any emergency intervention is permanently attributed to the acting user, preventing disputed account freezes and providing a verifiable compliance trail.
