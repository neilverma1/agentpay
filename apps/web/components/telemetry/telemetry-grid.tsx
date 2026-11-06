'use client';

import { AuditTableSkeleton } from '@/components/telemetry/audit-table-skeleton';
import { AuditDataTable } from '@/components/telemetry/data-table';
import { FreezeControl } from '@/components/telemetry/freeze-control';
import { useTelemetry } from '@/hooks/use-telemetry';
import { Button } from '@workspace/ui/components/button';
import { Card } from '@workspace/ui/components/card';
import { InboxIcon } from 'lucide-react';

interface TelemetryGridProps {
  agentId: string;
  agentName?: string;
}

export function AuditTelemetryGrid({
  agentId,
  agentName = 'Autonomous Buyer Agent',
}: TelemetryGridProps) {
  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
    isFrozen,
    toggleFreeze,
    isTogglingFreeze,
  } = useTelemetry(agentId);

  const items = data?.items || [];

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {/* Universal Header, Polling Refresh, and Emergency Freeze */}
      <FreezeControl
        agentId={agentId}
        agentName={agentName}
        isFrozen={isFrozen}
        isFetching={isFetching}
        onRefresh={() => refetch()}
        onToggleFreeze={toggleFreeze}
        isToggling={isTogglingFreeze}
      />

      {/* Main Table View */}
      {isLoading ? (
        <AuditTableSkeleton />
      ) : isError ? (
        <Card className="border-destructive/40 bg-destructive/10 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-destructive text-sm font-medium">
            {error instanceof Error ? error.message : 'Failed to load telemetry stream'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry Query
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed p-8 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <InboxIcon className="text-muted-foreground size-6" />
          </div>
          <div className="flex max-w-sm flex-col gap-1">
            <h3 className="text-foreground text-sm font-semibold">No telemetry records yet</h3>
            <p className="text-muted-foreground text-xs">
              Execute a sample prompt in the purchase bench above to generate real-time autonomous
              purchase intents, policy evaluations, and PayPal transactions.
            </p>
          </div>
        </Card>
      ) : (
        <AuditDataTable data={items} />
      )}
    </div>
  );
}
