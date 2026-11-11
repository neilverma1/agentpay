import { searchOffers } from '@/lib/agent/catalog';
import { requireAuth } from '@/lib/auth-helpers';
import { refundPayPalCapture } from '@/lib/paypal/service';
import {
  approvalRequest,
  chatMessage,
  db,
  eq,
  or,
  purchaseIntent,
  transaction,
} from '@workspace/db';
import { NextRequest, NextResponse } from 'next/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  context?: { params?: Promise<{ id?: string }> | { id?: string } },
) {
  try {
    const { error: authError, session } = await requireAuth(req);
    if (authError || !session?.user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // 1. Resolve identifier: route param or request body
    let targetId: string | undefined;

    if (context?.params) {
      const resolved = await Promise.resolve(context.params);
      targetId = resolved?.id;
    }

    if (!targetId || targetId.startsWith('card-')) {
      const pathname = req.nextUrl?.pathname || new URL(req.url).pathname;
      const match = pathname.match(/\/purchases\/([^/]+)\/refund/);
      if (match?.[1] && !match[1].startsWith('card-')) {
        targetId = match[1];
      }
    }

    if (!targetId || targetId.startsWith('card-')) {
      if (typeof rawBody.transactionId === 'string' && rawBody.transactionId) {
        targetId = rawBody.transactionId;
      } else if (typeof rawBody.purchaseIntentId === 'string' && rawBody.purchaseIntentId) {
        targetId = rawBody.purchaseIntentId;
      } else if (typeof rawBody.paypalCaptureId === 'string' && rawBody.paypalCaptureId) {
        targetId = rawBody.paypalCaptureId;
      }
    }

    if (!targetId) {
      return NextResponse.json(
        { error: 'A purchase or transaction identifier is required for refund processing.' },
        { status: 400 },
      );
    }

    // 2. Query transaction safely without triggering invalid UUID cast exceptions
    const isUuid = UUID_REGEX.test(targetId);

    const matchedTx = isUuid
      ? await db.query.transaction.findFirst({
          where: or(eq(transaction.id, targetId), eq(transaction.purchaseIntentId, targetId)),
        })
      : await db.query.transaction.findFirst({
          where: or(
            eq(transaction.paypalCaptureId, targetId),
            eq(transaction.paypalOrderId, targetId),
          ),
        });

    if (!matchedTx) {
      return NextResponse.json(
        { error: 'Transaction not found for the provided identifier.' },
        { status: 404 },
      );
    }

    // 3. Prevent duplicate refunds
    if (matchedTx.status === 'refunded') {
      return NextResponse.json(
        {
          error: 'Transaction has already been refunded.',
          transactionId: matchedTx.id,
          status: 'refunded',
          refundedAmountCents: matchedTx.refundedAmountCents,
        },
        { status: 409 },
      );
    }

    // 4. Look up associated intent and approval to enforce non-refundable (Final Sale) terms
    const intent = await db.query.purchaseIntent.findFirst({
      where: eq(purchaseIntent.id, matchedTx.purchaseIntentId),
    });

    const approval = intent
      ? await db.query.approvalRequest.findFirst({
          where: eq(approvalRequest.purchaseIntentId, intent.id),
        })
      : null;

    let isRefundable = true;
    let refundTerms: string | undefined;

    // Check trigger details from approval
    if (approval && approval.triggerDetails) {
      const details = approval.triggerDetails as Record<string, unknown>;
      if (details.refundable === false) {
        isRefundable = false;
        refundTerms = typeof details.refundTerms === 'string' ? details.refundTerms : undefined;
      }
    }

    // Check catalog matching
    if (isRefundable && intent) {
      const matchedOffer = searchOffers(intent.itemDescription, 1)[0];
      if (matchedOffer && matchedOffer.refundable === false) {
        isRefundable = false;
        refundTerms = matchedOffer.refundTerms;
      }
    }

    if (!isRefundable) {
      return NextResponse.json(
        {
          error:
            refundTerms ||
            'This purchase is marked as final sale and cannot be refunded under merchant return terms.',
          isRefundable: false,
        },
        { status: 400 },
      );
    }

    // 5. Execute PayPal Capture Refund via SDK / simulation
    const captureId = matchedTx.paypalCaptureId || `SIMULATED-CAPTURE-${matchedTx.id}`;
    const userReason = typeof rawBody.reason === 'string' ? rawBody.reason : undefined;

    const refundResult = await refundPayPalCapture(
      captureId,
      matchedTx.amountCents,
      matchedTx.currency,
      userReason || 'Autonomous purchase refund requested via AgentPay',
    );

    const now = new Date();
    const finalRefundedAmount = refundResult.refundedAmountCents || matchedTx.amountCents;

    // 6. Update transaction state (instantly restoring rolling 24h spend ledger)
    await db
      .update(transaction)
      .set({
        status: 'refunded',
        refundedAmountCents: finalRefundedAmount,
        updatedAt: now,
      })
      .where(eq(transaction.id, matchedTx.id));

    // 7. Update purchase intent reasoning log
    if (intent) {
      const currentLogs = Array.isArray(intent.reasoningLog) ? [...intent.reasoningLog] : [];
      currentLogs.push({
        step: currentLogs.length + 1,
        toolName: 'refund_capture',
        thought: `Refund of $${(finalRefundedAmount / 100).toFixed(2)} issued via PayPal (${refundResult.refundId}). Capture ${captureId} reversed and excluded from rolling spend ledger.`,
        input: {
          captureId,
          amountCents: finalRefundedAmount,
          currency: matchedTx.currency,
          reason: userReason ?? null,
        },
        output: {
          refundId: refundResult.refundId,
          status: refundResult.status,
          refundedAmountCents: finalRefundedAmount,
        },
        timestamp: now.toISOString(),
      });

      await db
        .update(purchaseIntent)
        .set({
          reasoningLog: currentLogs as Array<Record<string, unknown>>,
          updatedAt: now,
        })
        .where(eq(purchaseIntent.id, intent.id));
    }

    // 8. Update any persisted chat message action cards for immediate hydration
    try {
      const relatedMessages = await db.query.chatMessage.findMany({
        where: eq(chatMessage.purchaseIntentId, matchedTx.purchaseIntentId),
      });

      for (const msg of relatedMessages) {
        if (Array.isArray(msg.parts)) {
          let modified = false;
          const updatedParts = (msg.parts as Array<Record<string, unknown>>).map((part) => {
            if (
              part &&
              part.type === 'action_card' &&
              (part.cardType === 'payment_completed' || part.status === 'completed')
            ) {
              modified = true;
              return {
                ...part,
                status: 'refunded',
                refundedAmountCents: finalRefundedAmount,
                refundId: refundResult.refundId,
                refundedAt: now.toISOString(),
              };
            }
            return part;
          });

          if (modified) {
            await db
              .update(chatMessage)
              .set({ parts: updatedParts })
              .where(eq(chatMessage.id, msg.id));
          }
        }
      }
    } catch (msgErr) {
      console.warn('Failed to update chat message parts after refund:', msgErr);
    }

    return NextResponse.json(
      {
        success: true,
        transactionId: matchedTx.id,
        purchaseIntentId: matchedTx.purchaseIntentId,
        paypalCaptureId: matchedTx.paypalCaptureId,
        refundId: refundResult.refundId,
        status: 'refunded',
        refundedAmountCents: finalRefundedAmount,
        currency: matchedTx.currency,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error executing refund:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
