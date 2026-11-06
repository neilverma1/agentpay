# 0008. Interactive Agent Chat Threads: Rationale

## Context

AgentPay was built with strong autonomous protocol foundations: core data modeling, PayPal sandbox order capture, daily spending limits, real time audit telemetry, and webhook verification. However, operators and hackathon judges currently interact with the agent through a static dashboard prompt bar driven by mock timers.

To demonstrate the true power of autonomous commerce, the platform needs an interactive conversational workspace. Operators need to assign purchasing missions, observe the AI model evaluate policies, watch tool calls execute in real time, and approve or decline paused transactions directly in the feed.

Without dedicated conversational routes, transactions feel like background batch jobs rather than intelligent agency. Adding `/chat` and `/chat/[id]` completes the product experience.

## Options considered

### Option 1: Database backed threaded chat with AI SDK data stream (Recommended)

Build dedicated `/chat` and `/chat/[id]` routes backed by `chat_thread` and `chat_message` tables in PostgreSQL. The frontend uses `@ai-sdk/react` (`useChat`) to consume a streaming response from `/api/v1/chat/[id]`. Reasoning steps collapse into thinking drawers, tool calls render via `trace` primitives, and approval thresholds display interactive `item` cards with one click capture buttons.

**Pros**:

- Persistent threads allow operators to revisit prior missions, review reasoning logs, and audit purchasing decisions at any time.
- Direct links between chat messages and `purchase_intent` records unify conversational history with the financial ledger.
- Generative UI components render seamlessly inline without disrupting the message flow.

**Cons**:

- Requires creating two new database tables and managing migrations.

### Option 2: Session based memory threads without database persistence

Provide `/chat` and `/chat/[id]` routing but keep conversation state purely in browser memory or local storage. The chat connects to the existing `/api/v1/agent/purchase` endpoint.

**Pros**:

- Requires no schema changes or database migrations.
- Fastest to scaffold for a rapid prototype.

**Cons**:

- Refreshing the browser erases all conversation history and reasoning traces.
- Disconnects natural language interactions from backend audit telemetry records.

### Option 3: Monolithic dashboard prompt stream without conversation threads

Keep all interactions on the single `/dashboard` route, wiring the existing prompt bar directly to a live server sent events stream.

**Pros**:

- Avoids creating new routes or navigation patterns.

**Cons**:

- Does not support multiple simultaneous missions or past conversation history.
- Clutters the high level dashboard overview metrics with verbose streaming logs.

## Rationale

Option 1 was chosen because financial workflows require accountability and persistence. An operator delegating a purchase must be able to inspect what the agent did yesterday, review why a transaction was paused, or continue an existing thread.

Backing threads with PostgreSQL and Drizzle ORM ensures that every natural language prompt, policy evaluation, and PayPal transaction identifier links directly to the audit grid and telemetry tables. Using standard shadcn primitives (`item`, `button`, `trace`, `input-group`) delivers a polished, accessible design without adding external UI dependencies.

## References

None, keep it clean.
