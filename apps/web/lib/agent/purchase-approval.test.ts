// @vitest-environment node
import {
  AgentPurchaseError,
  APPROVAL_REQUEST_EXPIRY_MS,
  executeApprovedPurchaseCapture,
  rejectPendingApproval,
} from '@/lib/agent/purchase';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApproval = {
  id: 'approval-1',
  purchaseIntentId: 'intent-1',
  agentId: 'agent-1',
  status: 'pending',
  ruleTriggered: 'require_approval_above_cents',
  triggerDetails: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockIntent = {
  id: 'intent-1',
  agentId: 'agent-1',
  userId: 'user-1',
  status: 'requires_approval',
  itemDescription: 'H100 GPU Compute (4 Hours)',
  merchantName: 'Lambda Labs',
  merchantCategory: 'cloud_infrastructure',
  estimatedAmountCents: 20000, // $200.00
  currency: 'USD',
  reasoningLog: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAgent = {
  id: 'agent-1',
  userId: 'user-1',
  name: 'Buyer Agent',
  status: 'active',
};

const mockPolicy = {
  id: 'policy-1',
  agentId: 'agent-1',
  maxDailySpendCents: 50000, // $500.00
  singleTransactionLimitCents: 50000, // $500.00
  requireApprovalAboveCents: 5000, // $50.00
  allowedMerchantCategories: [],
  blockedMerchantCategories: ['gambling', 'crypto_exchange'],
  currency: 'USD',
};

vi.mock('@/lib/agent/policy', () => ({
  getOrCreateAgentPolicy: vi.fn(),
  getAgentSpentLast24Hours: vi.fn(),
  evaluateSpendingPolicy: vi.fn(),
}));

vi.mock('@/lib/agent/buyer-agent', () => ({
  selectOfferForPrompt: vi.fn(),
}));

vi.mock('@/lib/paypal/service', () => ({
  createPayPalOrder: vi.fn().mockResolvedValue({ orderId: 'ORDER-123' }),
  capturePayPalOrder: vi.fn().mockResolvedValue({
    captureId: 'CAPTURE-123',
    capturedAmountCents: 20000,
    rawResponse: {},
  }),
  sanitizeDetails: (d: unknown) => d,
  PayPalServiceError: class extends Error {},
  currencyStringToCents: (s: string) => Math.round(parseFloat(s) * 100),
}));

vi.mock('@workspace/db', () => {
  return {
    db: {
      query: {
        approvalRequest: {
          findFirst: vi.fn(),
        },
        purchaseIntent: {
          findFirst: vi.fn(),
        },
        agent: {
          findFirst: vi.fn(),
        },
        transaction: {
          findFirst: vi.fn(),
        },
        chatMessage: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 'approval-1', status: 'approved' }]),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'tx-1', status: 'created' }]),
        })),
      })),
    },
    approvalRequest: { id: 'id', status: 'status', purchaseIntentId: 'purchaseIntentId' },
    purchaseIntent: { id: 'id' },
    agent: { id: 'id' },
    transaction: { id: 'id', purchaseIntentId: 'purchaseIntentId' },
    chatMessage: { id: 'id', purchaseIntentId: 'purchaseIntentId' },
    eq: vi.fn(),
    and: vi.fn(),
    or: vi.fn(),
    lt: vi.fn(),
    gte: vi.fn(),
  };
});

