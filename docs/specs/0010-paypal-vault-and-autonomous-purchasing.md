# Spec 0010: PayPal Vault & Autonomous Purchasing

## Status

Implemented

## Context

When running in live sandbox mode (`PAYPAL_SIMULATION=false`), standard PayPal Checkout orders require real-time buyer redirect and approval (`ORDER_NOT_APPROVED`), preventing agents from executing autonomous purchases. Additionally, raw card processing (`payment_source.card`) fails with `PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING` on accounts without Advanced Credit & Debit Card permissions.

To achieve seamless, fully autonomous agent spending while respecting policy limits and PCI DSS compliance, we use PayPal Vault (`/v3/vault/setup-tokens` and `/v3/vault/payment-tokens`).

## Architecture & Flow

1. **One-Time User Setup**:
   - The user visits Settings (`/settings/general`).
   - Clicks **Link PayPal**, invoking `POST /api/v1/paypal/vault/link`.
   - Backend calls PayPal Vault API to generate a setup token with `returnUrl` pointing to `/api/v1/paypal/vault/return`.
   - The user approves once on PayPal's sandbox authentication page.
   - Upon return, backend exchanges the setup token for a permanent payment token (`vaultId`) and stores it in `paypal_vault`.

2. **Autonomous Execution**:
   - When the agent executes a purchase (under auto-approve threshold or after human in-thread approval):
   - Backend checks user's `vaultId` from `paypal_vault`.
   - `createPayPalOrder` submits `paymentSource.paypal.vaultId`.
   - The order is pre-authorized by the vaulted instrument and captured autonomously without human interruption.

## Data Model

- `paypal_vault`:
  - `id`: UUID (Primary Key)
  - `userId`: Text (Foreign Key to `user.id`, Unique)
  - `vaultId`: Text (Non-null, PayPal payment method token)
  - `paypalCustomerId`: Text (Optional)
  - `payerEmail`: Text (Optional)
  - `createdAt`: Timestamp with timezone
  - `updatedAt`: Timestamp with timezone

## Verification

- Run `pnpm --filter web check-types`
- Run `pnpm --filter @workspace/db db:migrate`
- User connects PayPal in `/settings/general` and runs an agent prompt in `/chat`.
