import { selectOfferForPrompt } from '@/lib/agent/buyer-agent';
import {
  evaluateSpendingPolicy,
  getAgentSpentLast24Hours,
  getOrCreateAgentPolicy,
} from '@/lib/agent/policy';
import {
  capturePayPalOrder,
  createPayPalOrder,
  currencyStringToCents,
  PayPalServiceError,
  sanitizeDetails,
} from '@/lib/paypal/service';
import {
  agent,
  and,
  approvalRequest,
  chatMessage,
  db,
  eq,
  purchaseIntent,
  transaction,
} from '@workspace/db';

export const APPROVAL_REQUEST_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ExecutePurchaseParams {
  agentId: string;
  userId: string;
  prompt: string;
  idempotencyKey: string;
}

export interface ReasoningStep {
  step: number;
  toolName: string;
  thought: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  timestamp: string;
}

export interface PurchaseExecutionResult {
  purchaseIntentId: string;
  transactionId: string;
  paypalOrderId: string;
  paypalCaptureId: string;
  amountCents: number;
  currency: string;
  status: string;
  itemDescription: string;
  merchantName: string;
  merchantCategory?: string;
  reasoningLog: ReasoningStep[];
  capturedAt?: string;
  error?: string;
  approvalRequestId?: string;
  ruleTriggered?: string;
}

export class AgentPurchaseError extends Error {
  statusCode: number;
  purchaseIntentId?: string;
  transactionId?: string;
  details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    purchaseIntentId?: string,
    transactionId?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AgentPurchaseError';
    this.statusCode = statusCode;
    this.purchaseIntentId = purchaseIntentId;
    this.transactionId = transactionId;
    this.details = sanitizeDetails(details);
  }
}

