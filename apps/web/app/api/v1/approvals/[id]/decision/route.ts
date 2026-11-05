import {
  AgentPurchaseError,
  executeApprovedPurchaseCapture,
  rejectPendingApproval,
} from '@/lib/agent/purchase';
import { requireAuth } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const decisionSchema = z.object({
  action: z.enum(['approve', 'reject'], {
    message: "Action must be either 'approve' or 'reject'",
  }),
  notes: z.string().max(500).optional(),
  approvalRequestId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  context?: { params?: Promise<{ id?: string }> | { id?: string } },
) {
  try {
    const { error: authError, session } = await requireAuth(req);
    if (authError || !session?.user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const validated = decisionSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: validated.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // Resolve approvalRequestId from 1) route params, 2) URL path, 3) body
    let approvalRequestId: string | undefined;

    if (context?.params) {
      const resolved = await Promise.resolve(context.params);
      approvalRequestId = resolved?.id;
    }

    if (!approvalRequestId) {
      const pathname = req.nextUrl?.pathname || new URL(req.url).pathname;
      const match = pathname.match(/\/approvals\/([^/]+)\/decision/);
      if (match?.[1]) {
        approvalRequestId = match[1];
      }
    }

    if (!approvalRequestId && typeof rawBody.approvalRequestId === 'string') {
      approvalRequestId = rawBody.approvalRequestId;
    }

    if (!approvalRequestId) {
      return NextResponse.json(
        { error: 'Approval request identifier is required' },
        { status: 400 },
      );
    }

    const { action, notes } = validated.data;

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
