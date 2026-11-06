# 0007. Webhook verification and state sync

**Date**: 2026-11-06
**Status**: Accepted

## Summary

This specification introduces asynchronous PayPal webhook verification and database state synchronization for AgentPay. Incoming payment notifications are cryptographically verified using the official PayPal signature verification service and recorded in a dedicated audit log for replay defense. Verified capture, denial, and refund events automatically synchronize transaction and purchase intent statuses in PostgreSQL, ensuring financial state consistency even when client connections drop. Dual mode execution allows full offline testing and simulation without requiring external tunneling.

## Requirements

**User stories**:

- As an operator, I want incoming PayPal payment events cryptographically verified so that forged or tampered notifications cannot alter transaction records.
- As an autonomous agent, I want transaction and purchase intent statuses synchronized asynchronously when payment capture completes so that my state machine accurately reflects PayPal settlement.
- As a security auditor, I want every incoming webhook payload, transmission identifier, and verification result persisted immutably so that we maintain complete replay protection and traceability.
- As a finance manager, I want capture denials and refund events reflected in database statuses and refunded totals so that ledger balances remain accurate.
- As a developer, I want a simulation mode for webhooks so that automated tests and local features run reliably without live network tunnels.

**Acceptance criteria**:

- **AC-1**: `POST /api/webhooks/paypal` accepts incoming PayPal event notifications and extracts all transmission headers including `paypal-auth-algo`, `paypal-cert-url`, `paypal-transmission-id`, `paypal-transmission-sig`, and `paypal-transmission-time`.
- **AC-2**: Server verifies cryptographic webhook signatures against the official PayPal `POST /v1/notifications/verify-webhook-signature` REST endpoint using client credentials, returning HTTP 400 Bad Request on missing headers or failed verification.
- **AC-3**: Replay protection checks the `webhook_event` table for existing `transmission_id` values, returning HTTP 200 immediately for duplicate transmissions without re-executing state updates.
- **AC-4**: On verified `PAYMENT.CAPTURE.COMPLETED` events, the engine transitions the matching transaction status to `completed`, stores `capturedAt`, and updates the parent purchase intent status to `completed`.
- **AC-5**: On verified `PAYMENT.CAPTURE.DENIED` events, the engine transitions the matching transaction status to `failed` and updates the parent purchase intent status to `failed` with rejection details.
- **AC-6**: On verified `PAYMENT.CAPTURE.REFUNDED` events, the engine transitions the matching transaction status to `refunded` and increments `refundedAmountCents` by the refunded amount.
- **AC-7**: Event resolution locates transactions by `paypalCaptureId` or `paypalOrderId` in resource data, falling back to `custom_id` matching `purchaseIntentId`. Unmatched events are stored with status `ignored` and return HTTP 200.
- **AC-8**: Dual mode verification permits simulated webhook payloads when `PAYPAL_SIMULATION=true` or when simulated test headers are present, bypassing live PayPal network calls during development and testing.

## Decision

**Chosen option**: Option 1: Official PayPal REST verification with dedicated PostgreSQL webhook audit logging and atomic state reconciliation.

We will verify incoming webhook signatures through the official PayPal REST verification API using client credentials, store all incoming events in a dedicated `webhook_event` table with a unique index on `transmission_id` for replay prevention, and atomically synchronize transaction and purchase intent states using Drizzle ORM transactions.

