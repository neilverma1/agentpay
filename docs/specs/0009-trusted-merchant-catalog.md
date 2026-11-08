# 0009 · Trusted merchant catalog and shopping agent

**Status**: Assumed **Date**: 2026-11-08 **Authorized by**: engineer, during /develop

## Owed decision

Where a purchase's price, merchant and category come from. Today the model reports them itself, so a lying or prompt injected model can pass the spending policy with a false price or category. A second open point: the buyer agent is a single model call that extracts parameters, not a shopping agent.

## Assumption built on

- A mock merchant catalog in code (`apps/web/lib/agent/catalog.ts`) is the only source of truth for an offer's price, merchant name and category. The model never supplies these values.
- The buyer agent gets two tools. `searchOffers` runs on the server and returns catalog offers. `requestPurchase` has no execute function: it only names an `offerId` and a reason. The model has no payment tool.
- After the model picks an `offerId`, the server looks the offer up in the catalog. An unknown `offerId` is rejected. The policy check then runs on the catalog values.
- With no Google key, or if the model call fails, a deterministic keyword search picks the cheapest matching offer. This replaces the old regex prompt parser.
- The catalog includes offers in blocked categories (gambling, crypto exchange), so a prompt injection attempt is blocked by policy even when the agent picks that offer.
- No schema change. `purchase_intent` already stores item, merchant, category and amount.

## Code area

- `apps/web/lib/agent/catalog.ts` (new, plus tests)
- `apps/web/lib/agent/purchase.ts` (replace the intent parsing step)
- `docs/specs/0009-trusted-merchant-catalog.md` (this file)

## Requirements

- AC-1: The amount, merchant and category used by the policy check come from the catalog, never from model output.
- AC-2: The agent can search the catalog across more than one merchant and choose an offer. Each search and the selection appear in the reasoning log.
- AC-3: An `offerId` that is not in the catalog is rejected and no PayPal order is created.
- AC-4: A request for an offer in a blocked category is rejected by policy, even if the prompt tells the agent to ignore limits.
- AC-5: Without a model key, the fallback still resolves a catalog offer without regex parsing of price or category.

## Ratify

This decision was recorded by /develop, not deliberated. Run
`/architect trusted merchant catalog: ratify the assumed decision` to deliberate and ratify it. Until then it stays flagged as an owed decision; it does not block marking the feature `done`.
