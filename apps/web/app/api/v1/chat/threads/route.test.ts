// @vitest-environment node
import { GET, POST } from '@/app/api/v1/chat/threads/route';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@workspace/db';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@workspace/db', () => ({
  db: {
    query: {
      chatThread: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      agent: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  },
  chatThread: {
    userId: 'user_id',
    updatedAt: 'updated_at',
    id: 'id',
  },
  chatMessage: {
    threadId: 'thread_id',
  },
  agent: {
    userId: 'user_id',
  },
  desc: vi.fn(),
  eq: vi.fn(),
  and: vi.fn(),
  asc: vi.fn(),
}));

describe('Chat Threads API (/api/v1/chat/threads) (AC-1, AC-2, AC-8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP 401 when request is unauthenticated (AC-8)', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: undefined as any,
    });

    const req = new NextRequest('http://localhost:3000/api/v1/chat/threads', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns thread list for authenticated user (AC-1)', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-123', email: 'test@example.com' } } as any,
    });

    const mockThreads = [
      {
        id: 'thread-1',
        userId: 'usr-123',
        agentId: 'agent-1',
        title: 'Order Anthropic API Credits',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(db.query.chatThread.findMany).mockResolvedValue(mockThreads as any);

    const req = new NextRequest('http://localhost:3000/api/v1/chat/threads', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.threads).toHaveLength(1);
    expect(data.threads[0].title).toBe('Order Anthropic API Credits');
  });

  it('creates new thread and initial message on POST (AC-2)', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-123', email: 'test@example.com' } } as any,
    });

    vi.mocked(db.query.agent.findFirst).mockResolvedValue({
      id: 'agent-001',
      userId: 'usr-123',
      name: 'Test Buyer Agent',
    } as any);

    const createdThread = {
      id: 'new-thread-101',
      userId: 'usr-123',
      agentId: 'agent-001',
      title: 'Buy 2 Anthropic developer tier API credits',
      status: 'active',
    };

    const createdMessage = {
      id: 'msg-001',
      threadId: 'new-thread-101',
      role: 'user',
      content: 'Buy 2 Anthropic developer tier API credits for $25.00',
    };

    const returningMock = vi
      .fn()
      .mockResolvedValueOnce([createdThread])
      .mockResolvedValueOnce([createdMessage]);

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: returningMock,
      }),
    } as any);

    const req = new NextRequest('http://localhost:3000/api/v1/chat/threads', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Buy 2 Anthropic developer tier API credits for $25.00',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.thread.id).toBe('new-thread-101');
    expect(data.initialMessage.content).toContain('Buy 2 Anthropic');
  });
});
