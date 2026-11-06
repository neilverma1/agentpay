# 0008. Interactive Agent Chat Threads

**Date**: 2026-11-07
**Status**: Proposed

## Summary

This decision adds dedicated conversational commerce routes at `/chat` and `/chat/[id]`. Operators can launch purchase tasks from prompt starters, observe the agent reason through tool calls in real time, and approve or decline paused transactions directly in the chat feed. Database persistence in PostgreSQL preserves message history, tool traces, and links to PayPal transaction records.

## Requirements

**User stories**:

- As an operator, I want to launch an autonomous commerce mission from natural language prompt suggestions at `/chat` so that I can dispatch purchases quickly without typing manual commands.
- As an operator, I want to watch the agent evaluate budget policies and stream tool execution steps in `/chat/[id]` so that I have complete transparency into why an action was taken.
- As an operator, I want to see an interactive approval card directly in the message flow when a purchase exceeds the autonomous limit so that I can approve or decline payment with one click without leaving the thread.
- As an auditor or operator, I want conversation threads and message logs to persist in the database so that past mission decisions remain available for review and link to the audit telemetry grid.

**Acceptance criteria**:

- **AC-1**: Visiting `/chat` renders the new mission launcher showing starter prompt suggestions, active wallet balance, remaining daily budget headroom, and the prompt input composer.
- **AC-2**: Submitting a prompt creates a persistent `chat_thread` record in PostgreSQL and transitions the browser to `/chat/[id]`.
- **AC-3**: The conversation route `/api/v1/chat/[id]` streams agent reasoning steps collapsible inside a thinking accordion drawer.
- **AC-4**: Agent tool invocations (budget checks, merchant lookups, PayPal sandbox order creation) render inline using `trace` and `item` primitives.
- **AC-5**: If a purchase exceeds the autonomous threshold or triggers a guardrail rule, an inline confirmation card renders with merchant name, price, policy rule violated, and one click Approve or Decline action buttons.
- **AC-6**: Clicking Approve sends a decision to `/api/v1/approvals/[id]/decision`, captures payment via PayPal, and updates the card state to completed in place without full page refresh.
- **AC-7**: All chat messages, tool calls, and reasoning steps persist to `chat_message` records in PostgreSQL and reload accurately when refreshing `/chat/[id]`.
- **AC-8**: Chat routes enforce session authentication and tenant isolation so operators cannot view, post to, or modify threads belonging to other users.

## Decision

**Chosen option**: Option 1: Database backed threaded chat with AI SDK data stream and generative UI action cards.

Build `/chat` and `/chat/[id]` routes backed by `chat_thread` and `chat_message` tables in Drizzle ORM, streaming real time agent reasoning via `@ai-sdk/google` and `@ai-sdk/react`, and rendering inline PayPal confirmation cards using shared UI primitives.

**Implementation skills**: `modern-web-guidance` (`antigravity/modern-web-guidance`, `plugins/modern-web-guidance-plugin/skills/modern-web-guidance/`)

## Feature design

**Data model sketch**:

```txt
chat_thread
  id: varchar(128) PRIMARY KEY
  user_id: varchar(128) NOT NULL (FK -> user.id)
  agent_id: varchar(128) NOT NULL (FK -> agent.id)
  title: varchar(255) NOT NULL DEFAULT 'New Commerce Mission'
  status: varchar(32) NOT NULL DEFAULT 'active' ('active' | 'archived')
  created_at: timestamp with time zone NOT NULL DEFAULT now()
  updated_at: timestamp with time zone NOT NULL DEFAULT now()
  INDEX: chat_thread_user_id_idx (user_id)
  INDEX: chat_thread_agent_id_idx (agent_id)

chat_message
  id: varchar(128) PRIMARY KEY
  thread_id: varchar(128) NOT NULL (FK -> chat_thread.id ON DELETE CASCADE)
  role: varchar(32) NOT NULL ('user' | 'assistant' | 'system')
  content: text NOT NULL
  parts: jsonb (structured array storing reasoning blocks, tool traces, and approval cards)
  purchase_intent_id: varchar(128) NULL (FK -> purchase_intent.id)
  created_at: timestamp with time zone NOT NULL DEFAULT now()
  INDEX: chat_message_thread_id_idx (thread_id)
  INDEX: chat_message_purchase_intent_id_idx (purchase_intent_id)
```

**State transitions**:

```txt
chat_thread: active -> archived
approval_card: pending_approval -> approved (completed) | declined (cancelled)
```

**API surface**:

