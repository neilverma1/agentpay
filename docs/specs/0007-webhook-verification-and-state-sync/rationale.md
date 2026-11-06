# 0007. Webhook verification and state sync (Rationale)

**Date**: 2026-11-06

## Context

AgentPay coordinates autonomous financial actions on behalf of users. When an AI agent initiates and captures an order via the PayPal REST API, network connectivity between our server and PayPal can fail before the response arrives. In addition, asynchronous events such as delayed payment settlements, capture rejections, dispute openings, and refunds occur outside the immediate request lifecycle. Without an asynchronous webhook ingestion pipeline, our database states risk becoming permanently out of sync with actual funds settled at PayPal.

Incoming webhooks arrive over the public internet without session cookies. If our webhook endpoint does not cryptographically verify the origin and integrity of incoming payloads, malicious actors could forge webhook events, tricking AgentPay into marking unpaid orders as completed or altering agent financial ledger balances. PayPal provides asymmetric digital signatures in HTTP headers (`paypal-transmission-sig`, `paypal-cert-url`, `paypal-auth-algo`, and `paypal-transmission-time`) that must be validated.

Furthermore, distributed payment systems require strict idempotency. PayPal retries webhook delivery when endpoints fail to respond quickly or return server errors. Re-delivering the same event must never produce double balance deductions, corrupted state machine transitions, or duplicate database records.

## Options considered

### Option 1: Official PayPal REST verification with dedicated PostgreSQL audit table (Chosen)

In this approach, our server forwards incoming headers and the raw webhook payload to PayPal's official `POST /v1/notifications/verify-webhook-signature` REST endpoint using our OAuth credentials. All incoming events are saved into a dedicated `webhook_event` table with a unique index on the transmission identifier before executing state synchronization within a database transaction.

**Pros**:

- Offloads certificate caching, public key validation, and cryptographic algorithm verification directly to PayPal authoritative infrastructure.
- Zero risk of certificate parsing bugs, expired trust store vulnerabilities, or server side request forgery from untrusted certificate URLs.
- Provides complete auditability and replay defense through the dedicated PostgreSQL table.

**Cons**:

- Incurs one outbound network round trip from our server to PayPal on each received webhook.

### Option 2: Local cryptographic verification using Node.js crypto and certificate caching

In this approach, the server downloads the X.509 certificate specified in `paypal-cert-url`, caches the certificate public key, constructs the expected CRC32 and SHA256 message representation, and verifies the signature locally using Node.js `crypto.verify`.

**Pros**:

- Verifies signatures without making an outbound API call to PayPal for each incoming notification once the certificate is cached.

**Cons**:

- Highly fragile implementation requiring strict validation of certificate domains, revocation checks, and complex header concatenation rules.
- Susceptible to server side request forgery if certificate URL domain verification is incomplete or bypassed.

### Option 3: Lightweight state sync without raw payload persistence

In this approach, the server verifies the signature and immediately updates the existing `transaction` and `purchase_intent` tables, tracking transmission identifiers in a temporary cache without storing the raw event payload.

**Pros**:

- Consumes less PostgreSQL disk space by avoiding storage of historical event JSON payloads.

**Cons**:

- Destroys the audit trail of what PayPal sent, preventing post incident inspection, reconciliation debugging, and historical replay forensics.

## Rationale

Option 1 is the most secure and robust approach for AgentPay.

Because AgentPay manages autonomous financial spending with user authorized funds, security and auditability take precedence over microsecond latency optimizations. Handing signature verification to PayPal via `verify-webhook-signature` eliminates the major security risk of parsing external certificate chains locally while guaranteeing that verification matches PayPal internal validation rules.

Persisting all incoming events in the `webhook_event` table guarantees idempotency. When PayPal retries a webhook notification, PostgreSQL rejects duplicate transmission identifiers via its unique index, allowing our handler to return HTTP 200 immediately without repeating state mutations or corrupting downstream ledger balances.