export async function executeAgentPurchaseLoop(
  params: ExecutePurchaseParams,
): Promise<PurchaseExecutionResult> {
  const { agentId, userId, prompt, idempotencyKey } = params;

  // 1. Idempotency Check
  const existingIntent = await db.query.purchaseIntent.findFirst({
    where: eq(purchaseIntent.idempotencyKey, idempotencyKey),
  });

  if (existingIntent) {
    const existingTx = await db.query.transaction.findFirst({
      where: eq(transaction.purchaseIntentId, existingIntent.id),
    });

    const existingApproval = await db.query.approvalRequest.findFirst({
      where: eq(approvalRequest.purchaseIntentId, existingIntent.id),
    });

    return {
      purchaseIntentId: existingIntent.id,
      transactionId: existingTx?.id ?? '',
      paypalOrderId: existingTx?.paypalOrderId ?? '',
      paypalCaptureId: existingTx?.paypalCaptureId ?? '',
      amountCents: existingTx?.amountCents ?? existingIntent.estimatedAmountCents,
      currency: existingIntent.currency,
      status: existingTx?.status ?? existingIntent.status,
      itemDescription: existingIntent.itemDescription,
      merchantName: existingIntent.merchantName,
      merchantCategory: existingIntent.merchantCategory ?? undefined,
      reasoningLog: (existingIntent.reasoningLog as unknown as ReasoningStep[]) || [],
      capturedAt: existingTx?.capturedAt?.toISOString(),
      approvalRequestId: existingApproval?.id,
      ruleTriggered: existingApproval?.ruleTriggered,
      error: existingIntent.rejectionReason ?? undefined,
    };
  }

  // 2. Validate or ensure target agent exists and belongs to the user
  let targetAgent = await db.query.agent.findFirst({
    where: eq(agent.id, agentId),
  });

  if (!targetAgent) {
    const [createdAgent] = await db
      .insert(agent)
      .values({
        userId,
        name: 'Autonomous Buyer Agent',
        status: 'active',
        model: 'gemini-2.5-flash',
      })
      .returning();
    targetAgent = createdAgent;
  } else if (targetAgent.userId !== userId) {
    throw new AgentPurchaseError(
      'You do not have permission to execute purchases with this agent.',
      403,
    );
  }

  if (!targetAgent) {
    throw new AgentPurchaseError('Target agent could not be resolved.', 500);
  }

  if (targetAgent.status === 'frozen') {
    throw new AgentPurchaseError(
      'Agent wallet is currently frozen. Emergency freeze must be lifted before new purchases can be executed.',
      423,
    );
  }

  const reasoningLog: ReasoningStep[] = [];

  // 3. Buyer agent: search the trusted merchant catalog and choose an offer.
  // Price, merchant and category come from the catalog, never from the model (spec 0009).
  const selection = await selectOfferForPrompt(prompt);

  for (const agentStep of selection.steps) {
    reasoningLog.push({
      step: reasoningLog.length + 1,
      ...agentStep,
      timestamp: new Date().toISOString(),
    });
  }

  function extractAttemptedAmountCents(text: string): number {
    const match = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
    if (!match || !match[1]) return 0;
    return currencyStringToCents(match[1].replace(/,/g, ''));
  }

  if (selection.kind === 'none') {
    const unmatchedDescription = prompt.slice(0, 100);
    const attemptedAmountCents = extractAttemptedAmountCents(prompt);

    const [rejectedIntent] = await db
      .insert(purchaseIntent)
      .values({
        agentId: targetAgent.id,
        userId,
        idempotencyKey,
        prompt,
        itemDescription: unmatchedDescription,
        merchantName: 'No catalog match',
        merchantCategory: null,
        estimatedAmountCents: attemptedAmountCents,
        currency: 'USD',
        status: 'rejected',
        rejectionReason: selection.reason,
        reasoningLog: sanitizeDetails(reasoningLog) as unknown as Array<Record<string, unknown>>,
      })
      .returning();

    return {
      purchaseIntentId: rejectedIntent?.id ?? '',
      transactionId: '',
      paypalOrderId: '',
      paypalCaptureId: '',
      amountCents: attemptedAmountCents,
      currency: 'USD',
      status: 'rejected',
      itemDescription: unmatchedDescription,
      merchantName: 'No catalog match',
      reasoningLog,
      error: selection.reason,
      ruleTriggered: selection.ruleTriggered,
    };
  }

  const quantity = selection.quantity || 1;
  const unitPriceCents = selection.offer.priceCents;
  const totalAmountCents = unitPriceCents * quantity;
  const itemDescription =
    quantity > 1 ? `${quantity}x ${selection.offer.title}` : selection.offer.title;

  const parsedItem = {
    itemDescription,
    merchantName: selection.offer.merchantName,
    merchantCategory: selection.offer.merchantCategory,
    amountCents: totalAmountCents,
  };

  // 4. Policy Guardrail Evaluation (AC-1, AC-2)
  const policy = await getOrCreateAgentPolicy(targetAgent.id);
  const spentLast24HoursCents = await getAgentSpentLast24Hours(targetAgent.id);
  const policyResult = evaluateSpendingPolicy({
    policy,
    spentLast24HoursCents,
    estimatedAmountCents: parsedItem.amountCents,
    merchantCategory: parsedItem.merchantCategory,
  });

  reasoningLog.push({
    step: reasoningLog.length + 1,
    toolName: 'evaluate_policy',
    thought: policyResult.reason,
    input: {
      estimatedAmountCents: parsedItem.amountCents,
      singleTransactionLimitCents: policy.singleTransactionLimitCents,
      maxDailySpendCents: policy.maxDailySpendCents,
      requireApprovalAboveCents: policy.requireApprovalAboveCents,
      spentLast24HoursCents,
      merchantCategory: parsedItem.merchantCategory,
    },
    output: {
      decision: policyResult.decision,
      ruleTriggered: policyResult.ruleTriggered,
      triggerDetails: policyResult.triggerDetails,
    },
    timestamp: new Date().toISOString(),
  });

  // Branch A: Hard Policy Violation Rejection (AC-3)
  if (policyResult.decision === 'rejected') {
    const [createdIntent] = await db
      .insert(purchaseIntent)
      .values({
        agentId: targetAgent.id,
        userId,
        idempotencyKey,
        prompt,
        itemDescription: parsedItem.itemDescription,
        merchantName: parsedItem.merchantName,
        merchantCategory: parsedItem.merchantCategory,
        estimatedAmountCents: parsedItem.amountCents,
        currency: 'USD',
        status: 'rejected',
        rejectionReason: policyResult.reason,
        reasoningLog: sanitizeDetails(reasoningLog) as unknown as Array<Record<string, unknown>>,
      })
      .returning();

    return {
      purchaseIntentId: createdIntent?.id || '',
      transactionId: '',
      paypalOrderId: '',
      paypalCaptureId: '',
      amountCents: parsedItem.amountCents,
      currency: 'USD',
      status: 'rejected',
      itemDescription: parsedItem.itemDescription,
      merchantName: parsedItem.merchantName,
      merchantCategory: parsedItem.merchantCategory,
      reasoningLog,
      error: policyResult.reason,
      ruleTriggered: policyResult.ruleTriggered,
    };
  }

  // Branch B: Approval Threshold Triggered (AC-4)
  if (policyResult.decision === 'requires_approval') {
    const [createdIntent] = await db
      .insert(purchaseIntent)
      .values({
        agentId: targetAgent.id,
        userId,
        idempotencyKey,
        prompt,
        itemDescription: parsedItem.itemDescription,
        merchantName: parsedItem.merchantName,
        merchantCategory: parsedItem.merchantCategory,
        estimatedAmountCents: parsedItem.amountCents,
        currency: 'USD',
        status: 'requires_approval',
        reasoningLog: sanitizeDetails(reasoningLog) as unknown as Array<Record<string, unknown>>,
      })
      .returning();

    if (!createdIntent) {
      throw new AgentPurchaseError('Failed to record purchase intent.', 500);
    }

    const [createdApproval] = await db
      .insert(approvalRequest)
      .values({
        purchaseIntentId: createdIntent.id,
        agentId: targetAgent.id,
        status: 'pending',
        ruleTriggered: policyResult.ruleTriggered || 'require_approval_above_cents',
        triggerDetails: sanitizeDetails(policyResult.triggerDetails || {}),
      })
      .returning();

    return {
      purchaseIntentId: createdIntent.id,
      transactionId: '',
      paypalOrderId: '',
      paypalCaptureId: '',
      amountCents: parsedItem.amountCents,
      currency: 'USD',
      status: 'requires_approval',
      itemDescription: parsedItem.itemDescription,
      merchantName: parsedItem.merchantName,
      merchantCategory: parsedItem.merchantCategory,
      reasoningLog,
      approvalRequestId: createdApproval?.id,
      ruleTriggered: policyResult.ruleTriggered,
    };
  }

  // Branch C: Auto-approved Autonomous Execution
  const [createdIntent] = await db
    .insert(purchaseIntent)
    .values({
      agentId: targetAgent.id,
      userId,
      idempotencyKey,
      prompt,
      itemDescription: parsedItem.itemDescription,
      merchantName: parsedItem.merchantName,
      merchantCategory: parsedItem.merchantCategory,
      estimatedAmountCents: parsedItem.amountCents,
      currency: 'USD',
      status: 'executing_payment',
      reasoningLog: sanitizeDetails(reasoningLog) as unknown as Array<Record<string, unknown>>,
    })
    .returning();

  if (!createdIntent) {
    throw new AgentPurchaseError('Failed to record purchase intent.', 500);
  }

  // Create Transaction Record
  const [createdTx] = await db
    .insert(transaction)
    .values({
      purchaseIntentId: createdIntent.id,
      agentId: targetAgent.id,
      userId,
      amountCents: parsedItem.amountCents,
      currency: 'USD',
      status: 'created',
      paymentMethod: 'paypal',
    })
    .returning();

  if (!createdTx) {
    throw new AgentPurchaseError('Failed to initialize transaction.', 500, createdIntent.id);
  }

  try {
    // 5. PayPal Create Order
    const createRes = await createPayPalOrder({
      purchaseIntentId: createdIntent.id,
      amountCents: parsedItem.amountCents,
      currency: 'USD',
      itemDescription: parsedItem.itemDescription,
      merchantName: parsedItem.merchantName,
      paypalRequestId: idempotencyKey,
    });

    reasoningLog.push({
      step: reasoningLog.length + 1,
      toolName: 'create_paypal_order',
      thought: `Created sandbox PayPal order with intent CAPTURE (Order ID: ${createRes.orderId}).`,
      input: {
        purchaseIntentId: createdIntent.id,
        amountCents: parsedItem.amountCents,
        currency: 'USD',
      },
      output: {
        orderId: createRes.orderId,
      },
      timestamp: new Date().toISOString(),
    });

    await db
      .update(transaction)
      .set({
        paypalOrderId: createRes.orderId,
        status: 'pending_capture',
        updatedAt: new Date(),
      })
      .where(eq(transaction.id, createdTx.id));

    // 6. Pre-capture freeze verification
    const activeCheckAgent = await db.query.agent.findFirst({
      where: eq(agent.id, targetAgent.id),
    });
    if (activeCheckAgent?.status === 'frozen') {
      await db
        .update(purchaseIntent)
        .set({
          status: 'failed',
          rejectionReason: 'Agent wallet frozen prior to payment capture.',
          reasoningLog: reasoningLog as unknown as Array<Record<string, unknown>>,
          updatedAt: new Date(),
        })
        .where(eq(purchaseIntent.id, createdIntent.id));
      await db
        .update(transaction)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(transaction.id, createdTx.id));

      throw new AgentPurchaseError(
        'Agent wallet was frozen prior to payment capture. Payment execution aborted.',
        423,
        createdIntent.id,
        createdTx.id,
      );
    }

    // 7. PayPal Capture Order
    const captureRes = await capturePayPalOrder(
      createRes.orderId,
      parsedItem.amountCents,
      `capture-${createdIntent.id}`,
    );

    reasoningLog.push({
      step: reasoningLog.length + 1,
      toolName: 'capture_paypal_order',
      thought: `Captured payment in sandbox via server credentials (Capture ID: ${captureRes.captureId}).`,
      input: {
        orderId: createRes.orderId,
      },
      output: {
        captureId: captureRes.captureId,
        status: captureRes.status,
        capturedAmountCents: captureRes.capturedAmountCents,
      },
      timestamp: new Date().toISOString(),
    });

    // 7. Update Transaction and Intent to Completed
    const finalAmountCents = captureRes.capturedAmountCents || parsedItem.amountCents;
    const capturedAt = new Date();

    await db
      .update(transaction)
      .set({
        paypalCaptureId: captureRes.captureId,
        amountCents: finalAmountCents,
        status: 'completed',
        rawPaypalResponse: sanitizeDetails(captureRes.rawResponse),
        capturedAt,
        updatedAt: capturedAt,
      })
      .where(eq(transaction.id, createdTx.id));

    await db
      .update(purchaseIntent)
      .set({
        status: 'completed',
        reasoningLog: sanitizeDetails(reasoningLog) as unknown as Array<Record<string, unknown>>,
        updatedAt: capturedAt,
      })
      .where(eq(purchaseIntent.id, createdIntent.id));

    return {
      purchaseIntentId: createdIntent.id,
      transactionId: createdTx.id,
      paypalOrderId: createRes.orderId,
      paypalCaptureId: captureRes.captureId,
      amountCents: finalAmountCents,
      currency: 'USD',
      status: 'completed',
      itemDescription: parsedItem.itemDescription,
      merchantName: parsedItem.merchantName,
      merchantCategory: parsedItem.merchantCategory,
      reasoningLog,
      capturedAt: capturedAt.toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Payment execution failed';
    const errorDetails = error instanceof PayPalServiceError ? error.details : undefined;
    const statusCode = error instanceof PayPalServiceError ? error.statusCode : 422;

    reasoningLog.push({
      step: reasoningLog.length + 1,
      toolName: 'error_handler',
      thought: `Payment failed: ${errorMessage}`,
      input: { orderId: createdTx.paypalOrderId ?? 'uncreated' },
      output: { error: errorMessage },
      timestamp: new Date().toISOString(),
    });

    try {
      await db
        .update(transaction)
        .set({
          status: 'failed',
          rawPaypalResponse: sanitizeDetails(errorDetails),
          updatedAt: new Date(),
        })
        .where(eq(transaction.id, createdTx.id));

      await db
        .update(purchaseIntent)
        .set({
          status: 'failed',
          rejectionReason: errorMessage,
          reasoningLog: sanitizeDetails(reasoningLog) as unknown as Array<Record<string, unknown>>,
          updatedAt: new Date(),
        })
        .where(eq(purchaseIntent.id, createdIntent.id));
    } catch {
      // Ignore secondary update errors to ensure primary error is reported
    }

    throw new AgentPurchaseError(
      errorMessage,
      statusCode,
      createdIntent.id,
      createdTx.id,
      sanitizeDetails(errorDetails),
    );
  }
}

