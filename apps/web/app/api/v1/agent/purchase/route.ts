import { AgentPurchaseError, executeAgentPurchaseLoop } from '@/lib/agent/purchase';
import { requireAuth } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const purchaseRequestSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  prompt: z.string().min(1, 'prompt is required').max(500),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
});

export async function POST(req: NextRequest) {
  const { error: authError, session } = await requireAuth(req);
  if (authError || !session?.user) {
    return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawBody = await req.json().catch(() => ({}));
    const validated = purchaseRequestSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: validated.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { agentId, prompt, idempotencyKey } = validated.data;

    const result = await executeAgentPurchaseLoop({
      agentId,
      userId: session.user.id,
      prompt,
      idempotencyKey,
    });

    return NextResponse.json(result, { status: 200 });
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

    const message = error instanceof Error ? error.message : 'Unexpected internal purchase error';
    return NextResponse.json({ error: message, status: 'failed' }, { status: 500 });
  }
}
