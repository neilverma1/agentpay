import { FreezeServiceError, toggleAgentFreeze } from '@/lib/agent/freeze';
import { requireAuth } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const freezeRequestSchema = z.object({
  action: z.enum(['freeze', 'unfreeze']),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, props: { params: Promise<{ agentId: string }> }) {
  const { error: authError, session } = await requireAuth(req);
  if (authError || !session?.user) {
    return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { agentId } = await props.params;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const validated = freezeRequestSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: validated.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { action, reason } = validated.data;
    const result = await toggleAgentFreeze({
      agentId,
      userId: session.user.id,
      action,
      reason,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof FreezeServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    const message = error instanceof Error ? error.message : 'Failed to update agent freeze state';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
