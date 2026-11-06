# 0007. Webhook verification and state sync (Verification Plan)

**Date**: 2026-11-06

## Verification checklist

This document outlines the test scenarios and automated verification commands for the webhook verification and state sync feature slice.

### 1. Database schema and migration verification

- [ ] Run `pnpm check-types` across all workspaces to confirm schema types compile cleanly.
- [ ] Confirm `webhook_event` table is created with unique index on `transmission_id`.
- [ ] Confirm `transaction` table contains `refunded_amount_cents` with default 0.

### 2. Cryptographic signature verification tests

- [ ] Test missing PayPal headers: sending a POST request to `/api/webhooks/paypal` without `paypal-transmission-sig` or `paypal-transmission-id` returns HTTP 400 Bad Request.
- [ ] Test forged signature: sending an invalid or altered signature against live PayPal returns HTTP 400 Bad Request.
- [ ] Test valid signature in simulation mode: sending simulated webhook payload with simulation enabled returns HTTP 200 OK and records status `processed`.

### 3. Replay defense and idempotency tests

- [ ] Send a webhook payload with transmission identifier `TEST-TRANSMISSION-001`. Confirm HTTP 200 and database row in `webhook_event`.
- [ ] Re-send the identical payload with transmission identifier `TEST-TRANSMISSION-001`. Confirm endpoint returns HTTP 200 with `{ received: true, duplicate: true }` and no second state transition occurs.

### 4. Asynchronous state synchronization tests

- [ ] Test `PAYMENT.CAPTURE.COMPLETED`: sending capture completed event for a pending transaction transitions transaction status to `completed`, sets `capturedAt`, and updates parent purchase intent status to `completed`.
- [ ] Test `PAYMENT.CAPTURE.DENIED`: sending capture denied event transitions transaction status to `failed` and purchase intent status to `failed`.
- [ ] Test `PAYMENT.CAPTURE.REFUNDED`: sending capture refunded event transitions transaction status to `refunded` and updates `refundedAmountCents` to match the refund value.
- [ ] Test state machine monotonicity: sending a delayed capture completed event after a refund has occurred does not overwrite the `refunded` status.

### 5. Automated test execution

Run the following test suite to verify all webhook operations:

```bash
pnpm --filter @workspace/web test apps/web/lib/paypal/webhook.test.ts
```