**Implementation skills**: `modern-web-guidance` (`plugins/modern-web-guidance-plugin/skills/modern-web-guidance/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

New table in `packages/db/src/schema/commerce.ts`:

- `webhook_event`:
  - `id`: uuid (Primary Key, default random)
  - `paypalWebhookId`: text (nullable, PayPal webhook endpoint identifier)
  - `transmissionId`: text (not null, unique index, header `paypal-transmission-id`)
  - `eventType`: text (not null, e.g. `PAYMENT.CAPTURE.COMPLETED`)
  - `resourceType`: text (not null, e.g. `capture`, `order`)
  - `summary`: text (nullable, event summary)
  - `status`: text (not null, default `received`, values: `received`, `processed`, `ignored`, `failed`)
  - `rawHeaders`: jsonb (not null, default `{}`)
  - `payload`: jsonb (not null, default `{}`)
  - `errorMessage`: text (nullable, recorded on processing error)
  - `processedAt`: timestamp with time zone (nullable)
  - `createdAt`: timestamp with time zone (default now, not null)
  - `updatedAt`: timestamp with time zone (default now, not null)

Column update on existing `transaction` table in `packages/db/src/schema/commerce.ts`:

- `refundedAmountCents`: integer (`refunded_amount_cents`, default 0, not null)

**State transitions**:

Transaction state machine during webhook processing:

- `created` -> `pending_capture` (synchronous order creation)
- `pending_capture` -> `completed` (via `PAYMENT.CAPTURE.COMPLETED`)
- `pending_capture` -> `failed` (via `PAYMENT.CAPTURE.DENIED`)
- `completed` -> `refunded` (via `PAYMENT.CAPTURE.REFUNDED`)
- Terminal state safety rule: an event cannot regress `refunded` back to `completed` or `failed` back to `completed`.

Purchase intent state machine during webhook processing:

- `executing_payment` -> `completed` (when transaction reaches `completed`)
- `executing_payment` -> `failed` (when transaction reaches `failed`)

**API surface**:

| Endpoint               | Method | Key inputs                                                | Key outputs                                           | Auth                           | Key errors                        |
| ---------------------- | ------ | --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------ | --------------------------------- |
| `/api/webhooks/paypal` | POST   | raw event JSON body (req), PayPal signature headers (req) | `{ received: true, eventId: string, status: string }` | PayPal cryptographic signature | 400 Bad Request, 500 Server Error |

Required PayPal headers on `/api/webhooks/paypal`:

- `paypal-auth-algo`: string (algorithm used to generate signature)
- `paypal-cert-url`: string (URL of certificate used for signature)
- `paypal-transmission-id`: string (unique transmission UUID)
- `paypal-transmission-sig`: string (Base64 signature)
- `paypal-transmission-time`: string (timestamp of transmission)

**Value sourcing**:

| Action                 | Value produced / displayed                   | Source                                                                                                                                          |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Webhook verification   | Verification status (`SUCCESS` or `FAILURE`) | PayPal REST API `POST /v1/notifications/verify-webhook-signature` response                                                                      |
| Replay defense         | Transmission duplicate check                 | `webhook_event.transmission_id` unique index in database                                                                                        |
| Transaction resolution | Matched transaction record                   | `transaction.paypal_capture_id` matching `resource.id`, or `transaction.paypal_order_id`, or `resource.custom_id` matching `purchase_intent.id` |
| State synchronization  | Updated transaction status                   | Derived from PayPal `event_type` (`COMPLETED` -> `completed`, `DENIED` -> `failed`, `REFUNDED` -> `refunded`)                                   |
| Refund tracking        | `refundedAmountCents`                        | Extracted from `resource.amount.value` converted to cents via `currencyStringToCents`                                                           |
| Audit trail            | Raw payload and headers snapshot             | Incoming HTTP request body and headers stored in `webhook_event`                                                                                |

**Key invariants**:

- Webhook signature verification is mandatory for all requests unless running in explicit simulation mode.
- Each transmission identifier is processed at most once. Duplicate transmission identifiers return HTTP 200 without duplicate state modifications.
- Terminal financial states are monotonic. A completed transaction cannot be reverted to pending, and a refunded transaction cannot be overwritten by a delayed capture event.
- All webhook state transitions on transactions and purchase intents execute within an atomic database transaction.

**Security model**:

- The endpoint `/api/webhooks/paypal` is public to the internet because PayPal servers deliver webhooks without user session cookies.
- Authentication relies on PayPal asymmetric cryptographic signatures verified against PayPal certificates.
- Certificate URLs must validate against trusted PayPal domains (`^https://api\.(\w+\.)?paypal\.com/`) to prevent server side request forgery attacks.
- Sensitive credentials (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`) reside in environment variables and are never stored in database tables or logs.

**Configuration required**:

- `PAYPAL_WEBHOOK_ID`: string, identifier of the registered webhook endpoint in the PayPal Developer Dashboard.
- `PAYPAL_SIMULATION`: boolean string, optional flag to force simulation mode without calling live PayPal verification endpoints.

**Critical test scenarios**:

- Happy path: valid `PAYMENT.CAPTURE.COMPLETED` webhook with valid signature updates transaction and purchase intent to completed, verifies **AC-1**, **AC-2**, **AC-4**.
- Duplicate transmission: re-delivering an identical transmission identifier returns HTTP 200 with duplicate flag and skips state transitions, verifies **AC-3**.
- Denial handling: valid `PAYMENT.CAPTURE.DENIED` transitions transaction and purchase intent to failed, verifies **AC-5**.
- Refund handling: valid `PAYMENT.CAPTURE.REFUNDED` transitions transaction to refunded and updates refunded amount, verifies **AC-6**.
- Signature forgery: request with invalid signature or altered body returns HTTP 400 Bad Request, verifies **AC-2**.
- Simulation mode: local test request without PayPal signature headers processes successfully when simulation mode is active, verifies **AC-8**.

## Build plan

1. Database migration: define `webhook_event` table and add `refundedAmountCents` column to `transaction` schema in `packages/db`, satisfies **AC-3**, **AC-6**.
2. Webhook verification helper: create `verifyPayPalWebhookSignature` in `apps/web/lib/paypal/webhook.ts` supporting live PayPal REST verification and simulation fallback, satisfies **AC-1**, **AC-2**, **AC-8**.
3. Webhook HTTP route handler: implement `POST /api/webhooks/paypal` with header extraction, payload parsing, replay defense, and HTTP response mapping, satisfies **AC-1**, **AC-2**, **AC-3**.
4. State sync and transaction reconciliation engine: implement atomic transaction and purchase intent transitions for completed, denied, refunded, and unmatched events, satisfies **AC-4**, **AC-5**, **AC-6**, **AC-7**.
5. Test suite verification: add comprehensive unit and integration tests verifying cryptographic verification, idempotency replay, and state synchronization, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**.

## Consequences

**Positive**:

- Autonomous transactions reach confirmed finality even if client network connections drop during checkout capture.
- Complete cryptographic verification prevents spoofed or malicious transaction status modifications.
- Immutable audit logging provides traceability for every external event received from PayPal.
- Replay protection guarantees idempotency across repeated webhook deliveries from PayPal.

**Negative / tradeoffs**:

- Live signature verification adds an outbound HTTP request from AgentPay to PayPal on each received webhook, adding latency before responding.
- Storing full raw JSON payloads in PostgreSQL increases storage consumption over time, requiring future data retention policies.

**Neutral**:

- Requires creating and configuring a webhook endpoint and copying `PAYPAL_WEBHOOK_ID` into environment variables when deploying live environments.

## Follow-up

- [ ] Register the production webhook URL in the PayPal Developer Dashboard and set `PAYPAL_WEBHOOK_ID` in production environment secrets.
