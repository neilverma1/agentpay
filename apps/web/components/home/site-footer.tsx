import ThemeSwitch from '@/components/ui/theme-switch';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { FullWidthDivider } from '@/components/home/frame';

const PRODUCT_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#guardrails', label: 'Guardrails' },
  { href: '#approval', label: 'Approval' },
  { href: '#faq', label: 'FAQ' },
] as const;

const ACCOUNT_LINKS = [
  { href: '/sign-in', label: 'Sign in' },
  { href: '/sign-up', label: 'Create an account' },
] as const;

/** Footer, adapted from efferd footer-2. */
export function SiteFooter(): ReactElement {
  return (
    <footer className="relative mt-auto">
      <div className="relative mx-auto w-full max-w-6xl border-x">
        <FullWidthDivider position="top" />
        <div className="grid grid-cols-2 gap-8 px-6 py-12 md:grid-cols-6 md:px-10">
          <div className="col-span-2 flex flex-col gap-3 md:col-span-4">
            <p className="text-lg font-semibold tracking-tight">AgentPay</p>
            <p className="text-muted-foreground max-w-[44ch] text-sm">
              Spending rules and human approval for AI agents that pay with PayPal. Runs on the
              PayPal sandbox; no real money moves.
            </p>
          </div>
          <nav aria-labelledby="footer-product" className="flex flex-col gap-2">
            <h2 id="footer-product" className="text-muted-foreground text-sm">
              Product
            </h2>
            {PRODUCT_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="w-max text-sm hover:underline">
                {link.label}
              </a>
            ))}
          </nav>
          <nav aria-labelledby="footer-account" className="flex flex-col gap-2">
            <h2 id="footer-account" className="text-muted-foreground text-sm">
              Account
            </h2>
            {ACCOUNT_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="w-max text-sm hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="text-muted-foreground relative flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm md:px-10">
          <FullWidthDivider position="top" />
          <p>Built for the PayPal hackathon.</p>
          <ThemeSwitch />
        </div>
      </div>
    </footer>
  );
}
