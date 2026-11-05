# UI Package

## Overview

Shared React design system built with Tailwind CSS, Radix UI primitives, and Lucide icons for consistent styling across applications.

## Key files

| File                     | Owns                                          |
| ------------------------ | --------------------------------------------- |
| `src/components/`        | Reusable UI primitive components              |
| `src/styles/globals.css` | Core design system tokens and theme variables |
| `src/lib/utils.ts`       | Class merging (cn) utility                    |

## Commands

```bash
# Check types
pnpm --filter @workspace/ui check-types

# Lint
pnpm --filter @workspace/ui lint
```

## Conventions

- Inherits root Clean Architecture and accessibility baseline (WCAG AA).
- Components use `class-variance-authority` and `tailwind-merge` for styling composition.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
