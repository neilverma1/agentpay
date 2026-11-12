import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TelemetryFeedResponse } from '@workspace/agent';
import { toast } from 'sonner';

async function fetchTelemetry(agentId: string): Promise<TelemetryFeedResponse> {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/telemetry?limit=50`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch telemetry (${res.status})`);
  }

  return res.json();
}

async function mutateAgentFreeze({
  agentId,
  action,
  reason,
}: {
  agentId: string;
  action: 'freeze' | 'unfreeze';
  reason?: string;
}) {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/freeze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to ${action} agent (${res.status})`);
  }

  return res.json();
}

export function useTelemetry(agentId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['telemetry', agentId],
    queryFn: () => fetchTelemetry(agentId),
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
    staleTime: 2000,
  });

  const freezeMutation = useMutation({
    mutationFn: mutateAgentFreeze,
    onSuccess: (data, variables) => {
      queryClient.setQueryData<TelemetryFeedResponse>(['telemetry', agentId], (old) => {
        if (!old) return old;
        return {
          ...old,
          agentStatus: data.status,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['telemetry', agentId] });

      if (variables.action === 'freeze') {
        toast.error('Emergency Freeze Activated', {
          description: 'Agent wallet is frozen. All autonomous purchases and payments are halted.',
        });
      } else {
        toast.success('Agent Resumed', {
          description: 'Autonomous operations and wallet spending have resumed.',
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to update agent status', {
        description: error.message,
      });
    },
  });

  return {
    ...query,
    isFrozen: query.data?.agentStatus === 'frozen',
    toggleFreeze: (action: 'freeze' | 'unfreeze', reason?: string) =>
      freezeMutation.mutateAsync({ agentId, action, reason }),
    isTogglingFreeze: freezeMutation.isPending,
  };
}
