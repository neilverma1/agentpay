import type { ReactElement } from 'react';

import { FrameSection } from '@/components/home/frame';
import { LOOP_STEPS } from '@/components/home/home-content';

/** A real three-step sequence, so the steps are numbered. Layout from efferd features-3. */
export function HowItWorks(): ReactElement {
  return (
    <FrameSection id="how-it-works" aria-labelledby="how-heading" marked muted>
      <div className="px-6 pt-16 pb-10 md:px-10">
        <h2 id="how-heading" className="text-3xl font-semibold tracking-tight">
          What happens when an agent wants to pay
        </h2>
        <p className="text-muted-foreground mt-3 max-w-[60ch]">
          Every purchase takes the same path. The model chooses what to buy; your code decides
          whether it gets paid.
        </p>
      </div>
      <ol className="bg-border grid gap-px border-t md:grid-cols-3">
        {LOOP_STEPS.map((step, index) => (
          <li key={step.title} className="bg-background flex flex-col gap-3 px-6 py-8 md:px-10">
            <span
              aria-hidden="true"
              className="text-muted-foreground font-mono text-sm tabular-nums"
            >
              {index + 1}
            </span>
            <h3 className="text-lg font-medium">
              <span className="sr-only">Step {index + 1}: </span>
              {step.title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>
    </FrameSection>
  );
}
