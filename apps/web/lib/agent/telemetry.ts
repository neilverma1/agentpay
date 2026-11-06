import {
  agent,
  and,
  db,
  desc,
  eq,
  lt,
  purchaseIntent,
  type PurchaseIntentStatus,
} from '@workspace/db';

export interface TelemetryItem {
  id: string;
  createdAt: string;
  prompt: string;
  itemDescription: string;
  merchantName: string;
  merchantCategory: string | null;
  amountCents: number;
  currency: string;
  status: PurchaseIntentStatus;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  transactionStatus: string | null;
  approvalRequestId: string | null;
  approvalStatus: string | null;
  ruleTriggered: string | null;
  triggerDetails: Record<string, unknown> | null;
  reasoningLog: Array<Record<string, unknown>>;
  reasoningStepCount: number;
  rawPaypalResponse: Record<string, unknown> | null;
  rejectionReason: string | null;
}

export interface TelemetryFeedResponse {
  items: TelemetryItem[];
  nextCursor: string | null;
  agentStatus: string;
  agentName: string;
}

export interface GetTelemetryOptions {
  agentId: string;
  userId: string;
  cursor?: string | null;
  limit?: number;
  status?: string | null;
}

export class TelemetryServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'TelemetryServiceError';
    this.statusCode = statusCode;
  }
}

export async function getAgentTelemetry(
  options: GetTelemetryOptions,
): Promise<TelemetryFeedResponse> {
  const { agentId, userId, cursor, status } = options;
  const limit = Math.min(Math.max(options.limit || 50, 1), 100);

  // 1. Verify agent existence and user ownership
  const targetAgent = await db.query.agent.findFirst({
    where: eq(agent.id, agentId),
  });

  if (!targetAgent) {
    throw new TelemetryServiceError('Agent not found', 404);
  }

  if (targetAgent.userId !== userId) {
    throw new TelemetryServiceError('You do not have access to this agent telemetry', 403);
  }

  // 2. Query paginated purchase intents with joined transactions and approval requests
  let cursorDate: Date | undefined;
  if (cursor) {
    const parsed = new Date(cursor);
    if (!isNaN(parsed.getTime())) {
      cursorDate = parsed;
    }
  }

  const whereConditions = [
    eq(purchaseIntent.agentId, agentId),
    cursorDate ? lt(purchaseIntent.createdAt, cursorDate) : undefined,
    status ? eq(purchaseIntent.status, status as PurchaseIntentStatus) : undefined,
  ].filter(Boolean);

  const rows = await db.query.purchaseIntent.findMany({
    where: and(...whereConditions),
    orderBy: [desc(purchaseIntent.createdAt)],
    limit: limit + 1,
    with: {
      transaction: true,
      approvalRequest: true,
    },
  });

  const hasMore = rows.length > limit;
  const slicedRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && slicedRows.length > 0
      ? slicedRows[slicedRows.length - 1]!.createdAt.toISOString()
      : null;

  const items: TelemetryItem[] = slicedRows.map((row) => {
    const rawReasoningLog = Array.isArray(row.reasoningLog) ? row.reasoningLog : [];
    const amountCents = row.transaction?.amountCents ?? row.estimatedAmountCents;

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      prompt: row.prompt,
      itemDescription: row.itemDescription,
      merchantName: row.merchantName,
      merchantCategory: row.merchantCategory,
      amountCents,
      currency: row.currency,
      status: row.status,
      paypalOrderId: row.transaction?.paypalOrderId ?? null,
      paypalCaptureId: row.transaction?.paypalCaptureId ?? null,
      transactionStatus: row.transaction?.status ?? null,
      approvalRequestId: row.approvalRequest?.id ?? null,
      approvalStatus: row.approvalRequest?.status ?? null,
      ruleTriggered: row.approvalRequest?.ruleTriggered ?? null,
      triggerDetails: (row.approvalRequest?.triggerDetails as Record<string, unknown>) ?? null,
      reasoningLog: rawReasoningLog as Array<Record<string, unknown>>,
      reasoningStepCount: rawReasoningLog.length,
      rawPaypalResponse: (row.transaction?.rawPaypalResponse as Record<string, unknown>) ?? null,
      rejectionReason: row.rejectionReason,
    };
  });

  return {
    items,
    nextCursor,
    agentStatus: targetAgent.status,
    agentName: targetAgent.name,
  };
}
