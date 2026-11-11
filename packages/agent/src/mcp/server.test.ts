// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgentPayMcpServer } from './server';

vi.mock('@workspace/db', () => ({
  db: {
    query: {
      agent: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-1',
          userId: 'user-1',
          status: 'active',
        }),
      },
      agentPolicy: {
        findFirst: vi.fn(),
      },
      purchaseIntent: {
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
  },
  agent: { id: 'id', userId: 'user_id', status: 'status' },
  eq: vi.fn(),
}));

vi.mock('../policy', () => ({
  getOrCreateAgentPolicy: vi.fn().mockResolvedValue({
    id: 'policy-1',
    agentId: 'agent-1',
    singleTransactionLimitCents: 5000,
    maxDailySpendCents: 10000,
    requireApprovalAboveCents: 5000,
    allowedMerchantCategories: ['developer_tools', 'software_licenses'],
    blockedMerchantCategories: ['gambling', 'crypto_exchange'],
    requireApprovalForNonRefundable: false,
  }),
  getAgentSpentLast24Hours: vi.fn().mockResolvedValue(2500),
}));

vi.mock('../freeze', () => ({
  toggleAgentFreeze: vi.fn().mockResolvedValue({
    success: true,
    agentId: 'agent-1',
    status: 'frozen',
    updatedAt: new Date().toISOString(),
  }),
}));

vi.mock('../telemetry', () => ({
  getAgentTelemetry: vi.fn().mockResolvedValue({
    items: [
      {
        id: 'telemetry-1',
        createdAt: '2026-11-11T12:00:00.000Z',
        prompt: 'Buy Anthropic credits',
        itemDescription: 'Anthropic developer tier API credits',
        merchantName: 'Anthropic',
        merchantCategory: 'developer_tools',
        amountCents: 2500,
        currency: 'USD',
        status: 'completed',
        paypalOrderId: 'ORDER-123',
        paypalCaptureId: 'CAPTURE-123',
        transactionStatus: 'completed',
        approvalRequestId: null,
        approvalStatus: null,
        ruleTriggered: null,
        triggerDetails: null,
        reasoningLog: [],
        reasoningStepCount: 2,
        rawPaypalResponse: null,
        rejectionReason: null,
      },
    ],
    nextCursor: null,
    agentStatus: 'active',
    agentName: 'Autonomous Buyer Agent',
  }),
}));

type McpToolHandler = {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
};

describe('AgentPay MCP Server (Model Context Protocol)', () => {
  let server: ReturnType<typeof createAgentPayMcpServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createAgentPayMcpServer();
  });

  it('creates an McpServer instance with registered tools and resources', () => {
    expect(server).toBeDefined();
    expect(server.server).toBeDefined();
  });

  it('executes agentpay_search_catalog and returns matching offers', async () => {
    const registeredTools = (
      server as unknown as { _registeredTools: Record<string, McpToolHandler> }
    )._registeredTools;

    const searchTool = registeredTools['agentpay_search_catalog'];
    expect(searchTool).toBeDefined();
    if (!searchTool) return;

    const response = await searchTool.handler({ query: 'anthropic', limit: 5 });

    expect(response.isError).toBeFalsy();
    expect(response.content).toHaveLength(1);
    const parsed = JSON.parse(response.content[0]?.text || '{}');
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.offers[0].merchant).toBe('Anthropic');
    expect(parsed.offers[0].priceCents).toBe(2500);
  });

  it('executes agentpay_get_offer_details for existing and non-existing offers', async () => {
    const registeredTools = (
      server as unknown as { _registeredTools: Record<string, McpToolHandler> }
    )._registeredTools;
    const getOfferTool = registeredTools['agentpay_get_offer_details'];
    expect(getOfferTool).toBeDefined();
    if (!getOfferTool) return;

    // Existing offer
    const validResponse = await getOfferTool.handler({ offerId: 'api-anthropic-credits-25' });
    expect(validResponse.isError).toBeFalsy();
    const parsed = JSON.parse(validResponse.content[0]?.text || '{}');
    expect(parsed.offerId).toBe('api-anthropic-credits-25');
    expect(parsed.priceUsd).toBe('25.00');

    // Non-existent offer
    const invalidResponse = await getOfferTool.handler({ offerId: 'non-existent-offer-999' });
    expect(invalidResponse.isError).toBe(true);
    expect(invalidResponse.content[0]?.text).toContain('not found');
  });

  it('executes agentpay_check_spending_policy and calculates budget headroom', async () => {
    const registeredTools = (
      server as unknown as { _registeredTools: Record<string, McpToolHandler> }
    )._registeredTools;
    const policyTool = registeredTools['agentpay_check_spending_policy'];
    expect(policyTool).toBeDefined();
    if (!policyTool) return;

    const response = await policyTool.handler({ agentId: 'agent-1' });
    expect(response.isError).toBeFalsy();

    const parsed = JSON.parse(response.content[0]?.text || '{}');
    expect(parsed.agentId).toBe('agent-1');
    expect(parsed.limits.maxDailySpendCents).toBe(10000);
    expect(parsed.velocity.spentLast24HoursCents).toBe(2500);
    expect(parsed.velocity.remainingDailyBudgetCents).toBe(7500);
    expect(parsed.velocity.remainingDailyBudgetUsd).toBe('75.00');
  });

  it('executes agentpay_freeze_agent to toggle emergency freeze state', async () => {
    const registeredTools = (
      server as unknown as { _registeredTools: Record<string, McpToolHandler> }
    )._registeredTools;
    const freezeTool = registeredTools['agentpay_freeze_agent'];
    expect(freezeTool).toBeDefined();
    if (!freezeTool) return;

    const response = await freezeTool.handler({
      agentId: 'agent-1',
      action: 'freeze',
      reason: 'Suspicious repetitive prompt volume',
    });

    expect(response.isError).toBeFalsy();
    const parsed = JSON.parse(response.content[0]?.text || '{}');
    expect(parsed.success).toBe(true);
    expect(parsed.status).toBe('frozen');
    expect(parsed.reason).toBe('Suspicious repetitive prompt volume');
  });

  it('executes agentpay_get_telemetry to retrieve agent audit events', async () => {
    const registeredTools = (
      server as unknown as { _registeredTools: Record<string, McpToolHandler> }
    )._registeredTools;
    const telemetryTool = registeredTools['agentpay_get_telemetry'];
    expect(telemetryTool).toBeDefined();
    if (!telemetryTool) return;

    const response = await telemetryTool.handler({
      agentId: 'agent-1',
      limit: 10,
    });

    expect(response.isError).toBeFalsy();
    const parsed = JSON.parse(response.content[0]?.text || '{}');
    expect(parsed.agentId).toBe('agent-1');
    expect(parsed.totalItems).toBe(1);
    expect(parsed.items[0].paypalOrderId).toBe('ORDER-123');
    expect(parsed.items[0].amountUsd).toBe('25.00');
  });
});
