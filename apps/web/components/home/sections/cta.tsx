import { Button } from '@workspace/ui/components/button';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { FrameSection } from '@/components/home/frame';

/** Closing call to action, adapted from efferd cta-2. */
export function Cta(): ReactElement {
  return (
    <FrameSection aria-labelledby="cta-heading" marked>
      <div className="px-6 py-16 md:px-10">
        <h2
          id="cta-heading"
          className="max-w-[20ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          Give your first agent a budget
        </h2>
        <p className="text-muted-foreground mt-3 max-w-[56ch]">
          Create an account, set a policy, and ask the agent to buy something. It takes about two
          minutes on the sandbox.
        </p>
      </div>
      <div className="bg-muted/50 flex flex-wrap gap-3 border-t px-6 py-5 md:px-10">
        <Button asChild size="lg">
          <Link href="/sign-up">Create an account</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </FrameSection>
  );
}
