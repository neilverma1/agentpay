import { HeroAgentDemo } from '@/components/home/hero-agent-demo';
import { FEATURES, LOOP_STEPS } from '@/components/home/home-content';
import { SiteHeader } from '@/components/home/site-header';
import ThemeSwitch from '@/components/ui/theme-switch';
import { Button } from '@workspace/ui/components/button';
import Link from 'next/link';
import type { ReactElement } from 'react';

export default function Page(): ReactElement {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <section className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col items-start gap-6">
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Your AI agent can buy things. You set the limits.
          </h1>
          <p className="text-muted-foreground max-w-prose text-lg">
            Give autonomous agents access to PayPal without giving up control. Small purchases go
            through automatically, high amounts pause for your approval, and spending limits are
            enforced in code.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <HeroAgentDemo />
        </div>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="loop-heading"
        className="bg-muted/40 scroll-mt-14 border-y"
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 id="loop-heading" className="text-2xl font-semibold tracking-tight">
            What happens when an agent wants to pay
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {LOOP_STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span className="text-muted-foreground font-mono text-sm tabular-nums">
                  Step {index + 1}
                </span>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="features"
        aria-labelledby="features-heading"
        className="mx-auto w-full max-w-6xl scroll-mt-14 px-4 py-16"
      >
        <h2 id="features-heading" className="text-2xl font-semibold tracking-tight">
          Control without babysitting
        </h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-2">
              <h3 className="font-medium">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm">
          <p>AgentPay runs against the PayPal sandbox. No real money moves.</p>
          <div className="flex items-center gap-6">
            <nav aria-label="Footer" className="flex gap-4">
              <Link href="/sign-in" className="hover:text-foreground">
                Sign in
              </Link>
              <Link href="/sign-up" className="hover:text-foreground">
                Sign up
              </Link>
            </nav>
            <ThemeSwitch />
          </div>
        </div>
      </footer>
    </div>
  );
}
