'use client';

import { Cross, FullWidthDivider } from '@/components/home/frame';
import { Logo } from '@/components/ui/logo';
import { useAuthUser } from '@/hooks/use-auth-user';
import { Button } from '@workspace/ui/components/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@workspace/ui/components/sheet';
import { MenuIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#guardrails', label: 'Guardrails' },
  { href: '#approval', label: 'Approval' },
  { href: '#faq', label: 'FAQ' },
] as const;

/** Marketing header framed with the same column rails, bottom rule, and corner crosses as the page sections. */
export function SiteHeader(): ReactElement {
  const { isAuthenticated } = useAuthUser();

  return (
    <header className="bg-background/90 supports-backdrop-filter:bg-background/70 sticky top-0 z-40 w-full backdrop-blur">
      <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 border-x px-6 md:px-10">
        <FullWidthDivider position="bottom" />
        <Cross position="bottom-left" />
        <Cross position="bottom-right" />

        <Link href="/" aria-label="AgentPay home" className="rounded-md">
          <Logo variant="default" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <a href={link.href}>{link.label}</a>
            </Button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <Button asChild size="sm">
              <Link href="/chat">Open app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
              <MenuIcon aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription className="sr-only">Site navigation</SheetDescription>
            </SheetHeader>
            <nav aria-label="Mobile" className="grid gap-1 px-4">
              {NAV_LINKS.map((link) => (
                <SheetClose key={link.href} asChild>
                  <Button asChild variant="ghost" className="justify-start">
                    <a href={link.href}>{link.label}</a>
                  </Button>
                </SheetClose>
              ))}
            </nav>
            <div className="mt-auto grid gap-2 p-4">
              {isAuthenticated ? (
                <Button asChild>
                  <Link href="/chat">Open app</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline">
                    <Link href="/sign-in">Sign in</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/sign-up">Get started</Link>
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
