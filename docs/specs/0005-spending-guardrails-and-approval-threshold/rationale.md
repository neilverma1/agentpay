# Rationale: Spending guardrails and approval threshold

## Context

Autonomous AI agents with direct access to payment APIs introduce significant financial risk if left unconstrained. Prompts from users or external systems can deduce incorrect item quantities, hallucinate inflated prices, or execute transactions with unrecognized merchants. Without pre execution checks, an agent could deplete a user account balance before any human notices the anomaly.

At the same time, requiring manual human approval for every single purchase eliminates the autonomous utility of AI agents. A practical commerce protocol requires programmable guardrails: low value everyday operational purchases execute autonomously within tight limits, while high value or anomalous transactions pause and wait for an authorized human signature.

Key architectural forces:

- Accuracy of financial state: Daily spending caps must reflect actual settled transactions rather than pending or failed attempts, and must prevent race conditions across parallel agent executions.
- Latency and user experience: Pre payment policy checks must be fast and lightweight, running before external payment gateway calls are initiated.
- Reliability and idempotency: An approval action must execute payment capture exactly once even if a user double clicks the approval button or encounters browser reconnection glitches.
- Simplicity and maintainability: The solution should leverage existing PostgreSQL tables without introducing complex distributed lock managers or external messaging queues.

## Options considered

### Option 1: In line dual tier guardrail evaluation in purchase service with atomic database locking and synchronous approval capture

In this architecture, the agent purchase service evaluates policies immediately after Gemini deduces the item and price, prior to calling PayPal APIs. Transactions under the approval threshold execute order creation and capture synchronously. Transactions above the threshold create an approval request record and transition the intent to a paused state. When the user clicks Approve in the dashboard, a dedicated decision route validates user ownership, conditionally updates the approval record from pending to approved in a single atomic SQL statement, and captures the PayPal order immediately.

**Pros**:

- Minimal moving parts with zero external message broker or background worker dependencies.
- Atomic SQL status transitions provide robust protection against duplicate captures.
- Low latency for both autonomous purchases and human approved executions.
- Completely traceable in the database with rich step by step reasoning logs.

**Cons**:

- Approval decision endpoint holds an open HTTP connection while waiting for PayPal capture to complete.
- Rolling 24 hour spend aggregation executes a database summation query on every purchase attempt.

### Option 2: Pre authorization PayPal orders with delayed capture on user approval

In this architecture, every purchase creates a PayPal order with authorization intent immediately. If the purchase trips guardrails, the authorization remains open while waiting for the human to approve capture.

**Pros**:

- Locks in merchant funds authorization early before human review.
- Direct alignment with traditional card authorization and capture cycles.

**Cons**:

- Unapproved or rejected transactions clutter PayPal accounts with pending authorizations that tie up user credit limits.
- Requires managing PayPal authorization expiration windows and handling manual authorization voids on rejection.
- Unnecessary external API calls for transactions that violate basic hard limits or blocked categories.

### Option 3: Client side policy validation with client driven approval prompts

In this architecture, the browser dashboard evaluates agent limits locally before submitting requests to the backend purchase endpoint. When an approval is needed, the client prompts the user before ever making the API call.

**Pros**:

- Eliminates server side pause states for purchases initiated directly from the dashboard.
- Immediate visual feedback in the user interface.

**Cons**:

- Completely insecure for non browser agent invocations such as API integrations or scheduled automations.
- Susceptible to stale client side cache and bypassable by any direct API caller.
- Cannot reliably calculate accumulated 24 hour spend across multiple concurrent devices or browser tabs.

## Rationale

Option 1 is selected because it enforces policy guardrails where they belong: inside the server side business domain, immediately preceding payment capture.

By calculating daily expenditure against completed transactions across a rolling 24 hour window, the system provides continuous risk containment without relying on calendar day resets or client time zones. The atomic conditional update (`UPDATE approval_request SET status = 'approved' WHERE id = :id AND status = 'pending'`) guarantees that concurrent approval requests or double clicks fail safely with 409 Conflict rather than creating duplicate PayPal transactions.

Option 2 was rejected because creating PayPal orders before policy approval litters merchant and buyer accounts with dangling authorizations and forces complex void handling on rejection. Option 3 was rejected because client side validation fails the fundamental security requirement for autonomous server executed commerce agents.
