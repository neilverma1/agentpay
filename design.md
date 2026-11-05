# AgentPay Design System

**Character**: Fintech Slate (high trust financial dashboard, precision tabular metrics, PayPal brand accents, and accessible status signaling).
**Source**: Extracted and synthesized from project requirements and spec 0003.

## Build mandate

Build a focused, high density financial control interface for autonomous agent commerce. Visuals must convey security, speed, and deterministic spending controls. Layouts must balance real time telemetry with clear human in the loop approval workflows.

### Art direction & principles

- **Precision Typography**: All monetary amounts, quotas, timestamps, and model identifiers must use monospace tabular numbers (`font-mono tabular-nums`) to prevent layout shifts.
- **Accessible State Semantics**: Status colors (approved, pending, blocked, captured, paused) must always be paired with explicit text labels and icon indicators, never color alone (WCAG AA).
- **Responsive Dual Mode**: Approval prompts must adapt to viewports, presenting centered Radix Dialogs on desktop viewports and bottom sheet drawers on mobile viewports.
- **Agent Transparency**: Agent thinking steps, tool invocations, and policy evaluations must be clearly delineated with collapsible accordions, streaming pulse indicators, and parameter inspection cards.

## Tokens & Theme

The single source of truth for design tokens lives in `packages/ui/src/styles/globals.css`.

- **Primary Brand**: Dark Navy (`oklch(0.18 0.015 255)`) in light mode; Slate White in dark mode.
- **PayPal Accent**: PayPal Blue (`oklch(0.52 0.22 255)`) for payment captures, brand highlights, and primary actions.
- **Status Tokens**:
  - `spend-approved`: Emerald for approved transactions and intact spending limits.
  - `spend-pending`: Amber for pending user approvals and threshold warnings.
  - `spend-blocked`: Crimson for policy violations and hard budget stops.
  - `spend-captured`: Blue for successfully executed PayPal sandbox payments.
  - `spend-paused`: Slate for wallet freezes and paused agent workers.

## Component & usage rules

### Do

- Use `Badge` with financial variants (`approved`, `pending`, `blocked`, `captured`, `paused`) and semantic icons for transaction, policy, and agent operational states.
- Wrap all financial figures, quotas, and balances in `tabular-nums font-mono`.
- Use `Item` (`ItemMedia`, `ItemContent`, `ItemActions`) for structured list rows and action confirmation cards.
- Use `InputGroup` for composable prompt bars and text inputs with inline action buttons.
- Use `CodeBlock` and `Trace` to format tool execution parameters, code payloads, and collapsible activity timelines.
- Provide distinct loading, empty, and error states for all telemetry grids and cards.

### Don't

- Don't use raw unstyled HTML forms or inputs.
- Don't display currency figures without two decimal places and tabular numeral alignment.
- Don't hardcode color hex codes or arbitrary Tailwind palette classes for financial states.
- Don't rely on color alone to communicate state changes or errors.
