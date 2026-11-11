'use client';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';
import { PauseIcon, PlayIcon } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';

import { formatUsd } from '@/components/home/format';
import { DECISION_EVENTS, DEMO_POLICY, type DecisionEvent } from '@/components/home/home-content';

import { OutcomeBadge } from './outcome-badge';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

const VISIBLE_ROWS = 4;
const TICK_MS = 2600;

type Row = { key: string; event: DecisionEvent };

function eventAt(index: number): DecisionEvent {
  const event = DECISION_EVENTS[index % DECISION_EVENTS.length];
  if (!event) throw new Error('DECISION_EVENTS must not be empty');
  return event;
}

/** Rows for a given tick, newest first. Tick 0 shows the first VISIBLE_ROWS events. */
export function rowsForTick(tick: number): Row[] {
  const newest = tick + VISIBLE_ROWS - 1;
  const rows: Row[] = [];
  for (let seq = newest; seq > newest - VISIBLE_ROWS; seq -= 1) {
    rows.push({ key: `${seq}`, event: eventAt(seq) });
  }
  return rows;
}

/**
 * The hero's one moving element: purchase requests from different agents arrive
 * and each resolves against the policy. Pausable (WCAG 2.2.2) and static when
 * reduced motion is requested.
 */
export function DecisionStream(): ReactElement {
  const reducedMotion = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const running = !paused && !reducedMotion;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  const rows = rowsForTick(tick);

  return (
    <div
      role="region"
      aria-label="Example policy decisions"
      className="bg-card text-card-foreground w-full overflow-hidden rounded-xl border shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              'size-2 rounded-full bg-[var(--spend-approved)]',
              running && 'motion-safe:animate-pulse',
            )}
          />
          <p className="text-sm font-medium">Policy decisions</p>
        </div>
        {reducedMotion ? null : (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <PlayIcon aria-hidden="true" /> : <PauseIcon aria-hidden="true" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
        )}
      </div>

      <ol className="divide-y">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className={cn(
              'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3',
              index === 0 &&
                tick > 0 &&
                'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-500',
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.event.item}</p>
              <p className="text-muted-foreground truncate text-xs">
                {row.event.agent}. {row.event.rule}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-mono text-sm tabular-nums">
                {formatUsd(row.event.amountCents)}
              </span>
              <OutcomeBadge outcome={row.event.outcome} />
            </div>
          </li>
        ))}
      </ol>

      <div className="bg-muted/50 text-muted-foreground border-t px-4 py-3 text-xs">
        Approval above{' '}
        <span className="text-foreground font-mono tabular-nums">
          {formatUsd(DEMO_POLICY.requireApprovalAboveCents)}
        </span>
        , ceiling{' '}
        <span className="text-foreground font-mono tabular-nums">
          {formatUsd(DEMO_POLICY.singleTransactionLimitCents)}
        </span>
        , {DEMO_POLICY.blockedMerchantCategories.length} blocked categories
      </div>
    </div>
  );
}
