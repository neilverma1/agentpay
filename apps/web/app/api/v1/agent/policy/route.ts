import { requireAuth } from '@/lib/auth-helpers';
import {
  getAgentSpentLast24Hours,
  getOrCreateAgentPolicy,
  updateAgentPolicy,
} from '@workspace/agent';
import { agent, db, eq } from '@workspace/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updatePolicySchema = z.object({
  maxDailySpendCents: z
    .number()
    .int()
    .positive()
    .max(1000000, 'Daily spend limit cannot exceed $10,000.00')
    .optional(),
  requireApprovalAboveCents: z
    .number()
    .int()
    .positive()
    .max(1000000, 'Approval threshold cannot exceed $10,000.00')
    .optional(),
  singleTransactionLimitCents: z
    .number()
    .int()
    .positive()
    .max(1000000, 'Single transaction limit cannot exceed $10,000.00')
    .optional(),
  requireApprovalForNonRefundable: z.boolean().optional(),
  blockedMerchantCategories: z.array(z.string()).optional(),
  allowedMerchantCategories: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { error: authError, session } = await requireAuth(req);
    if (authError || !session?.user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let defaultAgent = await db.query.agent.findFirst({
      where: eq(agent.userId, session.user.id),
    });

    if (!defaultAgent) {
      const [createdAgent] = await db
        .insert(agent)
        .values({
          userId: session.user.id,
          name: 'Primary Commerce Agent',
          description: 'Autonomous financial agent with spending guardrails',
          model: 'gemini-2.5-flash',
          status: 'active',
        })
        .returning();
      defaultAgent = createdAgent!;
    }

    const policy = await getOrCreateAgentPolicy(defaultAgent.id);
    const spentLast24HoursCents = await getAgentSpentLast24Hours(defaultAgent.id);
    const remainingDailySpendCents = Math.max(0, policy.maxDailySpendCents - spentLast24HoursCents);

    return NextResponse.json({
      agent: defaultAgent,
      policy: {
        id: policy.id,
        agentId: policy.agentId,
        maxDailySpendCents: policy.maxDailySpendCents,
        singleTransactionLimitCents: policy.singleTransactionLimitCents,
        requireApprovalAboveCents: policy.requireApprovalAboveCents,
        requireApprovalForNonRefundable: policy.requireApprovalForNonRefundable,
        blockedMerchantCategories: policy.blockedMerchantCategories,
        allowedMerchantCategories: policy.allowedMerchantCategories,
        currency: policy.currency,
        spentLast24HoursCents,
        remainingDailySpendCents,
      },
    });
  } catch (error) {
    console.error('Error fetching agent policy:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { error: authError, session } = await requireAuth(req);
    if (authError || !session?.user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let defaultAgent = await db.query.agent.findFirst({
      where: eq(agent.userId, session.user.id),
    });

    if (!defaultAgent) {
      const [createdAgent] = await db
        .insert(agent)
        .values({
          userId: session.user.id,
          name: 'Primary Commerce Agent',
          description: 'Autonomous financial agent with spending guardrails',
          model: 'gemini-2.5-flash',
          status: 'active',
        })
        .returning();
      defaultAgent = createdAgent!;
    }

    const body = await req.json().catch(() => ({}));
    const validated = updatePolicySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: validated.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const {
      maxDailySpendCents,
      requireApprovalAboveCents,
      singleTransactionLimitCents,
      requireApprovalForNonRefundable,
      blockedMerchantCategories,
      allowedMerchantCategories,
    } = validated.data;

    // Validate that approval threshold does not exceed max daily spend
    if (
      maxDailySpendCents &&
      requireApprovalAboveCents &&
      requireApprovalAboveCents > maxDailySpendCents
    ) {
      return NextResponse.json(
        { error: 'Approval threshold cannot exceed the maximum daily spend limit.' },
        { status: 400 },
      );
    }

    const updatedPolicy = await updateAgentPolicy({
      agentId: defaultAgent.id,
      maxDailySpendCents,
      requireApprovalAboveCents,
      singleTransactionLimitCents: singleTransactionLimitCents ?? maxDailySpendCents,
      requireApprovalForNonRefundable,
      blockedMerchantCategories,
      allowedMerchantCategories,
    });

    const spentLast24HoursCents = await getAgentSpentLast24Hours(defaultAgent.id);
    const remainingDailySpendCents = Math.max(
      0,
      updatedPolicy.maxDailySpendCents - spentLast24HoursCents,
    );

    return NextResponse.json({
      success: true,
      policy: {
        id: updatedPolicy.id,
        agentId: updatedPolicy.agentId,
        maxDailySpendCents: updatedPolicy.maxDailySpendCents,
        singleTransactionLimitCents: updatedPolicy.singleTransactionLimitCents,
        requireApprovalAboveCents: updatedPolicy.requireApprovalAboveCents,
        requireApprovalForNonRefundable: updatedPolicy.requireApprovalForNonRefundable,
        blockedMerchantCategories: updatedPolicy.blockedMerchantCategories,
        allowedMerchantCategories: updatedPolicy.allowedMerchantCategories,
        currency: updatedPolicy.currency,
        spentLast24HoursCents,
        remainingDailySpendCents,
      },
    });
  } catch (error) {
    console.error('Error updating agent policy:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
