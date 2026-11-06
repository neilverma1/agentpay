import { toggleAgentFreeze } from '@/lib/agent/freeze';
import { db } from '@workspace/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@workspace/db', () => ({
  db: {
    query: {
      agent: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn(async (cb) => {
      const mockTx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{}]),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn().mockResolvedValue([{}]),
        })),
      };
      return cb(mockTx);
    }),
  },
  eq: vi.fn(),
  agent: { id: 'agent_id' },
  agentAuditLog: { id: 'audit_id' },
}));

describe('Emergency Freeze Service (AC-5, AC-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 404 when agent does not exist', async () => {
    vi.mocked(db.query.agent.findFirst).mockResolvedValue(undefined);

    await expect(
      toggleAgentFreeze({
        agentId: 'non-existent',
        userId: 'user-1',
        action: 'freeze',
      }),
    ).rejects.toThrow('Agent not found');
  });

  it('throws 403 when session user does not own the agent', async () => {
    vi.mocked(db.query.agent.findFirst).mockResolvedValue({
      id: 'agent-1',
      userId: 'different-user',
      status: 'active',
    } as never);

    await expect(
      toggleAgentFreeze({
        agentId: 'agent-1',
        userId: 'user-1',
        action: 'freeze',
      }),
    ).rejects.toThrow('You do not have permission to modify this agent');
  });

  it('atomically freezes agent and creates audit log record (AC-5)', async () => {
    vi.mocked(db.query.agent.findFirst).mockResolvedValue({
      id: 'agent-1',
      userId: 'user-1',
      status: 'active',
    } as never);

    const result = await toggleAgentFreeze({
      agentId: 'agent-1',
      userId: 'user-1',
      action: 'freeze',
      reason: 'Suspicious repetitive prompt volume detected',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('frozen');
    expect(result.agentId).toBe('agent-1');
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it('atomically unfreezes agent and creates audit log record (AC-5)', async () => {
    vi.mocked(db.query.agent.findFirst).mockResolvedValue({
      id: 'agent-1',
      userId: 'user-1',
      status: 'frozen',
    } as never);

    const result = await toggleAgentFreeze({
      agentId: 'agent-1',
      userId: 'user-1',
      action: 'unfreeze',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('active');
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
});
