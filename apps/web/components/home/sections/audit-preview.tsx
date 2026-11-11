import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@workspace/ui/components/code-block';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import type { ReactElement } from 'react';

import { OutcomeBadge } from '@/components/home/decision-stream/outcome-badge';
import { formatUsd } from '@/components/home/format';
import { FrameSection } from '@/components/home/frame';
import { AUDIT_ROWS, DEMO_POLICY } from '@/components/home/home-content';

const POLICY_JSON = JSON.stringify(
  {
    maxDailySpendCents: DEMO_POLICY.maxDailySpendCents,
    singleTransactionLimitCents: DEMO_POLICY.singleTransactionLimitCents,
    requireApprovalAboveCents: DEMO_POLICY.requireApprovalAboveCents,
    requireApprovalForNonRefundable: false,
    blockedMerchantCategories: DEMO_POLICY.blockedMerchantCategories,
    currency: 'USD',
  },
  null,
  2,
);

/** Audit log preview next to the policy that produced it. */
export function AuditPreview(): ReactElement {
  return (
    <FrameSection id="audit" aria-labelledby="audit-heading" marked>
      <div className="px-6 pt-16 pb-10 md:px-10">
        <h2 id="audit-heading" className="text-3xl font-semibold tracking-tight">
          Every decision is on the record
        </h2>
        <p className="text-muted-foreground mt-3 max-w-[60ch]">
          The audit log updates live as agents act and PayPal webhooks arrive. The policy behind it
          is plain data you can read and change.
        </p>
      </div>

      <div className="bg-border grid gap-px border-t lg:grid-cols-12">
        <div className="bg-background px-2 py-6 md:px-6 lg:col-span-7">
          <Table>
            <TableCaption className="sr-only">Example audit log entries</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {AUDIT_ROWS.map((row) => (
                <TableRow key={row.time}>
                  <TableCell className="text-muted-foreground font-mono tabular-nums">
                    {row.time}
                  </TableCell>
                  <TableCell>{row.agent}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatUsd(row.amountCents)}
                  </TableCell>
                  <TableCell>
                    <OutcomeBadge outcome={row.outcome} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="bg-background px-4 py-6 md:px-6 lg:col-span-5">
          <CodeBlock>
            <CodeBlockHeader>
              <CodeBlockTitle>Default agent policy</CodeBlockTitle>
              <CodeBlockActions>
                <CodeBlockCopyButton value={POLICY_JSON} />
              </CodeBlockActions>
            </CodeBlockHeader>
            <CodeBlockContent aria-label="Default agent policy as JSON">
              {POLICY_JSON}
            </CodeBlockContent>
          </CodeBlock>
        </div>
      </div>
    </FrameSection>
  );
}
