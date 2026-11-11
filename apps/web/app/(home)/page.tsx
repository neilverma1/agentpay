import { Approval } from '@/components/home/sections/approval';
import { AuditPreview } from '@/components/home/sections/audit-preview';
import { Cta } from '@/components/home/sections/cta';
import { Faq } from '@/components/home/sections/faq';
import { Guardrails } from '@/components/home/sections/guardrails';
import { Hero } from '@/components/home/sections/hero';
import { HowItWorks } from '@/components/home/sections/how-it-works';
import { SiteFooter } from '@/components/home/site-footer';
import { SiteHeader } from '@/components/home/site-header';
import type { ReactElement } from 'react';

export default function Page(): ReactElement {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Hero />
      <HowItWorks />
      <Guardrails />
      <Approval />
      <AuditPreview />
      <Faq />
      <Cta />
      <SiteFooter />
    </div>
  );
}
