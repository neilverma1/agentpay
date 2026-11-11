# Agent Package

## Overview

Core autonomous buyer agent engine, catalog matcher, spending policy enforcement, and PayPal payment settlement integration.

## Key files

| File                    | Owns                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `src/buyer-agent.ts`    | Multi-provider LLM buyer agent (`google`, `openai`, `custom-sandbox`) and structured tool calling |
| `src/catalog.ts`        | Mock SaaS catalog and semantic vector search tool                                                 |
| `src/policy.ts`         | Spending limit guardrails, category allow/block rules, and 24h rolling velocity tracking          |
| `src/purchase.ts`       | Autonomous purchase execution loop and approval escalation workflows                              |
| `src/freeze.ts`         | Emergency agent freezing and active status controls                                               |
| `src/telemetry.ts`      | Structured audit trail and telemetry retrieval service                                            |
| `src/paypal/service.ts` | PayPal Orders v2, Vault setup/payment tokens, and refund capture service                          |
| `src/paypal/webhook.ts` | PayPal webhook verification and state reconciliation                                              |

## Commands

```bash
# Run tests
pnpm --filter @workspace/agent test

# Typecheck
pnpm --filter @workspace/agent check-types
```

## Conventions

- Domain logic cleanly separated from HTTP framework concerns.
- Exports dual entry points: `.` (`@workspace/agent`) and `./paypal` (`@workspace/agent/paypal`).
- Strict TypeScript with zero `any`.
