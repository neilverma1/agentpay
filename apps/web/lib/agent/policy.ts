import { agentPolicy, and, db, eq, gte, sql, transaction, type AgentPolicy } from '@workspace/db';

export type PolicyDecision = 'auto_approve' | 'requires_approval' | 'rejected';

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  ruleTriggered?: string;
  triggerDetails?: Record<string, unknown>;
  spentLast24HoursCents: number;
  reason: string;
}

export interface EvaluatePolicyParams {
  policy: AgentPolicy;
  spentLast24HoursCents: number;
  estimatedAmountCents: number;
  merchantCategory?: string | null;
  refundable?: boolean;
}

export const DEFAULT_POLICY_CONFIG = {
  maxDailySpendCents: 50000, // $500.00 daily spend cap
  singleTransactionLimitCents: 50000, // $500.00 single transaction ceiling
  requireApprovalAboveCents: 5000, // $50.00 human approval trigger threshold
  requireApprovalForNonRefundable: false, // Strict Compliance Mode: false allows micro-spending
  allowedMerchantCategories: [] as string[], // Empty array allows all non-blocked categories
  blockedMerchantCategories: [
    'gambling',
    'adult_content',
    'weapons',
    'crypto_exchange',
  ] as string[],
  currency: 'USD',
} as const;

export interface UpdateAgentPolicyParams {
  agentId: string;
  maxDailySpendCents?: number;
  singleTransactionLimitCents?: number;
  requireApprovalAboveCents?: number;
  requireApprovalForNonRefundable?: boolean;
  blockedMerchantCategories?: string[];
  allowedMerchantCategories?: string[];
}

/**
 * Updates an agent spending policy with new limits or category restrictions.
 */
export async function updateAgentPolicy(params: UpdateAgentPolicyParams): Promise<AgentPolicy> {
  const { agentId, ...updates } = params;
  await getOrCreateAgentPolicy(agentId);

  const [updated] = await db
    .update(agentPolicy)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(agentPolicy.agentId, agentId))
    .returning();

  if (!updated) {
    throw new Error(`Failed to update policy for agent ${agentId}`);
  }

  return updated;
}

/**
 * Retrieves the spending policy configured for an agent, or automatically seeds
 * a conservative default policy if none exists yet.
 */
export async function getOrCreateAgentPolicy(agentId: string): Promise<AgentPolicy> {
  const existingPolicy = await db.query.agentPolicy.findFirst({
    where: eq(agentPolicy.agentId, agentId),
  });

  if (existingPolicy) {
    return existingPolicy;
  }

  const [createdPolicy] = await db
    .insert(agentPolicy)
    .values({
      agentId,
      maxDailySpendCents: DEFAULT_POLICY_CONFIG.maxDailySpendCents,
      singleTransactionLimitCents: DEFAULT_POLICY_CONFIG.singleTransactionLimitCents,
      requireApprovalAboveCents: DEFAULT_POLICY_CONFIG.requireApprovalAboveCents,
      requireApprovalForNonRefundable: DEFAULT_POLICY_CONFIG.requireApprovalForNonRefundable,
      allowedMerchantCategories: DEFAULT_POLICY_CONFIG.allowedMerchantCategories,
      blockedMerchantCategories: DEFAULT_POLICY_CONFIG.blockedMerchantCategories,
      currency: DEFAULT_POLICY_CONFIG.currency,
    })
    .returning();

  if (!createdPolicy) {
    throw new Error(`Failed to initialize default policy for agent ${agentId}`);
  }

  return createdPolicy;
}

/**
 * Aggregates all completed transaction amounts for the given agent in the last 24 hours.
 * Uses a rolling 24 hour window calculated in PostgreSQL.
 */
export async function getAgentSpentLast24Hours(agentId: string): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await db
    .select({
      totalSpent: sql<number>`coalesce(sum(${transaction.amountCents}), 0)::int`,
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.agentId, agentId),
        eq(transaction.status, 'completed'),
        gte(sql`coalesce(${transaction.capturedAt}, ${transaction.createdAt})`, cutoff),
      ),
    );

  return result[0]?.totalSpent ?? 0;
}

/**
 * Pure evaluation function assessing an intent against spending policies and 24-hour spend ledger.
 * Evaluates in priority order:
 * 1. Single transaction hard ceiling
 * 2. Rolling 24 hour daily spend cap
 * 3. Blocked merchant categories
 * 4. Allowed merchant categories (if non-empty whitelist exists)
 * 5. Require human approval threshold
 * 6. Autonomous approval
 */
