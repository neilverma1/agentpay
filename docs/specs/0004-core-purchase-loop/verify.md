# Verification Plan: 0004. Core purchase loop

This plan guides verification of the core purchase loop using automated tests and manual walkthroughs against PayPal Sandbox.

## Automated verification

1. Unit tests for PayPal client and order formatting:
   - Verify amount formatting converts cents to currency string with two decimals (for example, 1500 to "15.00").
   - Verify order payload includes custom_id matching purchase intent identifier.
2. Integration tests for route handler `POST /api/v1/agent/purchase`:
   - Unauthenticated requests return HTTP 401.
   - Requests targeting non existent or unauthorized agents return HTTP 404 or HTTP 403.
   - Duplicate idempotency key returns existing record without creating duplicate transactions.
   - Mocked PayPal capture failure returns HTTP 422 with structured failure payload.

## Manual walkthrough

1. Prerequisites:
   - Ensure `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are present in `.env.local`.
   - Ensure database migrations are applied and the local server is running.
2. Step 1: Submit purchase prompt:
   - Open the web dashboard and locate the purchase prompt bar.
   - Enter prompt: "Buy cloud compute credits for 10 dollars".
   - Click the execute purchase button.
3. Step 2: Observe agent reasoning:
   - Confirm that the UI reflects processing state.
   - Verify that reasoning logs display parsed merchant details and estimated price.
4. Step 3: Verify PayPal sandbox transaction:
   - Confirm that the UI renders the completed transaction summary card with a valid PayPal capture identifier.
   - Check the PayPal Developer Dashboard for the sandbox merchant account to confirm the captured order appears with the matching amount.
5. Step 4: Database verification:
   - Inspect the `purchase_intent` and `transaction` tables in PostgreSQL to verify consistent status ("completed"), matching identifiers, and complete reasoning log entries.
