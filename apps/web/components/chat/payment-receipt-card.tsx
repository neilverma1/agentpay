'use client';

import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
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
import { Check, CheckCircle2, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export interface PaymentReceiptDetails {
  paypalCaptureId?: string;
  paypalOrderId?: string;
  purchaseIntentId?: string;
  transactionId?: string;
  itemDescription?: string;
  merchantName?: string;
  merchantCategory?: string;
  amountCents?: number;
  currency?: string;
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

export function cleanItemName(rawDescription: unknown): string {
  if (typeof rawDescription !== 'string' || !rawDescription) {
    return 'Digital Asset Purchase';
  }
  return rawDescription
    .replace(/^Order\s+/i, '')
    .replace(/^Purchase\s+/i, '')
    .replace(/^Buy\s+/i, '')
    .replace(/\s+for\s+\$[\d,.]+(\s+USD)?$/i, '')
    .trim();
}

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

export interface PaymentReceiptCardProps {
  details: PaymentReceiptDetails;
}

export function PaymentReceiptCard({ details }: PaymentReceiptCardProps) {
  const [copyCaptureId, hasCopiedCaptureId] = useCopyToClipboard();
  const [copyOrderId, hasCopiedOrderId] = useCopyToClipboard();

  const captureId = details.paypalCaptureId || 'SANDBOX_CAPTURED';
  const orderId = details.paypalOrderId;
  const amountNumber = Number(details.amountCents ?? (details.amount as number) ?? 0);
  const amountFormatted = `$${(amountNumber / 100).toFixed(2)} ${details.currency || 'USD'}`;
  const itemName = cleanItemName(details.itemDescription);
  const merchant = details.merchantName || 'Sandbox Digital Marketplace';
  const categoryLabel = formatCategory(details.merchantCategory || 'digital_goods');

  const handleCopyCapture = async () => {
    await copyCaptureId(captureId);
    toast.success('PayPal Capture ID copied to clipboard');
  };

  const handleCopyOrder = async () => {
    if (orderId) {
      await copyOrderId(orderId);
      toast.success('PayPal Order ID copied to clipboard');
    }
  };

  const auditTargetId = details.purchaseIntentId || details.transactionId;
  const auditHref = auditTargetId ? `/audit?id=${auditTargetId}&tab=payloads` : '/audit';

  return (
    <Card className="bg-card rounded-xl border border-emerald-500/40 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <CardTitle className="text-foreground text-sm font-semibold tracking-tight">
                Payment Settled & Captured
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                PayPal Sandbox Autonomous Settlement
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
          >
            <ShieldCheck className="size-3.5" />
            <span>Policy Compliant</span>
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
        {/* Captured Amount Banner */}
        <div className="border-border/70 bg-muted/30 flex items-center justify-between rounded-lg border px-3.5 py-3">
          <span className="text-muted-foreground text-xs font-medium">Captured Amount</span>
          <span className="text-foreground font-mono text-lg font-bold">{amountFormatted}</span>
        </div>

        {/* Identifiers Grid */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                PayPal Capture ID
              </span>
              <button
                type="button"
                onClick={handleCopyCapture}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copy Capture ID"
                aria-label="Copy Capture ID"
              >
                {hasCopiedCaptureId ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
            <div className="text-foreground truncate font-mono text-xs font-medium">
              {captureId}
            </div>
          </div>

          <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                {orderId ? 'PayPal Order ID' : 'Payment Rail'}
              </span>
              {orderId ? (
                <button
                  type="button"
                  onClick={handleCopyOrder}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy Order ID"
                  aria-label="Copy Order ID"
                >
                  {hasCopiedOrderId ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              ) : null}
            </div>
            <div className="text-foreground truncate font-mono text-xs font-medium">
              {orderId || 'PayPal Orders API v2'}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-border/60 bg-muted/10 flex items-center justify-between border-t px-4 py-2 text-xs">
        <span className="text-muted-foreground text-[11px]">Audited & logged to PayPal ledger</span>
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