export function evaluateSpendingPolicy(params: EvaluatePolicyParams): PolicyEvaluationResult {
  const { policy, spentLast24HoursCents, estimatedAmountCents, merchantCategory, refundable } =
    params;

  const normalizedCategory = merchantCategory?.trim().toLowerCase() || null;
  const blockedCategories = (policy.blockedMerchantCategories || []).map((c) =>
    c.trim().toLowerCase(),
  );
  const allowedCategories = (policy.allowedMerchantCategories || []).map((c) =>
    c.trim().toLowerCase(),
  );

  // 1. Hard Check: Single transaction limit
  if (estimatedAmountCents > policy.singleTransactionLimitCents) {
    return {
      decision: 'rejected',
      ruleTriggered: 'single_limit_exceeded',
      triggerDetails: {
        estimatedAmountCents,
        singleTransactionLimitCents: policy.singleTransactionLimitCents,
      },
      spentLast24HoursCents,
      reason: `Estimated amount ($${(estimatedAmountCents / 100).toFixed(2)}) exceeds single transaction ceiling ($${(policy.singleTransactionLimitCents / 100).toFixed(2)}).`,
    };
  }

  // 2. Hard Check: Rolling 24 hour daily spend cap
  const projectedDailySpend = spentLast24HoursCents + estimatedAmountCents;
  if (projectedDailySpend > policy.maxDailySpendCents) {
    return {
      decision: 'rejected',
      ruleTriggered: 'daily_cap_exceeded',
      triggerDetails: {
        estimatedAmountCents,
        spentLast24HoursCents,
        projectedDailySpend,
        maxDailySpendCents: policy.maxDailySpendCents,
      },
      spentLast24HoursCents,
      reason: `Projected 24-hour spend ($${(projectedDailySpend / 100).toFixed(2)}) exceeds daily cap ($${(policy.maxDailySpendCents / 100).toFixed(2)}). Currently spent in last 24h: $${(spentLast24HoursCents / 100).toFixed(2)}.`,
    };
  }

  // 3. Hard Check: Blocked merchant categories
  if (normalizedCategory && blockedCategories.includes(normalizedCategory)) {
    return {
      decision: 'rejected',
      ruleTriggered: 'blocked_category',
      triggerDetails: {
        merchantCategory: normalizedCategory,
        blockedCategories,
      },
      spentLast24HoursCents,
      reason: `Merchant category '${normalizedCategory}' is prohibited by agent policy.`,
    };
  }

  // 4. Soft Check: Whitelist category verification (if configured)
  if (allowedCategories.length > 0) {
    if (!normalizedCategory || !allowedCategories.includes(normalizedCategory)) {
      return {
        decision: 'requires_approval',
        ruleTriggered: 'category_review_required',
        triggerDetails: {
          merchantCategory: normalizedCategory || 'unspecified',
          allowedCategories,
        },
        spentLast24HoursCents,
        reason: `Merchant category '${normalizedCategory || 'unspecified'}' is not in the pre-approved category list.`,
      };
    }
  }

  // 5. Soft Check: Strict Compliance Mode for final-sale / non-refundable items
  if (policy.requireApprovalForNonRefundable && refundable === false) {
    return {
      decision: 'requires_approval',
      ruleTriggered: 'strict_compliance_non_refundable',
      triggerDetails: {
        refundable: false,
        requireApprovalForNonRefundable: true,
        estimatedAmountCents,
      },
      spentLast24HoursCents,
      reason:
        'Requires operator authorization: Strict Compliance Mode is enabled for final-sale (non-refundable) items.',
    };
  }

  // 6. Soft Check: Human approval threshold
  if (estimatedAmountCents > policy.requireApprovalAboveCents) {
    return {
      decision: 'requires_approval',
      ruleTriggered: 'require_approval_above_cents',
      triggerDetails: {
        estimatedAmountCents,
        requireApprovalAboveCents: policy.requireApprovalAboveCents,
        spentLast24HoursCents,
      },
      spentLast24HoursCents,
      reason: `Estimated amount ($${(estimatedAmountCents / 100).toFixed(2)}) exceeds autonomous approval threshold ($${(policy.requireApprovalAboveCents / 100).toFixed(2)}).`,
    };
  }

  // 7. Autonomous approval
  return {
    decision: 'auto_approve',
    spentLast24HoursCents,
    reason: `Purchase satisfies all spending policy guardrails. Estimated: $${(estimatedAmountCents / 100).toFixed(2)}, 24h spend: $${(spentLast24HoursCents / 100).toFixed(2)} / $${(policy.maxDailySpendCents / 100).toFixed(2)}.`,
  };
}
