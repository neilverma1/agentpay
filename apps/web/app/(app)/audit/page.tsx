import { AuditPageSkeleton, AuditTelemetryGrid } from '@/components/telemetry';
import { generatePageMetadata, pageMetadata } from '@/config/metadata';
import { requireUser } from '@/lib/auth-helpers';
import { agent, db, eq } from '@workspace/db';
import { type ReactElement, Suspense } from 'react';

export const metadata = generatePageMetadata(
  pageMetadata.audit.title,
  pageMetadata.audit.description,
  { noindex: true },
);

export default async function AuditPage(): Promise<ReactElement> {
  const { user } = await requireUser();

  // Find or determine user's agent
  const existingAgent = await db.query.agent.findFirst({
    where: eq(agent.userId, user.id),
  });

  const activeAgentId = existingAgent?.id || '00000000-0000-0000-0000-000000000001';
  const activeAgentName = existingAgent?.name || 'Autonomous Buyer Agent';

  return (
    <section className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Suspense fallback={<AuditPageSkeleton />}>
        <AuditTelemetryGrid agentId={activeAgentId} agentName={activeAgentName} />
      </Suspense>
    </section>
  );
}
