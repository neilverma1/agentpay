import { Badge } from '@workspace/ui/components/badge';
import type { ReactElement, ReactNode } from 'react';

import { formatCategory, formatUsd } from '@/components/home/format';
import { FrameSection } from '@/components/home/frame';
import { DEMO_POLICY } from '@/components/home/home-content';

function Tile({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="bg-background flex flex-col justify-between gap-8 px-6 py-8 md:px-10">
      <div className="min-h-16">{children}</div>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground max-w-[48ch] text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Amount({ cents }: { cents: number }): ReactElement {
  return (
    <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
      {formatUsd(cents)}
    </span>
  );
}

/** The four rules, each shown as the value it enforces rather than an icon. */
export function Guardrails(): ReactElement {
  const spent = DEMO_POLICY.spentLast24HoursCents;
  const cap = DEMO_POLICY.maxDailySpendCents;
  const percent = Math.round((spent / cap) * 100);

  return (
    <FrameSection id="guardrails" aria-labelledby="guardrails-heading" marked>
      <div className="px-6 pt-16 pb-10 md:px-10">
        <h2 id="guardrails-heading" className="text-3xl font-semibold tracking-tight">
          Rules the model cannot talk its way past
        </h2>
        <p className="text-muted-foreground mt-3 max-w-[60ch]">
          Each agent gets a policy. It is checked on the server before a PayPal order is created, in
          this order, and the first rule that fails stops the purchase.
        </p>
      </div>

      <div className="bg-border grid gap-px border-t md:grid-cols-2">
        <Tile
          title="Daily spending cap"
          body="A rolling 24-hour total. Once an agent reaches it, every further purchase is refused until older spending ages out."
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              <span className="font-mono tabular-nums">{formatUsd(spent)}</span>
              <span className="text-muted-foreground">
                {' '}
                of <span className="font-mono tabular-nums">{formatUsd(cap)}</span> used today
              </span>
            </p>
            <div
              role="meter"
              aria-label="Daily spending used"
              aria-valuemin={0}
              aria-valuemax={cap / 100}
              aria-valuenow={spent / 100}
              aria-valuetext={`${formatUsd(spent)} of ${formatUsd(cap)}`}
              className="bg-muted h-2 w-full overflow-hidden rounded-full"
            >
              <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </Tile>

        <Tile
          title="Single purchase ceiling"
          body="A hard maximum for any one order. Anything above it is blocked outright, even with your approval."
        >
          <Amount cents={DEMO_POLICY.singleTransactionLimitCents} />
        </Tile>

        <Tile
          title="Approval threshold"
          body="Purchases above this amount pause the agent and ask you first. Below it, PayPal captures right away."
        >
          <Amount cents={DEMO_POLICY.requireApprovalAboveCents} />
        </Tile>

        <Tile
          title="Blocked categories"
          body="Merchant categories an agent may never buy from. The category comes from the catalog, not the model."
        >
          <ul className="flex flex-wrap gap-2" aria-label="Blocked categories">
            {DEMO_POLICY.blockedMerchantCategories.map((category) => (
              <li key={category}>
                <Badge variant="blocked" icon>
                  {formatCategory(category)}
                </Badge>
              </li>
            ))}
          </ul>
        </Tile>
      </div>
    </FrameSection>
  );
}
