import { AuditPageSkeleton } from '@/components/telemetry';
import type { ReactElement } from 'react';

export default function AuditLoading(): ReactElement {
  return (
    <section className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <AuditPageSkeleton />
    </section>
  );
}
