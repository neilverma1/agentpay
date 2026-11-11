import type { ReactElement } from 'react';

import { FrameSection } from '@/components/home/frame';

import { ApprovalDemo } from './approval-demo';

const POINTS = [
  'The agent stops mid-conversation and shows what it wants to buy, from whom, and why.',
  'Approve and PayPal captures the order. Reject and nothing is charged.',
  'Either way the decision is saved to the audit log with the rule that triggered it.',
] as const;

/** Human-in-the-loop section with the interactive approval card. */
export function Approval(): ReactElement {
  return (
    <FrameSection id="approval" aria-labelledby="approval-heading" marked muted>
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12">
        <div className="flex flex-col gap-4 px-6 py-16 md:px-10 lg:col-span-5">
          <h2 id="approval-heading" className="text-3xl font-semibold tracking-tight">
            Big purchases wait for you
          </h2>
          <p className="text-muted-foreground max-w-[52ch]">
            When a purchase crosses your threshold, the agent pauses in the chat thread. Try it
            here: this card works the same way as the one in the app.
          </p>
          <ul className="mt-2 flex flex-col gap-3">
            {POINTS.map((point) => (
              <li key={point} className="border-primary/60 border-l-2 pl-4 text-sm leading-relaxed">
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-center px-4 pb-16 md:px-10 lg:col-span-7 lg:border-l lg:py-16">
          <ApprovalDemo />
        </div>
      </div>
    </FrameSection>
  );
}
