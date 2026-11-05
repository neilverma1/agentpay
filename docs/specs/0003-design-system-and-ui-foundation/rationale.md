# 0003. Design system and UI foundation: Rationale

**Date**: 2026-11-05

## Context

AgentPay requires an interface that balances high density financial data with clear visual feedback for autonomous agent operations. Operators need to evaluate proposed purchases, review guardrail violations, and observe transaction statuses at a glance.

Previously, `packages/ui` provided standard shadcn component primitives (buttons, cards, dialogs, inputs), but lacked:

1. Semantic design tokens for financial states such as approved, pending approval, blocked, captured, and paused.
2. Tabular numeric typography to avoid layout shift when streaming monetary figures and balance counters.
3. Enhanced financial badges with semantic icon resolution and live pulse dots.
4. Structured item components for action confirmations and timeline rows.
5. Code block and execution trace primitives with syntax highlighting.

Establishing these foundations in `packages/ui` now prevents inconsistent styling, fragmented implementations, and accessibility regressions across upcoming vertical slices.

## Options considered

### Option 1: Adapt shadcn UI primitives with custom financial design tokens in packages/ui (Chosen)

Extend `packages/ui` with semantic financial tokens in `globals.css`, tabular numeral utilities, and enhanced UI primitives (`Badge`, `Item`, `Trace`, `CodeBlock`, `InputGroup`). Keep application specific domain logic and agent orchestration in `apps/web`.

**Pros**:

- Directly builds on existing Radix UI and Tailwind CSS setup without adding redundant external frameworks.
- Clean separation: reusable visual primitives remain in `packages/ui` while app specific views and API wiring remain in `apps/web`.
- Avoids premature abstractions by relying on composable building blocks (`Item`, `Badge`, `InputGroup`).
- Ensures WCAG AA accessibility compliance across all financial states.

**Cons**:

- Requires maintaining token discipline across team members rather than using arbitrary colors.

### Option 2: Generic shadcn primitives without financial tokens, building one off styles in apps/web

Use standard textarea, card, and button components from shadcn without dedicated financial tokens or enhanced badges, writing one off UI logic directly in feature pages.

**Pros**:

- Zero additions to the shared `packages/ui` library.

**Cons**:

- Results in duplicate, inconsistent status styles across pages.
- Omits accessible semantic icons and tabular alignment.
- Hardcoded color classes make theme updates and dark mode accessibility difficult to maintain.

### Option 3: Adopt a heavy external full stack AI UI library

Introduce a comprehensive external AI chat and tool library to handle agent interfaces.

**Pros**:

- Prepackaged state management hooks.

**Cons**:

- Heavy external dependency with opinionated styles that clash with our Tailwind design system.
- Limited flexibility for custom PayPal transaction actions and strict financial approval workflows.
- Increases client bundle size and creates friction with React 19 server components.

## Rationale

Option 1 provides the exact balance of consistency, accessibility, and speed required for AgentPay. Building on the existing Tailwind and Radix UI primitives already in `packages/ui` avoids introducing redundant runtime libraries. Providing core primitives (`Badge`, `Item`, `InputGroup`, `Trace`, `CodeBlock`) allows future slices to assemble clean views without bloating the core design system.
