# Verify: Design system and UI foundation · spec 0003 · updated 2026-11-05

_Steps derived from spec 0003 acceptance criteria and value sourcing. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Inspect `:root` and `.dark` in browser developer tools → verify `--spend-approved`, `--spend-pending`, `--spend-blocked`, `--spend-captured`, and `--spend-paused` compute with minimum 4.5:1 contrast against background in light and dark modes → **AC-1**
- [ ] Observe numeric spans rendered with `font-mono tabular-nums` → verify tabular alignment prevents horizontal jitter when values update → **AC-2**
- [ ] Inspect Badge elements → verify financial variants (`approved`, `pending`, `blocked`, `captured`, `paused`) render distinct accessible icons and live dot indicators → **AC-3**
- [ ] Inspect Item component family (`Item`, `ItemMedia`, `ItemContent`, `ItemActions`) → verify action confirmation layout aligns cleanly with buttons and icons → **AC-4**
- [ ] Inspect CodeBlock and Trace elements → verify code syntax highlights accurately and trace timelines format clearly → **AC-5**
- [ ] Inspect InputGroup component family → verify textarea, addon, and action button slots arrange properly → **AC-6**

## Commands

- [ ] `pnpm --filter @workspace/ui check-types` → exits 0 with zero type errors → **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**
- [ ] `pnpm --filter @workspace/ui lint` → exits 0 with zero warnings or errors → **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**
- [ ] `pnpm check-types` → exits 0 across all workspace packages → **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**

## Acceptance criteria coverage

- **AC-1** (Financial tokens & contrast): Covered by globals.css variable definitions and UI package lint/typecheck
- **AC-2** (Tabular typography): Covered by tabular numerals utility classes and monospace font stack
- **AC-3** (Badge component): Covered by financial badge variants, icon resolution, and status pulse dot
- **AC-4** (Item action card): Covered by ItemMedia, ItemContent, and ItemActions primitives
- **AC-5** (CodeBlock and Trace): Covered by Shiki syntax highlighter and collapsible trace timeline
- **AC-6** (InputGroup): Covered by composable input control, addons, and action buttons
