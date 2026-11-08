'use client';

import { cleanItemName } from '@/components/chat/payment-receipt-card';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { ExternalLink, ShieldAlert, ShieldX } from 'lucide-react';
import Link from 'next/link';

export interface PolicyViolationDetails {
  itemDescription?: string;
  merchantName?: string;
  merchantCategory?: string;
  amountCents?: number;
  currency?: string;
  purchaseIntentId?: string;
  transactionId?: string;
  ruleTriggered?: string;
  rejectionReason?: string;
  [key: string]: unknown;
}

const categoryLabels: Record<string, string> = {
  digital_goods: 'Digital Goods',
  developer_tools: 'Developer Tools',
  cloud_infrastructure: 'Cloud Infrastructure',
  software_licenses: 'Software Licenses',
  marketing_services: 'Marketing Services',
  electronics: 'Electronics',
  crypto_exchange: 'Crypto Exchange',
  gambling: 'Gambling (Restricted)',
};

function formatCategory(category?: string | null): string {
  if (!category) return 'Restricted / Unknown';
  const normalized = category.toLowerCase().trim();
  if (categoryLabels[normalized]) {
    return categoryLabels[normalized];
  }
  return normalized
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatRuleName(rule?: string): string {
  if (!rule) return 'Policy Guardrail Enforced';
  switch (rule) {
    case 'restricted_merchant_category':
      return 'Restricted Merchant Category';
    case 'single_transaction_limit_cents':
      return 'Single Transaction Limit Exceeded';
    case 'max_daily_spend_cents':
      return 'Daily Budget Limit Exceeded';
    case 'no_catalog_match':
      return 'Unverified Merchant / Item';
    case 'wallet_frozen':
      return 'Emergency Wallet Freeze Active';
    default:
      return rule
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
  }
}

export interface PolicyViolationCardProps {
  details: PolicyViolationDetails;
}

function parseAttemptedAmountFromText(text?: string): number {
  if (!text) return 0;
  const match = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match || !match[1]) return 0;
  const num = parseFloat(match[1].replace(/,/g, ''));
  return isNaN(num) ? 0 : Math.round(num * 100);
}

export function PolicyViolationCard({ details }: PolicyViolationCardProps) {
  let amountNumber = Number(details.amountCents ?? (details.amount as number) ?? 0);
  if (amountNumber <= 0 && details.itemDescription) {
    amountNumber = parseAttemptedAmountFromText(details.itemDescription);
  }

  const amountFormatted =
    amountNumber > 0
      ? `$${(amountNumber / 100).toFixed(2)} ${details.currency || 'USD'}`
      : 'Unspecified Amount';
  const itemName = cleanItemName(details.itemDescription);
  const merchant = details.merchantName || 'Unverified Merchant';
  const categoryLabel = formatCategory(details.merchantCategory);
  const ruleLabel = formatRuleName(details.ruleTriggered);

  const auditTargetId = details.purchaseIntentId || details.transactionId;
  const auditHref = auditTargetId ? `/audit?id=${auditTargetId}&tab=payloads` : '/audit';

  return (
    <Card className="bg-card rounded-xl border border-rose-500/40 shadow-xs dark:border-rose-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
              <ShieldAlert className="size-4" />
            </div>
            <div>
              <CardTitle className="text-foreground text-sm font-semibold tracking-tight">
                Spending Guardrail Enforced
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Autonomous settlement blocked in code before PayPal order creation
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className="gap-1.5 border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-400"
          >
            <ShieldX className="size-3.5" />
            <span>Guardrail Blocked</span>
          </Badge>
        </div>
        <div className="mt-2.5">
          <div className="text-foreground text-base leading-tight font-semibold">{itemName}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            Merchant: <span className="text-foreground font-medium">{merchant}</span>
            <span className="text-muted-foreground/60 mx-1.5">•</span>
            <span>{categoryLabel}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Blocked Amount Banner */}
        <div className="border-border/70 bg-muted/30 flex items-center justify-between rounded-lg border px-3.5 py-3">
          <div className="space-y-0.5">
            <span className="text-muted-foreground text-xs font-medium">Attempted Amount</span>
            <div className="text-muted-foreground font-mono text-lg font-bold line-through">
              {amountFormatted}
            </div>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground text-xs font-medium">PayPal Settlement</span>
            <div className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
              Zero Charges (Halted)
            </div>
          </div>
        </div>

        {/* Rule Triggered Box */}
        <div className="space-y-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs dark:bg-rose-500/10">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-rose-800 uppercase dark:text-rose-300">
              Violated Guardrail: {ruleLabel}
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {details.rejectionReason ||
              'This purchase request violated the autonomous spending policy configured for this agent. No PayPal authorization or capture was initiated.'}
          </p>
        </div>
      </CardContent>

      <CardFooter className="border-border/60 bg-muted/10 flex items-center justify-between border-t px-4 py-2 text-xs">
        <span className="text-muted-foreground text-[11px]">
          Logged to compliance telemetry & audit trail
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 gap-1 text-xs"
          asChild
        >
          <Link href={auditHref}>
            <span>View in Audit</span>
            <ExternalLink className="size-3" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
