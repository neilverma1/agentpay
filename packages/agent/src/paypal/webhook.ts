import { db, eq, purchaseIntent, sql, transaction, webhookEvent } from '@workspace/db';
import { getPayPalCredentials, isPayPalConfigured } from './client';
import { currencyStringToCents, isSimulationMode, sanitizeDetails } from './service';

export interface PayPalWebhookHeaders {
  authAlgo: string | null;
  certUrl: string | null;
  transmissionId: string | null;
  transmissionSig: string | null;
  transmissionTime: string | null;
}

export interface VerifySignatureParams {
  headers: PayPalWebhookHeaders;
  rawBody: string;
  webhookId?: string;
}

export interface WebhookVerificationResult {
  verified: boolean;
  mode: 'live' | 'simulation';
  reason?: string;
}

export interface ProcessWebhookResult {
  received: boolean;
  duplicate: boolean;
  eventId?: string;
  status: 'processed' | 'ignored' | 'failed' | 'duplicate';
  transactionId?: string;
  eventType?: string;
  message?: string;
}

// In memory token cache for PayPal OAuth access tokens
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export function extractPayPalHeaders(headers: Headers): PayPalWebhookHeaders {
  return {
    authAlgo: headers.get('paypal-auth-algo'),
    certUrl: headers.get('paypal-cert-url'),
    transmissionId: headers.get('paypal-transmission-id'),
    transmissionSig: headers.get('paypal-transmission-sig'),
    transmissionTime: headers.get('paypal-transmission-time'),
  };
}

export function isValidPayPalCertUrl(certUrl: string | null): boolean {
  if (!certUrl) return false;
  try {
    const url = new URL(certUrl);
    // Certificate URL must use HTTPS and reside on a genuine PayPal domain
    return (
      url.protocol === 'https:' && /^api(-m)?\.([a-zA-Z0-9-]+\.)?paypal\.com$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function getPayPalOAuthToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60000) {
    return cachedAccessToken.token;
  }

  const { clientId, clientSecret, environment } = getPayPalCredentials();
  const baseUrl =
    environment.toString().toLowerCase().includes('sandbox') ||
    process.env.PAYPAL_ENVIRONMENT !== 'production'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to retrieve PayPal OAuth token: ${response.status} ${errText}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

export async function verifyPayPalWebhookSignature(
  params: VerifySignatureParams,
): Promise<WebhookVerificationResult> {
  const { headers, rawBody } = params;
  const webhookId = params.webhookId || process.env.PAYPAL_WEBHOOK_ID || '';

  // 1. Simulation fallback mode
  if (isSimulationMode()) {
    return {
      verified: true,
      mode: 'simulation',
      reason: 'Simulation mode active; cryptographic signature verification bypassed.',
    };
  }

  // 2. Validate required headers presence
  if (
    !headers.authAlgo ||
    !headers.certUrl ||
    !headers.transmissionId ||
    !headers.transmissionSig ||
    !headers.transmissionTime
  ) {
    return {
      verified: false,
      mode: 'live',
      reason: 'Missing one or more required PayPal webhook transmission headers.',
    };
  }

  // 3. Security check: validate cert URL domain to prevent SSRF
  if (!isValidPayPalCertUrl(headers.certUrl)) {
    return {
      verified: false,
      mode: 'live',
      reason: 'Invalid or untrusted PayPal certificate URL hostname.',
    };
  }

  // 4. Check configuration
  if (!isPayPalConfigured() || !webhookId) {
    return {
      verified: false,
      mode: 'live',
      reason: 'PayPal client credentials or PAYPAL_WEBHOOK_ID is not configured.',
    };
  }

  // 5. Invoke PayPal official verify-webhook-signature REST API
  try {
    const accessToken = await getPayPalOAuthToken();
    const { environment } = getPayPalCredentials();
    const baseUrl =
      environment.toString().toLowerCase().includes('sandbox') ||
      process.env.PAYPAL_ENVIRONMENT !== 'production'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';

    let parsedWebhookEvent: Record<string, unknown> = {};
    try {
      parsedWebhookEvent = JSON.parse(rawBody);
    } catch {
      return {
        verified: false,
        mode: 'live',
        reason: 'Malformed JSON webhook payload.',
      };
    }

    const verificationPayload = {
      auth_algo: headers.authAlgo,
      cert_url: headers.certUrl,
      transmission_id: headers.transmissionId,
      transmission_sig: headers.transmissionSig,
      transmission_time: headers.transmissionTime,
      webhook_id: webhookId,
      webhook_event: parsedWebhookEvent,
    };

    const verifyResponse = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verificationPayload),
    });

    if (!verifyResponse.ok) {
      const errBody = await verifyResponse.text();
      return {
        verified: false,
        mode: 'live',
        reason: `PayPal verification API responded with status ${verifyResponse.status}: ${errBody}`,
      };
    }

    const verificationResult = (await verifyResponse.json()) as { verification_status?: string };
    const isSuccess = verificationResult.verification_status === 'SUCCESS';

    return {
      verified: isSuccess,
      mode: 'live',
      reason: isSuccess
        ? undefined
        : `PayPal verification returned status: ${verificationResult.verification_status}`,
    };
  } catch (error) {
    return {
      verified: false,
      mode: 'live',
      reason:
        error instanceof Error ? error.message : 'Unknown error during signature verification',
    };
  }
}

