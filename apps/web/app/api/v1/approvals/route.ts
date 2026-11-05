import {
  AgentPurchaseError,
  executeApprovedPurchaseCapture,
  rejectPendingApproval,
} from '@/lib/agent/purchase';
import { requireAuth } from '@/lib/auth-helpers';
import {
  agent,
  and,
  approvalRequest,
  db,
  desc,
  eq,
  purchaseIntent,
  type ApprovalRequestStatus,
} from '@workspace/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const collectionDecisionSchema = z.object({
  approvalRequestId: z.string().min(1, 'approvalRequestId is required'),
  action: z.enum(['approve', 'reject'], {
    message: "Action must be either 'approve' or 'reject'",
  }),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const { error: authError, session } = await requireAuth(req);
  if (authError || !session?.user) {
    return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawBody = await req.json().catch(() => ({}));
    const validated = collectionDecisionSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: validated.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { approvalRequestId, action, notes } = validated.data;

    if (action === 'approve') {
      const result = await executeApprovedPurchaseCapture({
        approvalRequestId,
        reviewerId: session.user.id,
        notes,
      });

      return NextResponse.json(
        {
          status: 'completed',
          approvalRequestId,
          result,
        },
        { status: 200 },
      );
    } else {
      const result = await rejectPendingApproval({
        approvalRequestId,
        reviewerId: session.user.id,
        notes,
      });

      return NextResponse.json(
        {
          status: 'rejected',
          approvalRequestId,
          result,
        },
        { status: 200 },
      );
    }
  } catch (error) {
    if (error instanceof AgentPurchaseError) {
      return NextResponse.json(
        {
          error: error.message,
          status: 'failed',
          purchaseIntentId: error.purchaseIntentId,
          transactionId: error.transactionId,
          details: error.details,
        },
        { status: error.statusCode },
      );
    }

    const message = error instanceof Error ? error.message : 'Internal approval decision error';
    return NextResponse.json({ error: message, status: 'failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { error: authError, session } = await requireAuth(req);
  if (authError || !session?.user) {
    return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = (searchParams.get('status') || 'pending') as ApprovalRequestStatus;

  try {
    const rawApprovals = await db
      .select({
        id: approvalRequest.id,
        purchaseIntentId: approvalRequest.purchaseIntentId,
        agentId: approvalRequest.agentId,
        status: approvalRequest.status,
        ruleTriggered: approvalRequest.ruleTriggered,
        triggerDetails: approvalRequest.triggerDetails,
        notes: approvalRequest.notes,
        reviewedAt: approvalRequest.reviewedAt,
        createdAt: approvalRequest.createdAt,
        agentName: agent.name,
        prompt: purchaseIntent.prompt,
        itemDescription: purchaseIntent.itemDescription,
        merchantName: purchaseIntent.merchantName,
        merchantCategory: purchaseIntent.merchantCategory,
        estimatedAmountCents: purchaseIntent.estimatedAmountCents,
        currency: purchaseIntent.currency,
        intentStatus: purchaseIntent.status,
      })
      .from(approvalRequest)
      .innerJoin(agent, eq(approvalRequest.agentId, agent.id))
      .innerJoin(purchaseIntent, eq(approvalRequest.purchaseIntentId, purchaseIntent.id))
      .where(
        and(
          eq(agent.userId, session.user.id),
          statusParam ? eq(approvalRequest.status, statusParam) : undefined,
        ),
      )
      .orderBy(desc(approvalRequest.createdAt));

    return NextResponse.json(
      {
        approvals: rawApprovals,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve approval requests';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
