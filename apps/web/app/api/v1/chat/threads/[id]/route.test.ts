// @vitest-environment node
import { DELETE, GET, PATCH } from '@/app/api/v1/chat/threads/[id]/route';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@workspace/db';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@workspace/db', () => ({
  db: {
    query: {
      chatThread: {
        findFirst: vi.fn(),
      },
    },
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({}),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'th-100', title: 'Renamed Mission' }]),
        })),
      })),
    })),
  },
  chatThread: {
    id: 'id',
    userId: 'user_id',
  },
  chatMessage: {
    createdAt: 'created_at',
  },
  and: vi.fn(),
  eq: vi.fn(),
  asc: vi.fn(),
}));

describe('Chat Thread Detail & Delete API (/api/v1/chat/threads/[id]) (AC-7, AC-8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP 404 when thread does not exist or belongs to another user (AC-8)', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-123' } } as any,
    });

    vi.mocked(db.query.chatThread.findFirst).mockResolvedValue(null as any);

    const req = new NextRequest('http://localhost:3000/api/v1/chat/threads/th-404', {
      method: 'GET',
    });

    const res = await GET(req, { params: Promise.resolve({ id: 'th-404' }) });
    expect(res.status).toBe(404);
  });

  it('returns thread and ordered messages when owned by user (AC-7)', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-123' } } as any,
    });

    const mockThread = {
      id: 'th-100',
      userId: 'usr-123',
      title: 'Order Anthropic API Credits',
      status: 'active',
      messages: [
        { id: 'msg-1', role: 'user', content: 'Buy credits' },
        { id: 'msg-2', role: 'assistant', content: 'Purchased!' },
      ],
    };

    vi.mocked(db.query.chatThread.findFirst).mockResolvedValue(mockThread as any);

    const req = new NextRequest('http://localhost:3000/api/v1/chat/threads/th-100', {
      method: 'GET',
    });

    const res = await GET(req, { params: Promise.resolve({ id: 'th-100' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.thread.id).toBe('th-100');
    expect(data.messages).toHaveLength(2);
  });

  it('deletes thread on DELETE request (AC-8)', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-123' } } as any,
    });

    vi.mocked(db.query.chatThread.findFirst).mockResolvedValue({
      id: 'th-100',
      userId: 'usr-123',
    } as any);

    const req = new NextRequest('http://localhost:3000/api/v1/chat/threads/th-100', {
      method: 'DELETE',
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: 'th-100' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('deleted');
  });

  it('updates thread title on PATCH request', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-123' } } as any,
    });

    vi.mocked(db.query.chatThread.findFirst).mockResolvedValue({
      id: 'th-100',
      userId: 'usr-123',
      title: 'Old Title',
    } as any);

    const req = new NextRequest('http://localhost:3000/api/v1/chat/threads/th-100', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Renamed Mission' }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'th-100' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.thread.title).toBe('Renamed Mission');
  });

  it('rejects invalid title on PATCH request', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      session: { user: { id: 'usr-123' } } as any,
    });

    const req = new NextRequest('http://localhost:3000/api/v1/chat/threads/th-100', {
      method: 'PATCH',
      body: JSON.stringify({ title: '   ' }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'th-100' }) });
    expect(res.status).toBe(400);
  });
});
