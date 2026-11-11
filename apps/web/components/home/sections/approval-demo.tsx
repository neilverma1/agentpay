'use client';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';
import { BrainIcon, CheckCircle2Icon, ClockIcon, ShieldAlertIcon, XCircleIcon } from 'lucide-react';
import { useState, type ComponentType, type ReactElement } from 'react';

type DemoStatus = 'pending' | 'captured' | 'blocked';

const REQUESTED = '74.50';
const LIMIT = '50.00';
const OVER_BY = '24.50';

type IconType = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

type Step = {
  id: string;
  icon: IconType;
  iconClassName: string;
  title: string;
  detail: ReactElement | string;
};

function StatusBadge({ status }: { status: DemoStatus }): ReactElement {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="pending" icon>
          Pending approval
        </Badge>
      );
    case 'captured':
      return (
        <Badge variant="captured" icon>
          Captured via PayPal
        </Badge>
      );
    case 'blocked':
      return (
        <Badge variant="blocked" icon>
          Blocked by operator
        </Badge>
      );
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function buildSteps(status: DemoStatus): Step[] {
  const base: Step[] = [
    {
      id: 'reasoning',
      icon: BrainIcon,
      iconClassName: 'text-muted-foreground',
      title: 'Agent reasoning',
      detail: 'Found a matching offer: 4 GPU hours, best price among 3 providers.',
    },
    {
      id: 'policy',
      icon: ShieldAlertIcon,
      iconClassName: 'text-[var(--spend-pending)]',
      title: 'Policy check',
      detail: (
        <>
          <span className="font-mono tabular-nums">${REQUESTED}</span> is{' '}
          <span className="font-mono tabular-nums">${OVER_BY}</span> over the{' '}
          <span className="font-mono tabular-nums">${LIMIT}</span> auto-approve limit.
        </>
      ),
    },
  ];

  switch (status) {
    case 'pending':
      return [
        ...base,
        {
          id: 'decision',
          icon: ClockIcon,
          iconClassName: 'text-[var(--spend-pending)]',
          title: 'Waiting for you',
          detail: 'The agent is paused until you decide.',
        },
      ];
    case 'captured':
      return [
        ...base,
        {
          id: 'decision',
          icon: CheckCircle2Icon,
          iconClassName: 'text-[var(--spend-captured)]',
          title: 'Approved and captured',
          detail: 'Payment captured in the PayPal sandbox.',
        },
      ];
    case 'blocked':
      return [
        ...base,
        {
          id: 'decision',
          icon: XCircleIcon,
          iconClassName: 'text-[var(--spend-blocked)]',
          title: 'Rejected',
          detail: 'No payment was made. The decision is saved in the audit log.',
        },
      ];
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function ApprovalDemo(): ReactElement {
  const [status, setStatus] = useState<DemoStatus>('pending');
  const steps = buildSteps(status);

  return (
    <section
      aria-label="Example agent purchase awaiting approval"
      className="bg-card text-card-foreground w-full max-w-xl overflow-hidden rounded-2xl border shadow-lg"
    >
      <div className="bg-muted/50 flex flex-col items-start gap-3 border-b px-6 py-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Procurement agent</p>
          <p className="font-medium">Reserve 4 GPU hours</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-2 gap-6 px-6 py-5">
        <div>
          <p className="text-muted-foreground text-xs">Requested</p>
          <p className="font-mono text-3xl font-semibold tabular-nums">${REQUESTED}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Auto-approve limit</p>
          <p className="text-muted-foreground font-mono text-3xl font-semibold tabular-nums">
            ${LIMIT}
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-4 border-t px-6 py-5" aria-live="polite">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3">
            <step.icon
              aria-hidden="true"
              className={cn('mt-0.5 size-4 shrink-0', step.iconClassName)}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-muted-foreground text-sm">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="bg-muted/50 flex min-h-16 items-center border-t px-6 py-4">
        {status === 'pending' ? (
          <div className="flex gap-2">
            <Button onClick={() => setStatus('captured')}>Approve ${REQUESTED}</Button>
            <Button variant="outline" onClick={() => setStatus('blocked')}>
              Reject
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setStatus('pending')}>
            Reset demo
          </Button>
        )}
      </div>
    </section>
  );
}