| Endpoint                        | Method | Key inputs                                     | Key outputs                                  | Auth    | Key errors                                                 |
| ------------------------------- | ------ | ---------------------------------------------- | -------------------------------------------- | ------- | ---------------------------------------------------------- |
| /api/v1/chat/threads            | GET    | limit:number (opt), cursor:string (opt)        | threads:array, nextCursor:string             | session | 401 unauthorized                                           |
| /api/v1/chat/threads            | POST   | prompt:string (req), agentId:string (opt)      | thread:object, initialMessage:object         | session | 400 invalid, 401 unauthorized                              |
| /api/v1/chat/threads/[id]       | GET    | id:string in path (req)                        | thread:object, messages:array                | session | 401 unauthorized, 404 not found                            |
| /api/v1/chat/[id]               | POST   | messages:array (req), agentId:string (opt)     | data stream response (text, tool, reasoning) | session | 401 unauthorized, 404 not found, 423 frozen                |
| /api/v1/approvals/[id]/decision | POST   | decision:string ('approve' \| 'decline') (req) | status:string, transactionId:string          | session | 400 invalid, 401 unauthorized, 404 not found, 409 conflict |

**Value sourcing**:

| Action               | Value produced / displayed | Source                                                            |
| -------------------- | -------------------------- | ----------------------------------------------------------------- |
| Create new thread    | user_id                    | Authenticated session (`session.user.id`)                         |
| Create new thread    | agent_id                   | Request body or default agent from database (`agent` table)       |
| Create new thread    | title                      | Derived from first 40 characters of user prompt                   |
| Stream message turn  | reasoning steps            | Google Gemini model stream reasoning parts                        |
| Stream tool call     | spending check result      | Evaluated policy rules from `agent_policy`                        |
| Stream tool call     | paypal_order_id            | PayPal Orders v2 API response                                     |
| Render approval card | approval_request_id        | Inserted record in `approval_request` table                       |
| Render approval card | policy_rule_triggered      | Guardrail evaluator match (`approval_threshold` or `daily_limit`) |
| Approve purchase     | captured_paypal_id         | PayPal Orders v2 Capture response                                 |

**Key invariants**:

- Operators can only read, write, or delete threads where `chat_thread.user_id` matches their authenticated `session.user.id`.
- Deleting a thread cascades deletes to all child `chat_message` rows automatically.
- When an agent purchase requires approval, PayPal capture is never executed autonomously; payment remains paused until an explicit POST decision arrives.
- Thread message order is deterministic, ordered by `created_at` ascending.

**Security model**:

- Session authentication required on all chat endpoints via `requireAuth(req)`.
- Tenant isolation enforced in SQL queries (`where(and(eq(chatThread.id, id), eq(chatThread.userId, session.user.id)))`).
- Sensitive PayPal credentials stay in server environment variables and never leak to the client stream.

**Configuration required**:

- No new environment variables required. Existing `GOOGLE_GENERATIVE_AI_API_KEY`, `PAYPAL_CLIENT_ID`, and `PAYPAL_CLIENT_SECRET` power the chat agent loop.

**Critical test scenarios**:

- Happy path: Submitting a valid purchase prompt under the spending limit streams reasoning steps, executes PayPal capture, and saves message history, verifies AC-1, AC-2, AC-3, AC-4, AC-7.
- Guardrail threshold flow: Submitting a purchase prompt over $50 pauses execution, streams an inline confirmation card, and completes PayPal capture when the operator clicks Approve, verifies AC-5, AC-6.
- Wallet freeze defense: Submitting a prompt to a frozen agent halts immediately and returns an emergency lock message, verifies AC-4.
- Auth and tenant protection: Attempting to access another user's thread returns HTTP 404 or 401, verifies AC-8.

## Build plan

Milestones ordered by Tracer Bullet delivery:

- [ ] Milestone 1 (Data persistence): Add `chat_thread` and `chat_message` schemas in packages/db with relations, generate Drizzle migration, and verify build (AC-7, AC-8)
- [ ] Milestone 2 (Chat API and streaming service): Implement thread CRUD routes and `/api/v1/chat/[id]` streaming endpoint with AI SDK tools and session authorization (AC-2, AC-3, AC-8)
- [ ] Milestone 3 (Launcher UI at /chat): Build the `/chat` route featuring prompt suggestion pills, active wallet budget meter, and PromptInput composer (AC-1, AC-2)
- [ ] Milestone 4 (Thread view and generative UI at /chat/[id]): Build the `/chat/[id]` conversation screen with message scroller, collapsible reasoning accordion, and tool execution traces (AC-3, AC-4, AC-7)
- [ ] Milestone 5 (Inline approvals and live PayPal capture): Connect inline confirmation cards to `/api/v1/approvals/[id]/decision` for one click in place capture and declining (AC-5, AC-6)

## Consequences

- Positive: Provides an interactive generative interface that proves autonomous AI spending and human in the loop controls in action for the hackathon demo.
- Positive: Conversation threads create persistent audit trails that tie natural language prompts directly to PayPal transaction identifiers.
- Tradeoff: Adds two new database tables (`chat_thread`, `chat_message`) requiring migration management.

## Follow-up

- Add an export button to download chat thread audit logs as formatted JSON or PDF for corporate expense reporting.
- Implement streaming model selector dropdown if users want to alternate between Gemini 2.5 Flash and Gemini 2.5 Pro.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
