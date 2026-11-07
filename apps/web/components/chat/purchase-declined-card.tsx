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
import { Ban, ExternalLink, XCircle } from 'lucide-react';
import Link from 'next/link';

export interface PurchaseDeclinedDetails {
  itemDescription?: string;
  merchantName?: string;
  merchantCategory?: string;
  amountCents?: number;
  currency?: string;
  purchaseIntentId?: string;
  transactionId?: string;
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
  gambling: 'Gambling',
};

function formatCategory(category?: string | null): string {
  if (!category) return 'Digital Goods';
  const normalized = category.toLowerCase().trim();
  if (categoryLabels[normalized]) {
    return categoryLabels[normalized];
  }
  return normalized
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export interface PurchaseDeclinedCardProps {
  details: PurchaseDeclinedDetails;
}

export function PurchaseDeclinedCard({ details }: PurchaseDeclinedCardProps) {
  const amountNumber = Number(details.amountCents ?? (details.amount as number) ?? 0);
  const amountFormatted = `$${(amountNumber / 100).toFixed(2)} ${details.currency || 'USD'}`;
  const itemName = cleanItemName(details.itemDescription);
  const merchant = details.merchantName || 'Sandbox Digital Marketplace';
  const categoryLabel = formatCategory(details.merchantCategory || 'digital_goods');

  const auditTargetId = details.purchaseIntentId || details.transactionId;
  const auditHref = auditTargetId ? `/audit?id=${auditTargetId}&tab=payloads` : '/audit';

  return (
    <Card className="border-destructive/40 bg-card rounded-xl border shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-destructive/15 text-destructive flex size-7 items-center justify-center rounded-full">
              <XCircle className="size-4" />
            </div>
            <div>
              <CardTitle className="text-foreground text-sm font-semibold tracking-tight">
                Purchase Blocked by Operator
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Autonomous settlement halted before capture
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-destructive/40 bg-destructive/10 text-destructive gap-1.5 px-2 py-0.5 text-xs font-medium"
          >
            <Ban className="size-3.5" />
            <span>Declined</span>
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
        {/* Declined Amount Banner */}
        <div className="border-border/70 bg-muted/30 flex items-center justify-between rounded-lg border px-3.5 py-3">
          <div className="space-y-0.5">
            <span className="text-muted-foreground text-xs font-medium">Declined Amount</span>
            <div className="text-muted-foreground font-mono text-lg font-bold line-through">
              {amountFormatted}
            </div>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground text-xs font-medium">Settlement Status</span>
            <div className="text-destructive font-mono text-xs font-semibold">
              Cancelled (Zero Charges)
            </div>
          </div>
        </div>

        {/* Reason Box */}
        <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-2.5 text-xs">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
            Decision Audit
          </span>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {details.rejectionReason ||
              'Operator declined authorization. Agent wallet transaction was halted and no PayPal funds were captured.'}
          </p>
        </div>
      </CardContent>

      <CardFooter className="border-border/60 bg-muted/10 flex items-center justify-between border-t px-4 py-2 text-xs">
        <span className="text-muted-foreground text-[11px]">
          Decision recorded in security audit trail
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
