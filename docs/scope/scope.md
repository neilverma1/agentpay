# Scope: AgentPay

An autonomous agent commerce protocol with programmable spending guardrails and human in the loop approvals, powered by PayPal.

**Build approach:** Tracer Bullet (prove the whole pipe works before building any part of it fully). **Workflow:** Prototype (just develop with build time self checks). The project default level of rigor. /architect is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| #   | Feature                                    | Phase      | Status      |
| --- | ------------------------------------------ | ---------- | ----------- |
| 1   | Stack and architecture                     | Foundation | done        |
| 2   | Coding standards and tooling               | Foundation | done        |
| 3   | Core data model                            | Foundation | in-progress |
| 4   | Design system and UI foundation            | Foundation | planned     |
| 5   | Core purchase loop                         | Slice 1    | planned     |
| 6   | Spending guardrails and approval threshold | Slice 2    | planned     |
| 7   | Real time audit telemetry grid             | Slice 3    | planned     |
| 8   | Webhook verification and state sync        | Slice 4    | planned     |

## Foundations

### 1. Stack and architecture

Decide the stack and scaffold a runnable project with a modern frontend, agent backend, and PayPal SDK so every later slice builds on real structure. **Done when:** the stack is recorded in a spec and the scaffold boots locally and passes build.

spec [0001](../specs/0001-stack-and-architecture.md) · code in [apps/web/](../../apps/web/), [packages/db/](../../packages/db/)

- [x] Decide the stack (spec): `/architect stack and architecture`
- [x] Scaffold from the decision: `/develop stack and architecture`

### 2. Coding standards and tooling

Capture conventions, then install lint, format, and check scripts from the real scaffolded project. **Done when:** root `AGENTS.md` reflects the real stack, and lint and format checks run clean.

- [x] Capture conventions and tooling choices: `/audit`
- [x] Install the tooling: `/develop tooling`

### 3. Core data model

Define core persistence entities for agents, budget policies, purchase intents, and transaction records. **Done when:** entities and relationships support guardrail checks, transaction tracking, and audit logs without breaking changes.

spec [0002](../specs/0002-core-data-model.md) · code in [packages/db/](../../packages/db/)

- [x] Design it (spec): `/architect core data model`
- [ ] Build it: `/develop core data model`
  - [ ] Schema tables for agents, policies, and commerce entities (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6)
  - [ ] Relational links and foreign keys to user table (AC-1, AC-3, AC-6)
  - [ ] Zod validation schemas and TypeScript type exports (AC-7)
  - [ ] Drizzle migration generation and build verification (AC-1, AC-2)

### 4. Design system and UI foundation · needs a decision

Establish a crisp financial dashboard visual language and base components for prompt input, status tags, and approval modals. **Done when:** style tokens and base components handle layout, clean typography, and interactive states.

- [ ] Design it (spec): `/architect design system and UI foundation`

## Slice 1: Core purchase loop

### 5. Core purchase loop · needs a decision

The thinnest real thread through the whole system. The buyer agent receives an intent to purchase a digital asset, creates a PayPal order in sandbox via the Orders API, captures payment, and returns confirmed transaction data to the user interface. **Done when:** a prompt creates and captures a real sandbox order through PayPal and renders the confirmed payment identifier on screen.

- [ ] Design it (spec): `/architect core purchase loop`

## Slice 2: Spending guardrails and approval threshold

### 6. Spending guardrails and approval threshold · needs a decision

Enforce daily spending caps, category rules, and a progressive dollar threshold that triggers a one click approval prompt when purchases exceed the limit or violate policy. **Done when:** purchases under the threshold execute autonomously while purchases over the threshold pause for user approval before PayPal capture.

- [ ] Design it (spec): `/architect spending guardrails and approval threshold`

## Slice 3: Real time audit telemetry grid

### 7. Real time audit telemetry grid · needs a decision

Render an interactive transaction and policy audit log with AG Grid, showing timestamp, agent reasoning, merchant category, dollar amount, PayPal transaction identifier, and an emergency agent wallet freeze button. **Done when:** every agent transaction displays in an interactive table with sorting, filtering, and live status updates.

- [ ] Design it (spec): `/architect real time audit telemetry grid`

## Slice 4: Webhook verification and state sync

### 8. Webhook verification and state sync · needs a decision

Listen for asynchronous PayPal payment events, verify webhook signatures cryptographically on the server, and synchronize transaction state in the database. **Done when:** incoming webhook events verify cleanly and update pending orders to completed status automatically.

- [ ] Design it (spec): `/architect webhook verification and state sync`

## Deferred

Out of scope for the current hackathon pass, kept so the plan stays honest.

- **Role based permissions and team approver accounts**: dedicated admin, reviewer, and auditor user roles · from spec 0002
- **Multi agent wallet sharing**: pooled budgets and limits across multiple AI workers · needs a decision
- **Simulated dispute flow**: automated dispute defense and partial refund negotiation · needs a decision
- **Multi currency conversion**: live foreign exchange rates and currency handling · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack and architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State                        | Set by                       | The feature shows                                                                                       |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `planned` · needs a decision | `/scope`                     | one box: `Design it (spec): /architect <feature>`                                                       |
| `in-progress` (designed)     | `/architect` at spec capture | `Design it` ticked; spec linked; `Build it: /develop <feature>` plus milestones; the tier closing boxes |
| `in-progress` (building)     | `/develop`                   | milestone sub boxes tick one by one; code pointer filled                                                |
| `in-progress` (verified)     | `/check verify`              | `Build it` plus milestones ticked; `Verify it` ticked                                                   |
| `done`                       | you, when you decide it is   | boxes you ran ticked, skipped ones marked skipped                                                       |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards and tooling).
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
- **Workflow** (header line) is the project default: **Prototype** = develop with build time self check.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