/**
 * Executes one-click PayPal capture for an approved request (AC-5, AC-6).
 * Uses atomic conditional update on approval_request.status = 'pending' to prevent race conditions.
 */
export async function executeApprovedPurchaseCapture(params: {
  approvalRequestId: string;
  reviewerId: string;
  notes?: string;
  purchaseIntentId?: string;
}): Promise<PurchaseExecutionResult> {
  const { approvalRequestId, reviewerId, notes, purchaseIntentId } = params;

  // 1. Fetch approval request, purchase intent, and agent directly by IDs to avoid relational query issues
  let approval = await db.query.approvalRequest.findFirst({
    where: eq(approvalRequest.id, approvalRequestId),
  });

  if (!approval) {
    approval = await db.query.approvalRequest.findFirst({
      where: eq(approvalRequest.purchaseIntentId, approvalRequestId),
    });
  }

  if (!approval && purchaseIntentId) {
    approval = await db.query.approvalRequest.findFirst({
      where: eq(approvalRequest.purchaseIntentId, purchaseIntentId),
    });
  }

  if (!approval) {
    throw new AgentPurchaseError('Approval request not found', 404);
  }

  const intent = await db.query.purchaseIntent.findFirst({
    where: eq(purchaseIntent.id, approval.purchaseIntentId),
  });

  if (!intent) {
    throw new AgentPurchaseError('Linked purchase intent not found', 404);
  }

  const targetAgent = await db.query.agent.findFirst({
    where: eq(agent.id, approval.agentId),
  });

  if (!targetAgent) {
    throw new AgentPurchaseError('Target agent not found', 404);
  }

  // Verify ownership: reviewer must own either the agent or the purchase intent
  if (targetAgent.userId !== reviewerId && intent.userId !== reviewerId) {
    throw new AgentPurchaseError('You are not authorized to approve purchases for this agent', 403);
  }

  if (approval.status === 'rejected') {
    throw new AgentPurchaseError(
      'Cannot approve an approval request that was already rejected',
      409,
      intent.id,
    );
  }

  // 1b. Expiration verification (TTL: 24 hours)
  const isExpired =
    approval.status === 'expired' ||
    (approval.createdAt &&
      Date.now() - new Date(approval.createdAt).getTime() > APPROVAL_REQUEST_EXPIRY_MS);

  if (isExpired) {
    if (approval.status !== 'expired') {
      await db
        .update(approvalRequest)
        .set({
          status: 'expired',
          updatedAt: new Date(),
        })
        .where(eq(approvalRequest.id, approval.id));

      await db
        .update(purchaseIntent)
        .set({
          status: 'failed',
          rejectionReason:
            'Approval request expired (exceeded 24 hours). Please initiate a new purchase request.',
          updatedAt: new Date(),
        })
        .where(eq(purchaseIntent.id, intent.id));
    }

    throw new AgentPurchaseError(
      'This approval request has expired (older than 24 hours). Spending policies and item pricing require a fresh purchase request.',
      410,
      intent.id,
    );
  }

  // Idempotent return if already completed
  if (intent.status === 'completed') {
    const existingTx = await db.query.transaction.findFirst({
      where: eq(transaction.purchaseIntentId, intent.id),
    });
    return {
      purchaseIntentId: intent.id,
      transactionId: existingTx?.id || '',
      paypalOrderId: existingTx?.paypalOrderId || '',
      paypalCaptureId: existingTx?.paypalCaptureId || 'SANDBOX_CAPTURED',
      amountCents: existingTx?.amountCents || intent.estimatedAmountCents,
      currency: intent.currency,
      status: 'completed',
      itemDescription: intent.itemDescription,
      merchantName: intent.merchantName,
      merchantCategory: intent.merchantCategory ?? undefined,
      reasoningLog: (intent.reasoningLog as unknown as ReasoningStep[]) || [],
      capturedAt: (existingTx?.capturedAt || new Date()).toISOString(),
      approvalRequestId: approval.id,
    };
  }

  // 1c. Pre-approval freeze verification
  if (targetAgent.status === 'frozen') {
    throw new AgentPurchaseError(
      'Agent wallet is currently frozen. Emergency freeze must be lifted before approval payment capture can proceed.',
      423,
      intent.id,
    );
  }

  // 1d. Fresh Policy Guardrail Evaluation at Decision Time
  // Prevents time-drift and daily cap bypasses when approving requests from previous sessions or days.
  const policy = await getOrCreateAgentPolicy(targetAgent.id);
  const spentLast24HoursCents = await getAgentSpentLast24Hours(targetAgent.id);
  const projectedDailySpend = spentLast24HoursCents + intent.estimatedAmountCents;

  // Hard Check A: Single transaction hard ceiling
  if (intent.estimatedAmountCents > policy.singleTransactionLimitCents) {
    throw new AgentPurchaseError(
      `Approval blocked: Purchase amount ($${(intent.estimatedAmountCents / 100).toFixed(2)}) exceeds single transaction ceiling ($${(policy.singleTransactionLimitCents / 100).toFixed(2)}).`,
      422,
      intent.id,
    );
  }

  // Hard Check B: Rolling 24-hour daily spend cap
  if (projectedDailySpend > policy.maxDailySpendCents) {
    throw new AgentPurchaseError(
      `Approval blocked: Executing this purchase ($${(intent.estimatedAmountCents / 100).toFixed(2)}) would exceed the agent's 24-hour daily spend limit ($${(policy.maxDailySpendCents / 100).toFixed(2)}). Already spent in last 24h: $${(spentLast24HoursCents / 100).toFixed(2)}.`,
      422,
      intent.id,
    );
  }

  // Hard Check C: Blocked merchant categories
  const normalizedCategory = intent.merchantCategory?.trim().toLowerCase();
  const blockedCategories = (policy.blockedMerchantCategories || []).map((c) =>
    c.trim().toLowerCase(),
  );
  if (normalizedCategory && blockedCategories.includes(normalizedCategory)) {
    throw new AgentPurchaseError(
      `Approval blocked: Merchant category '${normalizedCategory}' is prohibited by current agent policy.`,
      422,
      intent.id,
    );
  }

  // 2. Atomic conditional update to 'approved' to guarantee single execution (AC-5)
  const [updatedApproval] = await db
    .update(approvalRequest)
    .set({
      status: 'approved',
      reviewerId,
      notes: notes || null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(approvalRequest.id, approval.id), eq(approvalRequest.status, 'pending')))
    .returning();

  if (!updatedApproval) {
    throw new AgentPurchaseError(
      'Conflict: Approval request was already decided by another action',
      409,
      intent.id,
    );
  }

  const currentLogs = (intent.reasoningLog as unknown as ReasoningStep[]) || [];

  currentLogs.push({
    step: currentLogs.length + 1,
    toolName: 'recheck_policy_at_approval',
    thought: `Re-evaluated spending policy at decision time: 24h spend is $${(spentLast24HoursCents / 100).toFixed(2)}, projected $${(projectedDailySpend / 100).toFixed(2)} <= daily cap $${(policy.maxDailySpendCents / 100).toFixed(2)}. Guardrails confirmed.`,
    input: {
      spentLast24HoursCents,
      projectedDailySpend,
      maxDailySpendCents: policy.maxDailySpendCents,
      singleTransactionLimitCents: policy.singleTransactionLimitCents,
    },
    output: { decision: 'approved' },
    timestamp: new Date().toISOString(),
  });

  // Update intent to executing_payment
  await db
    .update(purchaseIntent)
    .set({
      status: 'executing_payment',
      updatedAt: new Date(),
    })
    .where(eq(purchaseIntent.id, intent.id));

  // 3. Find or Create Transaction Record safely
  let targetTx = await db.query.transaction.findFirst({
    where: eq(transaction.purchaseIntentId, intent.id),
  });

  if (!targetTx) {
    const [createdTx] = await db
      .insert(transaction)
      .values({
        purchaseIntentId: intent.id,
        agentId: intent.agentId,
        userId: reviewerId,
        amountCents: intent.estimatedAmountCents,
        currency: intent.currency,
        status: 'created',
        paymentMethod: 'paypal',
      })
      .returning();
    targetTx = createdTx;
  }

  if (!targetTx) {
    throw new AgentPurchaseError('Failed to initialize approved transaction.', 500, intent.id);
  }

  try {
    // 4. Create PayPal Order if not already created
    let orderId = targetTx.paypalOrderId;
    if (!orderId) {
      const createRes = await createPayPalOrder({
        purchaseIntentId: intent.id,
        amountCents: intent.estimatedAmountCents,
        currency: intent.currency,
        itemDescription: intent.itemDescription,
        merchantName: intent.merchantName,
        paypalRequestId: `order-${intent.id}`,
      });
      orderId = createRes.orderId;

      await db
        .update(transaction)
        .set({
          paypalOrderId: orderId,
          status: 'pending_capture',
          updatedAt: new Date(),
        })
        .where(eq(transaction.id, targetTx.id));
    }

    // Pre-capture freeze verification for approvals
    const approvalCheckAgent = await db.query.agent.findFirst({
      where: eq(agent.id, intent.agentId),
    });
    if (approvalCheckAgent?.status === 'frozen') {
      throw new AgentPurchaseError(
        'Agent wallet is currently frozen. Approval payment capture cannot proceed.',
        423,
        intent.id,
      );
    }

    // 5. Capture PayPal Order
    const captureRes = await capturePayPalOrder(
      orderId,
      intent.estimatedAmountCents,
      `capture-${intent.id}`,
    );
    const capturedAt = new Date();
    const finalAmountCents = captureRes.capturedAmountCents || intent.estimatedAmountCents;

    await db
      .update(transaction)
      .set({
        paypalCaptureId: captureRes.captureId,
        amountCents: finalAmountCents,
        status: 'completed',
        rawPaypalResponse: sanitizeDetails(captureRes.rawResponse),
        capturedAt,
        updatedAt: capturedAt,
      })
      .where(eq(transaction.id, targetTx.id));

    currentLogs.push({
      step: currentLogs.length + 1,
      toolName: 'human_approval',
      thought: `Human operator approved transaction (${notes ? `Note: "${notes}"` : 'One-click operator approval'}). Captured PayPal order ${captureRes.captureId}.`,
      input: {
        approvalRequestId,
        reviewerId,
        notes: notes || null,
      },
      output: {
        paypalOrderId: orderId,
        paypalCaptureId: captureRes.captureId,
        status: 'completed',
      },
      timestamp: capturedAt.toISOString(),
    });

    await db
      .update(purchaseIntent)
      .set({
        status: 'completed',
        reasoningLog: sanitizeDetails(currentLogs) as unknown as Array<Record<string, unknown>>,
        updatedAt: capturedAt,
      })
      .where(eq(purchaseIntent.id, intent.id));

    // Also update any chat messages linked to this purchase intent so page reloads immediately show payment_completed
    try {
      const relatedMessages = await db.query.chatMessage.findMany({
        where: eq(chatMessage.purchaseIntentId, intent.id),
      });

      for (const msg of relatedMessages) {
        if (Array.isArray(msg.parts)) {
          let modified = false;
          const updatedParts = (msg.parts as Array<Record<string, unknown>>).map((part) => {
            if (part && part.type === 'action_card' && part.cardType === 'approval_required') {
              modified = true;
              return {
                ...part,
                cardType: 'payment_completed',
                status: 'completed',
                paypalCaptureId: captureRes.captureId,
                paypalOrderId: orderId,
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
      console.warn('Failed to update chat message parts after capture:', msgErr);
    }

    return {
      purchaseIntentId: intent.id,
      transactionId: targetTx.id,
      paypalOrderId: orderId,
      paypalCaptureId: captureRes.captureId,
      amountCents: finalAmountCents,
      currency: intent.currency,
      status: 'completed',
      itemDescription: intent.itemDescription,
      merchantName: intent.merchantName,
      merchantCategory: intent.merchantCategory ?? undefined,
      reasoningLog: currentLogs,
      capturedAt: capturedAt.toISOString(),
      approvalRequestId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'PayPal capture failed';
    const errorDetails = error instanceof PayPalServiceError ? error.details : undefined;

    currentLogs.push({
      step: currentLogs.length + 1,
      toolName: 'approval_capture_error',
      thought: `Approval granted but PayPal capture failed: ${errorMessage}`,
      input: { approvalRequestId },
      output: { error: errorMessage },
      timestamp: new Date().toISOString(),
    });

    // Revert approval request back to pending so the user can re-try after fixing network/sandbox issues
    await db
      .update(approvalRequest)
      .set({
        status: 'pending',
        notes: `Capture attempt failed: ${errorMessage}`,
        updatedAt: new Date(),
      })
      .where(eq(approvalRequest.id, approvalRequestId));

    await db
      .update(transaction)
      .set({
        status: 'failed',
        rawPaypalResponse: sanitizeDetails(errorDetails),
        updatedAt: new Date(),
      })
      .where(eq(transaction.id, targetTx.id));

    await db
      .update(purchaseIntent)
      .set({
        status: 'requires_approval',
        rejectionReason: `Capture failed: ${errorMessage}`,
        reasoningLog: sanitizeDetails(currentLogs) as unknown as Array<Record<string, unknown>>,
        updatedAt: new Date(),
      })
      .where(eq(purchaseIntent.id, intent.id));

    throw new AgentPurchaseError(
      `Capture failed after approval: ${errorMessage}`,
      422,
      intent.id,
      targetTx.id,
      sanitizeDetails(errorDetails),
    );
  }
}

/**
 * Rejects a pending approval request and marks purchase intent as rejected (AC-5).
 */
export async function rejectPendingApproval(params: {
  approvalRequestId: string;
  reviewerId: string;
  notes?: string;
}): Promise<{ approvalRequestId: string; status: 'rejected' }> {
  const { approvalRequestId, reviewerId, notes } = params;

  const approval = await db.query.approvalRequest.findFirst({
    where: eq(approvalRequest.id, approvalRequestId),
  });

  if (!approval) {
    throw new AgentPurchaseError('Approval request not found', 404);
  }

  const intent = await db.query.purchaseIntent.findFirst({
    where: eq(purchaseIntent.id, approval.purchaseIntentId),
  });

  if (!intent) {
    throw new AgentPurchaseError('Linked purchase intent not found', 404);
  }

  const targetAgent = await db.query.agent.findFirst({
    where: eq(agent.id, approval.agentId),
  });

  if (!targetAgent) {
    throw new AgentPurchaseError('Target agent not found', 404);
  }

  if (targetAgent.userId !== reviewerId && intent.userId !== reviewerId) {
    throw new AgentPurchaseError('You are not authorized to reject purchases for this agent', 403);
  }

  if (intent.status === 'completed') {
    throw new AgentPurchaseError(
      'Cannot reject a purchase that was already completed and captured',
      409,
      intent.id,
    );
  }

  if (approval.status === 'rejected') {
    return {
      approvalRequestId,
      status: 'rejected',
    };
  }

  if (approval.status === 'approved') {
    throw new AgentPurchaseError(
      'Cannot reject a purchase request that was already approved',
      409,
      intent.id,
    );
  }

  // Atomic conditional update
  const [updatedApproval] = await db
    .update(approvalRequest)
    .set({
      status: 'rejected',
      reviewerId,
      notes: notes || null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(approvalRequest.id, approvalRequestId), eq(approvalRequest.status, 'pending')))
    .returning();

  if (!updatedApproval) {
    throw new AgentPurchaseError(
      'Conflict: Approval request was already decided by another action',
      409,
      intent.id,
    );
  }

  const currentLogs = (intent.reasoningLog as unknown as ReasoningStep[]) || [];
  currentLogs.push({
    step: currentLogs.length + 1,
    toolName: 'human_rejection',
    thought: `Human operator rejected purchase request. Reason: ${notes || 'No notes specified.'}`,
    input: {
      approvalRequestId,
      reviewerId,
      notes: notes || null,
    },
    output: {
      status: 'rejected',
    },
    timestamp: new Date().toISOString(),
  });

  await db
    .update(purchaseIntent)
    .set({
      status: 'rejected',
      rejectionReason: notes || 'Rejected by authorized human reviewer.',
      reasoningLog: sanitizeDetails(currentLogs) as unknown as Array<Record<string, unknown>>,
      updatedAt: new Date(),
    })
    .where(eq(purchaseIntent.id, intent.id));

  // Also update any chat messages linked to this purchase intent so page reloads immediately show rejected status
  try {
    const relatedMessages = await db.query.chatMessage.findMany({
      where: eq(chatMessage.purchaseIntentId, intent.id),
    });

    for (const msg of relatedMessages) {
      if (Array.isArray(msg.parts)) {
        let modified = false;
        const updatedParts = (msg.parts as Array<Record<string, unknown>>).map((part) => {
          if (part && part.type === 'action_card' && part.cardType === 'approval_required') {
            modified = true;
            return {
              ...part,
              status: 'rejected',
              rejectionReason: notes || 'Rejected by authorized human reviewer.',
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
  } catch {
    // Non-fatal secondary sync
  }

  return {
    approvalRequestId,
    status: 'rejected',
  };
}