describe('Decision-Time Policy Re-evaluation & Expiry (executeApprovedPurchaseCapture)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { db } = await import('@workspace/db');
    vi.mocked(db.query.approvalRequest.findFirst).mockResolvedValue({ ...mockApproval } as never);
    vi.mocked(db.query.purchaseIntent.findFirst).mockResolvedValue({ ...mockIntent } as never);
    vi.mocked(db.query.agent.findFirst).mockResolvedValue({ ...mockAgent } as never);
    vi.mocked(db.query.transaction.findFirst).mockResolvedValue(null as never);

    const { getOrCreateAgentPolicy, getAgentSpentLast24Hours } = await import('@/lib/agent/policy');
    vi.mocked(getOrCreateAgentPolicy).mockResolvedValue({ ...mockPolicy } as never);
    vi.mocked(getAgentSpentLast24Hours).mockResolvedValue(10000); // $100 spent today
  });

  it('rejects with HTTP 410 when approval request has expired (> 24 hours)', async () => {
    const { db } = await import('@workspace/db');
    const staleDate = new Date(Date.now() - (APPROVAL_REQUEST_EXPIRY_MS + 60000)); // 24h + 1m ago
    vi.mocked(db.query.approvalRequest.findFirst).mockResolvedValue({
      ...mockApproval,
      createdAt: staleDate,
    } as never);

    await expect(
      executeApprovedPurchaseCapture({
        approvalRequestId: 'approval-1',
        reviewerId: 'user-1',
      }),
    ).rejects.toThrowError(AgentPurchaseError);

    try {
      await executeApprovedPurchaseCapture({
        approvalRequestId: 'approval-1',
        reviewerId: 'user-1',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(AgentPurchaseError);
      expect((err as AgentPurchaseError).statusCode).toBe(410);
      expect((err as AgentPurchaseError).message).toContain('expired');
    }
  });

  it('blocks approval with HTTP 422 when 24-hour spend plus intent exceeds maxDailySpendCents', async () => {
    const { getAgentSpentLast24Hours } = await import('@/lib/agent/policy');
    // Already spent $450 in the last 24h; intent is $200 -> total $650 > $500 cap
    vi.mocked(getAgentSpentLast24Hours).mockResolvedValue(45000);

    try {
      await executeApprovedPurchaseCapture({
        approvalRequestId: 'approval-1',
        reviewerId: 'user-1',
      });
      expect.fail('Should have thrown AgentPurchaseError');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentPurchaseError);
      expect((err as AgentPurchaseError).statusCode).toBe(422);
      expect((err as AgentPurchaseError).message).toContain(
        "would exceed the agent's 24-hour daily spend limit",
      );
      expect((err as AgentPurchaseError).message).toContain('$450.00');
    }
  });

  it('blocks approval with HTTP 422 when intent amount exceeds singleTransactionLimitCents', async () => {
    const { db } = await import('@workspace/db');
    vi.mocked(db.query.purchaseIntent.findFirst).mockResolvedValue({
      ...mockIntent,
      estimatedAmountCents: 60000, // $600 > $500 single ceiling
    } as never);

    try {
      await executeApprovedPurchaseCapture({
        approvalRequestId: 'approval-1',
        reviewerId: 'user-1',
      });
      expect.fail('Should have thrown AgentPurchaseError');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentPurchaseError);
      expect((err as AgentPurchaseError).statusCode).toBe(422);
      expect((err as AgentPurchaseError).message).toContain('exceeds single transaction ceiling');
    }
  });

  it('blocks approval with HTTP 422 when merchant category has been blocked in policy', async () => {
    const { db } = await import('@workspace/db');
    vi.mocked(db.query.purchaseIntent.findFirst).mockResolvedValue({
      ...mockIntent,
      merchantCategory: 'crypto_exchange',
    } as never);

    try {
      await executeApprovedPurchaseCapture({
        approvalRequestId: 'approval-1',
        reviewerId: 'user-1',
      });
      expect.fail('Should have thrown AgentPurchaseError');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentPurchaseError);
      expect((err as AgentPurchaseError).statusCode).toBe(422);
      expect((err as AgentPurchaseError).message).toContain('prohibited by current agent policy');
    }
  });

  it('successfully captures payment and logs decision-time policy re-check when within budget', async () => {
    const { capturePayPalOrder } = await import('@/lib/paypal/service');

    const result = await executeApprovedPurchaseCapture({
      approvalRequestId: 'approval-1',
      reviewerId: 'user-1',
      notes: 'Approved for GPU cluster',
    });

    expect(result.status).toBe('completed');
    expect(result.paypalCaptureId).toBe('CAPTURE-123');
    expect(capturePayPalOrder).toHaveBeenCalledWith('ORDER-123', 20000, 'capture-intent-1');

    const recheckStep = result.reasoningLog.find(
      (step) => step.toolName === 'recheck_policy_at_approval',
    );
    expect(recheckStep).toBeDefined();
    expect(recheckStep?.thought).toContain('Re-evaluated spending policy at decision time');
  });

  it('throws HTTP 409 Conflict when concurrent decision already updated status', async () => {
    const { db } = await import('@workspace/db');
    // Simulate race condition where another process decided approval first: update returns empty array
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    } as never);

    try {
      await executeApprovedPurchaseCapture({
        approvalRequestId: 'approval-1',
        reviewerId: 'user-1',
      });
      expect.fail('Should have thrown 409 Conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentPurchaseError);
      expect((err as AgentPurchaseError).statusCode).toBe(409);
      expect((err as AgentPurchaseError).message).toContain('already decided');
    }
  });

  it('throws HTTP 409 Conflict when attempting to reject an already approved request', async () => {
    const { db } = await import('@workspace/db');
    vi.mocked(db.query.approvalRequest.findFirst).mockResolvedValue({
      ...mockApproval,
      status: 'approved',
    } as never);

    try {
      await rejectPendingApproval({
        approvalRequestId: 'approval-1',
        reviewerId: 'user-1',
      });
      expect.fail('Should have thrown 409 Conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentPurchaseError);
      expect((err as AgentPurchaseError).statusCode).toBe(409);
      expect((err as AgentPurchaseError).message).toContain('already approved');
    }
  });
});
