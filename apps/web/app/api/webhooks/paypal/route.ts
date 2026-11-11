import {
  extractPayPalHeaders,
  processVerifiedWebhook,
  verifyPayPalWebhookSignature,
  type ReconcilePayload,
} from '@workspace/agent/paypal';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ error: 'Empty request body received' }, { status: 400 });
    }

    const headers = extractPayPalHeaders(req.headers);

    let parsedPayload: ReconcilePayload;
    try {
      parsedPayload = JSON.parse(rawBody) as ReconcilePayload;
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    // Cryptographic signature verification with simulation fallback
    const verification = await verifyPayPalWebhookSignature({
      headers,
      rawBody,
    });

    if (!verification.verified) {
      return NextResponse.json(
        {
          error: 'PayPal webhook signature verification failed',
          reason: verification.reason,
        },
        { status: 400 },
      );
    }

    const transmissionId =
      headers.transmissionId ||
      parsedPayload.id ||
      `sim-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const rawHeadersRecord: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      rawHeadersRecord[key] = value;
    });

    const result = await processVerifiedWebhook({
      transmissionId,
      payload: parsedPayload,
      rawHeaders: rawHeadersRecord,
      paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID,
    });

    return NextResponse.json(
      {
        received: true,
        duplicate: result.duplicate,
        eventId: result.eventId,
        status: result.status,
        transactionId: result.transactionId,
        eventType: result.eventType,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('PayPal webhook handler error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error while processing webhook',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
