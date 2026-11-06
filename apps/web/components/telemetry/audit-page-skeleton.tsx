import { AuditHeader } from '@/components/telemetry/audit-header';
import { AuditTableSkeleton } from '@/components/telemetry/audit-table-skeleton';
import { Skeleton } from '@workspace/ui/components/skeleton';

export function AuditPageSkeleton() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {/* Shared Page Header with exact same Title and Description styling */}
      <AuditHeader>
        <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-9 w-38 rounded-md" />
        </div>
      </AuditHeader>

      {/* Main Table Skeleton */}
      <AuditTableSkeleton />
    </div>
  );
}
