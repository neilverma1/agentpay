import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@workspace/ui/components/accordion';
import type { ReactElement } from 'react';

import { FrameSection } from '@/components/home/frame';
import { FAQS } from '@/components/home/home-content';

/** FAQ, adapted from efferd faqs-1: heading column beside a single-open accordion. */
export function Faq(): ReactElement {
  return (
    <FrameSection id="faq" aria-labelledby="faq-heading" marked muted>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 px-6 py-16 md:px-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 id="faq-heading" className="text-3xl font-semibold tracking-tight">
            Questions
          </h2>
          <p className="text-muted-foreground mt-3 max-w-[40ch]">
            What people ask before letting an agent near a payment method.
          </p>
        </div>
        <Accordion
          type="single"
          collapsible
          className="bg-background rounded-lg border lg:col-span-8"
        >
          {FAQS.map((item) => (
            <AccordionItem key={item.id} value={item.id} className="px-4">
              <AccordionTrigger className="py-4 text-base hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground max-w-[64ch] pb-4 leading-relaxed">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </FrameSection>
  );
}
