import {
  agent,
  agentAuditLog,
  db,
  eq,
  type AgentAuditAction,
  type AgentStatus,
} from '@workspace/db';

export interface ToggleFreezeParams {
  agentId: string;
  userId: string;
  action: AgentAuditAction;
  reason?: string;
}

export interface ToggleFreezeResult {
  success: boolean;
  agentId: string;
  status: AgentStatus;
  updatedAt: string;
}

export class FreezeServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'FreezeServiceError';
    this.statusCode = statusCode;
  }
}

export async function toggleAgentFreeze(params: ToggleFreezeParams): Promise<ToggleFreezeResult> {
  const { agentId, userId, action, reason } = params;

  // 1. Verify agent existence and user ownership
  const targetAgent = await db.query.agent.findFirst({
    where: eq(agent.id, agentId),
  });

  if (!targetAgent) {
    throw new FreezeServiceError('Agent not found', 404);
  }

  if (targetAgent.userId !== userId) {
    throw new FreezeServiceError('You do not have permission to modify this agent', 403);
  }

  const previousStatus = targetAgent.status;
  const newStatus: AgentStatus = action === 'freeze' ? 'frozen' : 'active';
  const now = new Date();

  // 2. Execute status update and audit log insertion in atomic transaction
  await db.transaction(async (tx) => {
    await tx
      .update(agent)
      .set({
        status: newStatus,
        updatedAt: now,
      })
      .where(eq(agent.id, agentId));

    await tx.insert(agentAuditLog).values({
      agentId,
      actorUserId: userId,
      action,
      previousStatus,
      newStatus,
      reason: reason?.trim() || null,
      createdAt: now,
    });
  });

  return {
    success: true,
    agentId,
    status: newStatus,
    updatedAt: now.toISOString(),
  };
}
