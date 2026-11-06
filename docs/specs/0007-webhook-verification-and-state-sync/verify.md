# Verify: Webhook verification and state sync · spec 0007 · updated 2026-11-06

_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands

- [x] `pnpm check-types` → all 18 monorepo packages typecheck cleanly → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- [x] `pnpm --filter web test lib/paypal/webhook.test.ts` → all 11 unit tests pass verifying header extraction, certificate url validation, simulation fallback, replay defense, and state transitions → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- [x] `pnpm --filter web test app/api/webhooks/paypal/route.test.ts` → all 5 HTTP route handler tests pass verifying empty body, malformed JSON, verification failure, duplicate detection, and successful processing → AC-1, AC-2, AC-3

## HTTP / Manual

- [x] Send `POST /api/webhooks/paypal` with empty body → expects HTTP 400 Bad Request → AC-1
- [x] Send `POST /api/webhooks/paypal` without signature headers when simulation is off → expects HTTP 400 Bad Request with failure reason → AC-2
- [x] Send `POST /api/webhooks/paypal` with transmission identifier `SIM-TEST-001` in simulation mode → expects HTTP 200 OK with `status: "processed"` → AC-8
- [x] Re-send `POST /api/webhooks/paypal` with identical transmission identifier `SIM-TEST-001` → expects HTTP 200 OK with `duplicate: true` → AC-3
- [x] Send `PAYMENT.CAPTURE.COMPLETED` webhook event → expects transaction status `completed` and purchase intent status `completed` → AC-4
- [x] Send `PAYMENT.CAPTURE.DENIED` webhook event → expects transaction status `failed` and purchase intent status `failed` → AC-5
- [x] Send `PAYMENT.CAPTURE.REFUNDED` webhook event → expects transaction status `refunded` and `refundedAmountCents` incremented → AC-6
- [x] Send unknown event or unmatched transaction id → expects HTTP 200 OK with `status: "ignored"` and row in `webhook_event` → AC-7

## Acceptance criteria coverage

- AC-1: covered by `extractPayPalHeaders` unit test and route handler missing header test
- AC-2: covered by `verifyPayPalWebhookSignature` unit test and route handler verification failure test
- AC-3: covered by `webhook_event` unique index and duplicate transmission tests
- AC-4: covered by `PAYMENT.CAPTURE.COMPLETED` state synchronization unit test
- AC-5: covered by `PAYMENT.CAPTURE.DENIED` rejection handling unit test
- AC-6: covered by `PAYMENT.CAPTURE.REFUNDED` refund increment unit test
- AC-7: covered by multi identifier fallback and unmatched transaction unit tests
- AC-8: covered by simulation mode verification tests
