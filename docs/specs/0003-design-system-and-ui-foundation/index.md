# 0003. Design system and UI foundation

**Date**: 2026-11-05
**Status**: Done

## Summary

This decision defines the visual design system and component primitives foundation for AgentPay in `packages/ui`. It introduces semantic CSS variables for financial status states, tabular monospace typography for currency amounts, and core UI primitives including financial status badges, item action cards, input groups, and code block execution traces with syntax highlighting. Building these shared primitives enables subsequent purchase loops, spending guardrails, and audit telemetry grids to render consistent, accessible, and responsive user interfaces.

## Requirements

**User stories**:

- As a developer, I want semantic financial color tokens so that I can render consistent transaction and guardrail states (approved, pending, blocked, captured, paused) across all screens.
- As a risk reviewer, I want explicit status badges with icons and pulse dots so that I can differentiate approved, pending, and blocked spend attempts at a glance.
- As an agent operator, I want accessible item cards and input groups so that I can assemble prompt bars and action confirmation rows cleanly.
- As a developer, I want modular UI primitives in packages/ui that adhere to WCAG AA accessibility standards so that downstream feature slices can build complex views safely.

**Acceptance criteria**:

- **AC-1**: Semantic CSS variables for financial status states (`spend-approved`, `spend-pending`, `spend-blocked`, `spend-captured`, `spend-paused`) are declared in `packages/ui/src/styles/globals.css` with verified WCAG AA contrast across both light and dark themes.
- **AC-2**: Monospace tabular numerals (`tabular-nums font-mono`) are configured for all currency amounts, timestamps, and metric counters to prevent horizontal layout shift during dynamic updates.
- **AC-3**: `Badge` component in `packages/ui` provides financial variants (`approved`, `pending`, `blocked`, `captured`, `paused`), status indicator pulse dots (`showDot`), built in semantic icons (`icon`), and sizing options (`sm`, `default`, `lg`).
- **AC-4**: `Item` component family (`Item`, `ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`) in `packages/ui` provides accessible structured list rows and inline action confirmation layouts.
- **AC-5**: `CodeBlock` and `Trace` components in `packages/ui` render syntax highlighted code payloads via Shiki and collapsible execution timelines.
- **AC-6**: `InputGroup` component family (`InputGroup`, `InputGroupAddon`, `InputGroupButton`, `InputGroupInput`, `InputGroupTextarea`, `InputGroupText`) in `packages/ui` supports composite inputs with inline action buttons.

## Decision

**Chosen option**: Option 1: Adapt shadcn UI primitives with custom financial design tokens and code execution primitives in packages/ui.

We extend `packages/ui` with semantic financial tokens, tabular numeral utilities, and enhanced shadcn primitives (`Badge`, `Item`, `Trace`, `CodeBlock`, `InputGroup`), providing the clean building blocks required for subsequent feature slices.

**Implementation skills**: modern-web-guidance (antigravity/plugins, plugins/modern-web-guidance-plugin/skills/modern-web-guidance/)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Component contracts & exports**:

- `Badge` (in `packages/ui/src/components/badge.tsx`):
  - Props: `variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'approved' | 'pending' | 'blocked' | 'captured' | 'paused'`, `size?: 'sm' | 'default' | 'lg'`, `icon?: boolean | React.ReactNode`, `showDot?: boolean`, `asChild?: boolean`.
- `Item` (in `packages/ui/src/components/item.tsx`):
  - Exports: `Item`, `ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, `ItemGroup`, `ItemSeparator`.
  - Props: `variant?: 'default' | 'outline' | 'muted'`, `size?: 'default' | 'sm' | 'xs'`.
- `InputGroup` (in `packages/ui/src/components/input-group.tsx`):
  - Exports: `InputGroup`, `InputGroupAddon`, `InputGroupButton`, `InputGroupInput`, `InputGroupTextarea`, `InputGroupText`.
- `CodeBlock` (in `packages/ui/src/components/code-block.tsx`):
  - Exports: `CodeBlock`, `CodeBlockContent`, `CodeBlockCopyButton`.
- `Trace` (in `packages/ui/src/components/trace.tsx`):
  - Exports: `Trace`, `TraceIcon`, `TraceTitle`, `TraceLine`, `TraceCollapsible`, `TraceCollapsibleTrigger`, `TraceCollapsibleContent`.

**Key invariants**:

- All monetary figures must display with tabular monospace numbers (`tabular-nums font-mono`) and two decimal points for USD currency.
- Financial status badges must never rely on color alone to convey meaning (always pair color with a readable text label or icon for accessibility).
- Primitives in `packages/ui` remain uncoupled from domain specific schemas or business logic.

**Security model**:

- UI primitives sanitize rendered string attributes and enforce strict TypeScript prop constraints.
- Code blocks handle untrusted input safely during syntax highlighting.

**Configuration required**:

- No new environment variables required for this UI foundation slice.

**Critical test scenarios**:

- Financial status badges render with accessible contrast and matching semantic icons for all states, verifies **AC-1**, **AC-3**.
- Numeric stability: Tabular font utilities apply cleanly to numeric spans, verifies **AC-2**.
- Item action layout: ItemMedia, ItemContent, and ItemActions align properly in outline and default variants, verifies **AC-4**.
- Syntax highlighting: CodeBlock formats language syntax without blocking rendering, verifies **AC-5**.
- Input composition: InputGroup arranges textareas, buttons, and addons responsively, verifies **AC-6**.

## Build plan

1. [x] Define semantic financial CSS variables (`--spend-approved`, `--spend-pending`, `--spend-blocked`, `--spend-captured`, `--spend-paused`) and tabular numeral utilities in `packages/ui/src/styles/globals.css`, satisfies **AC-1**, **AC-2**
2. [x] Implement enhanced `Badge` component with financial variants, status pulse dots, and built in semantic icons in `packages/ui/src/components/badge.tsx`, satisfies **AC-3**
3. [x] Implement `Item` component family for structured rows and action confirmation cards in `packages/ui/src/components/item.tsx`, satisfies **AC-4**
4. [x] Implement `CodeBlock` and `Trace` components with Shiki syntax highlighting in `packages/ui/src/components/code-block.tsx` and `packages/ui/src/components/trace.tsx`, satisfies **AC-5**
5. [x] Implement `InputGroup` component family for composable input fields and action buttons in `packages/ui/src/components/input-group.tsx`, satisfies **AC-6**

## Consequences

**Positive**:

- Gives AgentPay a distinct, professional financial visual identity tailored for autonomous agent commerce.
- Keeps `packages/ui` clean, reusable, and free of domain coupling or premature application abstractions.
- Ensures WCAG AA accessibility compliance and clean monospace numeric alignment across all packages.

**Negative / tradeoffs**:

- Financial tokens must be strictly referenced via CSS variables rather than hardcoded Tailwind color utilities.

**Neutral**:

- Standard shadcn components (button, dialog, card, sheet, textarea) remain intact and fully compatible.

## Follow-up

- [ ] Incorporate AG Grid styling into the design system during Slice 3 (Real time audit telemetry grid).
