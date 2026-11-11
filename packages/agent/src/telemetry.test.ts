import { db } from '@workspace/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAgentTelemetry } from './telemetry';

vi.mock('@workspace/db', () => ({
  db: {
    query: {
      agent: {
        findFirst: vi.fn(),
      },
      purchaseIntent: {
        findMany: vi.fn(),
      },
    },
  },
  eq: vi.fn(),
  and: vi.fn(),
  lt: vi.fn(),
  desc: vi.fn(),
  agent: { id: 'agent_id' },
  purchaseIntent: {
    agentId: 'agent_id',
    createdAt: 'created_at',
    status: 'status',
  },
}));

describe('Telemetry Service (AC-1, AC-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 404 when target agent is not found', async () => {
    vi.mocked(db.query.agent.findFirst).mockResolvedValue(undefined);

    await expect(
      getAgentTelemetry({
        agentId: 'non-existent',
        userId: 'user-1',
      }),
    ).rejects.toThrow('Agent not found');
  });

  it('throws 403 when session user does not own the agent (AC-2)', async () => {
    vi.mocked(db.query.agent.findFirst).mockResolvedValue({
      id: 'agent-1',
      userId: 'different-user',
      name: 'Test Agent',
      status: 'active',
    } as never);

    await expect(
      getAgentTelemetry({
        agentId: 'agent-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('You do not have access to this agent telemetry');
  });

  it('returns paginated telemetry items with joined data and nextCursor (AC-1)', async () => {
    vi.mocked(db.query.agent.findFirst).mockResolvedValue({
      id: 'agent-1',
      userId: 'user-1',
      name: 'Autonomous Buyer',
      status: 'active',
    } as never);

    const date1 = new Date('2026-11-06T00:00:00Z');
    const date2 = new Date('2026-11-05T23:00:00Z');

    vi.mocked(db.query.purchaseIntent.findMany).mockResolvedValue([
      {
        id: 'intent-1',
        agentId: 'agent-1',
        userId: 'user-1',
        prompt: 'Buy compute credits',
        itemDescription: 'Compute Voucher',
        merchantName: 'Cloud Server Hub',
        merchantCategory: 'cloud_infrastructure',
        estimatedAmountCents: 1000,
        currency: 'USD',
        status: 'completed',
        reasoningLog: [{ step: 1, thought: 'Ready' }],
        rejectionReason: null,
        createdAt: date1,
        transaction: {
          id: 'tx-1',
          paypalOrderId: 'ORD-123',
          paypalCaptureId: 'CAP-456',
          amountCents: 1000,
          status: 'completed',
          rawPaypalResponse: { status: 'COMPLETED' },
        },
        approvalRequest: null,
      },
      {
        id: 'intent-2',
        agentId: 'agent-1',
        userId: 'user-1',
        prompt: 'Buy enterprise software',
        itemDescription: 'Enterprise License',
        merchantName: 'Software Store',
        merchantCategory: 'software',
        estimatedAmountCents: 3500,
        currency: 'USD',
        status: 'requires_approval',
        reasoningLog: [],
        rejectionReason: null,
        createdAt: date2,
        transaction: null,
        approvalRequest: {
          id: 'appr-1',
          status: 'pending',
          ruleTriggered: 'require_approval_above_cents',
          triggerDetails: { limit: 2500 },
        },
      },
    ] as never);

    const result = await getAgentTelemetry({
      agentId: 'agent-1',
      userId: 'user-1',
      limit: 10,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.merchantName).toBe('Cloud Server Hub');
    expect(result.items[0]?.paypalCaptureId).toBe('CAP-456');
    expect(result.items[0]?.reasoningStepCount).toBe(1);
    expect(result.items[1]?.status).toBe('requires_approval');
    expect(result.items[1]?.ruleTriggered).toBe('require_approval_above_cents');
    expect(result.agentStatus).toBe('active');
    expect(result.nextCursor).toBeNull();
  });
});
