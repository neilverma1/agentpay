// @vitest-environment node
import { GET, PATCH } from '@/app/api/v1/agent/policy/route';
import {
  getAgentSpentLast24Hours,
  getOrCreateAgentPolicy,
  updateAgentPolicy,
} from '@/lib/agent/policy';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@workspace/db';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/agent/policy', () => ({
  getOrCreateAgentPolicy: vi.fn(),
  getAgentSpentLast24Hours: vi.fn(),
  updateAgentPolicy: vi.fn(),
}));

vi.mock('@workspace/db', () => ({
  db: {
    query: {
      agent: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
  },
  agent: {
    userId: 'user_id',
  },
  eq: vi.fn(),
}));

describe('Agent Policy API (/api/v1/agent/policy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: undefined,
    });

    const req = new NextRequest('http://localhost:3000/api/v1/agent/policy');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns policy and 24-hour rolling headroom when authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-1', email: 'user@test.com' } } as never,
    });

    vi.mocked(db.query.agent.findFirst).mockResolvedValue({
      id: 'agent-1',
      userId: 'usr-1',
      name: 'Primary Commerce Agent',
    } as never);

    vi.mocked(getOrCreateAgentPolicy).mockResolvedValue({
      id: 'policy-1',
      agentId: 'agent-1',
      maxDailySpendCents: 50000,
      singleTransactionLimitCents: 50000,
      requireApprovalAboveCents: 5000,
      blockedMerchantCategories: ['gambling'],
      allowedMerchantCategories: [],
      currency: 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    vi.mocked(getAgentSpentLast24Hours).mockResolvedValue(1000); // $10 spent

    const req = new NextRequest('http://localhost:3000/api/v1/agent/policy');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.policy.maxDailySpendCents).toBe(50000);
    expect(body.policy.spentLast24HoursCents).toBe(1000);
    expect(body.policy.remainingDailySpendCents).toBe(49000);
  });

  it('updates policy with valid spending limits', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-1', email: 'user@test.com' } } as never,
    });

    vi.mocked(db.query.agent.findFirst).mockResolvedValue({
      id: 'agent-1',
      userId: 'usr-1',
    } as never);

    vi.mocked(updateAgentPolicy).mockResolvedValue({
      id: 'policy-1',
      agentId: 'agent-1',
      maxDailySpendCents: 25000,
      singleTransactionLimitCents: 25000,
      requireApprovalAboveCents: 2000,
      blockedMerchantCategories: [],
      allowedMerchantCategories: [],
      currency: 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    vi.mocked(getAgentSpentLast24Hours).mockResolvedValue(0);

    const req = new NextRequest('http://localhost:3000/api/v1/agent/policy', {
      method: 'PATCH',
      body: JSON.stringify({
        maxDailySpendCents: 25000,
        requireApprovalAboveCents: 2000,
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.policy.maxDailySpendCents).toBe(25000);
    expect(body.policy.requireApprovalAboveCents).toBe(2000);
  });

  it('rejects approval threshold exceeding max daily spend', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-1', email: 'user@test.com' } } as never,
    });

    vi.mocked(db.query.agent.findFirst).mockResolvedValue({
      id: 'agent-1',
      userId: 'usr-1',
    } as never);

    const req = new NextRequest('http://localhost:3000/api/v1/agent/policy', {
      method: 'PATCH',
      body: JSON.stringify({
        maxDailySpendCents: 5000,
        requireApprovalAboveCents: 10000, // exceeds max daily
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Approval threshold cannot exceed');
  });

  it('rejects limits exceeding $10,000.00 ceiling', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-1', email: 'user@test.com' } } as never,
    });

    vi.mocked(db.query.agent.findFirst).mockResolvedValue({
      id: 'agent-1',
      userId: 'usr-1',
    } as never);

    const req = new NextRequest('http://localhost:3000/api/v1/agent/policy', {
      method: 'PATCH',
      body: JSON.stringify({
        maxDailySpendCents: 1500000, // $15,000 exceeds $10,000 ceiling
        requireApprovalAboveCents: 5000,
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('updates strict compliance mode flag (requireApprovalForNonRefundable)', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-1', email: 'user@test.com' } } as never,
    });

    vi.mocked(db.query.agent.findFirst).mockResolvedValue({
      id: 'agent-1',
      userId: 'usr-1',
    } as never);

    vi.mocked(updateAgentPolicy).mockResolvedValue({
      id: 'policy-1',
      agentId: 'agent-1',
      maxDailySpendCents: 50000,
      singleTransactionLimitCents: 50000,
      requireApprovalAboveCents: 5000,
      requireApprovalForNonRefundable: true,
      blockedMerchantCategories: [],
      allowedMerchantCategories: [],
      currency: 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    vi.mocked(getAgentSpentLast24Hours).mockResolvedValue(0);

    const req = new NextRequest('http://localhost:3000/api/v1/agent/policy', {
      method: 'PATCH',
      body: JSON.stringify({
        requireApprovalForNonRefundable: true,
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.policy.requireApprovalForNonRefundable).toBe(true);
  });
});