export interface ReconcilePayload {
  id: string;
  event_type: string;
  resource_type: string;
  summary?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    status?: string;
    amount?: {
      currency_code?: string;
      value?: string;
    };
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
        capture_id?: string;
      };
    };
    status_details?: {
      reason?: string;
    };
    create_time?: string;
    update_time?: string;
  };
}

export async function processVerifiedWebhook(params: {
  transmissionId: string;
  payload: ReconcilePayload;
  rawHeaders: Record<string, unknown>;
  paypalWebhookId?: string;
}): Promise<ProcessWebhookResult> {
  const { transmissionId, payload, rawHeaders, paypalWebhookId } = params;
  const eventType = payload.event_type || 'UNKNOWN';
  const resourceType = payload.resource_type || 'unknown';
  const summary = payload.summary || null;

  // 1. Replay defense check
  const existingEvents = await db
    .select()
    .from(webhookEvent)
    .where(eq(webhookEvent.transmissionId, transmissionId))
    .limit(1);

  if (existingEvents.length > 0) {
    const existing = existingEvents[0]!;
    return {
      received: true,
      duplicate: true,
      eventId: existing.id,
      status: 'duplicate',
      eventType: existing.eventType,
      message: 'Webhook transmission already received and processed.',
    };
  }

  // 2. Insert new webhook event record in received status
  const [createdEvent] = await db
    .insert(webhookEvent)
    .values({
      paypalWebhookId: paypalWebhookId || null,
      transmissionId,
      eventType,
      resourceType,
      summary,
      status: 'received',
      rawHeaders,
      payload: sanitizeDetails(payload),
    })
    .returning();

  if (!createdEvent) {
    throw new Error('Failed to record incoming webhook event in database.');
  }

  // 3. Resolve target transaction record
  const resource = payload.resource || {};
  const resourceId = resource.id; // e.g. capture id
  const relatedOrderId = resource.supplementary_data?.related_ids?.order_id;
  const customId = resource.custom_id; // purchaseIntentId

  let matchedTransaction = null;

  if (resourceId) {
    const byCapture = await db
      .select()
      .from(transaction)
      .where(eq(transaction.paypalCaptureId, resourceId))
      .limit(1);
    if (byCapture.length > 0) {
      matchedTransaction = byCapture[0]!;
    }
  }

  if (!matchedTransaction && relatedOrderId) {
    const byOrder = await db
      .select()
      .from(transaction)
      .where(eq(transaction.paypalOrderId, relatedOrderId))
      .limit(1);
    if (byOrder.length > 0) {
      matchedTransaction = byOrder[0]!;
    }
  }

  if (!matchedTransaction && customId) {
    const byCustomId = await db
      .select()
      .from(transaction)
      .where(eq(transaction.purchaseIntentId, customId))
      .limit(1);
    if (byCustomId.length > 0) {
      matchedTransaction = byCustomId[0]!;
    }
  }

  // 4. Handle unmatched event
  if (!matchedTransaction) {
    await db
      .update(webhookEvent)
      .set({
        status: 'ignored',
        errorMessage: 'No matching transaction found in database for resource identifiers.',
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookEvent.id, createdEvent.id));

    return {
      received: true,
      duplicate: false,
      eventId: createdEvent.id,
      status: 'ignored',
      eventType,
      message: 'Event recorded but ignored: no matching transaction found.',
    };
  }

  // 5. Execute state reconciliation per event type
  const now = new Date();

  try {
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      // Guard monotonic state: never revert refunded or terminal failure
      if (matchedTransaction.status === 'refunded' || matchedTransaction.status === 'failed') {
        await db
          .update(webhookEvent)
          .set({
            status: 'ignored',
            summary: `Ignored: transaction is in terminal status ${matchedTransaction.status}`,
            processedAt: now,
            updatedAt: now,
          })
          .where(eq(webhookEvent.id, createdEvent.id));

        return {
          received: true,
          duplicate: false,
          eventId: createdEvent.id,
          status: 'ignored',
          transactionId: matchedTransaction.id,
          eventType,
          message: `Transaction already in terminal state ${matchedTransaction.status}.`,
        };
      }

      await db.transaction(async (tx) => {
        await tx
          .update(transaction)
          .set({
            status: 'completed',
            capturedAt: resource.create_time ? new Date(resource.create_time) : now,
            paypalCaptureId: resourceId || matchedTransaction.paypalCaptureId,
            rawPaypalResponse: sanitizeDetails(resource),
            updatedAt: now,
          })
          .where(eq(transaction.id, matchedTransaction.id));

        await tx
          .update(purchaseIntent)
          .set({
            status: 'completed',
            updatedAt: now,
          })
          .where(eq(purchaseIntent.id, matchedTransaction.purchaseIntentId));

        await tx
          .update(webhookEvent)
          .set({
            status: 'processed',
            processedAt: now,
            updatedAt: now,
          })
          .where(eq(webhookEvent.id, createdEvent.id));
      });

      return {
        received: true,
        duplicate: false,
        eventId: createdEvent.id,
        status: 'processed',
        transactionId: matchedTransaction.id,
        eventType,
      };
    }

    if (eventType === 'PAYMENT.CAPTURE.DENIED') {
      const denialReason =
        resource.status_details?.reason || summary || 'PayPal capture payment denied.';

      await db.transaction(async (tx) => {
        await tx
          .update(transaction)
          .set({
            status: 'failed',
            rawPaypalResponse: sanitizeDetails(resource),
            updatedAt: now,
          })
          .where(eq(transaction.id, matchedTransaction.id));

        await tx
          .update(purchaseIntent)
          .set({
            status: 'failed',
            rejectionReason: denialReason,
            updatedAt: now,
          })
          .where(eq(purchaseIntent.id, matchedTransaction.purchaseIntentId));

        await tx
          .update(webhookEvent)
          .set({
            status: 'processed',
            processedAt: now,
            updatedAt: now,
          })
          .where(eq(webhookEvent.id, createdEvent.id));
      });

      return {
        received: true,
        duplicate: false,
        eventId: createdEvent.id,
        status: 'processed',
        transactionId: matchedTransaction.id,
        eventType,
      };
    }

    if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      const refundCents = resource.amount?.value ? currencyStringToCents(resource.amount.value) : 0;

      await db.transaction(async (tx) => {
        await tx
          .update(transaction)
          .set({
            status: 'refunded',
            refundedAmountCents: sql`${transaction.refundedAmountCents} + ${refundCents}`,
            rawPaypalResponse: sanitizeDetails(resource),
            updatedAt: now,
          })
          .where(eq(transaction.id, matchedTransaction.id));

        await tx
          .update(webhookEvent)
          .set({
            status: 'processed',
            processedAt: now,
            updatedAt: now,
          })
          .where(eq(webhookEvent.id, createdEvent.id));
      });

      return {
        received: true,
        duplicate: false,
        eventId: createdEvent.id,
        status: 'processed',
        transactionId: matchedTransaction.id,
        eventType,
      };
    }

    // Unhandled event type (e.g. CHECKOUT.ORDER.APPROVED)
    await db
      .update(webhookEvent)
      .set({
        status: 'ignored',
        summary: `Ignored unhandled event type: ${eventType}`,
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(webhookEvent.id, createdEvent.id));

    return {
      received: true,
      duplicate: false,
      eventId: createdEvent.id,
      status: 'ignored',
      transactionId: matchedTransaction.id,
      eventType,
      message: `Event type ${eventType} recorded but not handled for transaction state sync.`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await db
      .update(webhookEvent)
      .set({
        status: 'failed',
        errorMessage: errorMsg,
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(webhookEvent.id, createdEvent.id));

    throw error;
  }
}
