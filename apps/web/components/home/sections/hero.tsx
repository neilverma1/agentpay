import { Button } from '@workspace/ui/components/button';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { DecisionStream } from '@/components/home/decision-stream/decision-stream';
import { Cross, FullWidthDivider } from '@/components/home/frame';
import { BUILT_ON } from '@/components/home/home-content';

/** Hero: balanced two-column split with copy on the left and the live decision stream on the right. */
export function Hero(): ReactElement {
  return (
    <section aria-labelledby="hero-heading" className="relative">
      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] border-x lg:grid-cols-12">
        <div className="flex flex-col items-start gap-6 px-6 pt-16 pb-10 md:px-10 lg:col-span-6 lg:py-24">
          <h1
            id="hero-heading"
            className="text-4xl font-semibold tracking-tighter text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]"
          >
            Let your AI agents pay. Keep the final say.
          </h1>
          <p className="text-muted-foreground max-w-[46ch] text-lg leading-relaxed">
            AgentPay connects autonomous agents to PayPal behind rules you set. Small purchases go
            through on their own, larger ones wait for you, and blocked ones never reach PayPal.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Runs on the PayPal sandbox. No real money moves.
          </p>
        </div>

        <div className="relative flex items-center px-4 pb-16 md:px-10 lg:col-span-6 lg:py-16">
          <DecisionStream />
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-6xl border-x">
        <FullWidthDivider position="top" />
        <Cross position="top-left" />
        <Cross position="top-right" />
        <div className="flex flex-col gap-3 px-6 py-6 md:flex-row md:items-center md:gap-10 md:px-10">
          <p className="text-muted-foreground shrink-0 text-sm">Built on</p>
          <ul
            className="flex flex-1 flex-wrap gap-x-8 gap-y-2 lg:justify-between"
            aria-label="Built on"
          >
            {BUILT_ON.map((name) => (
              <li key={name} className="text-foreground/80 text-base font-medium tracking-tight">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
