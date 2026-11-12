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
import {
  Ban,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RotateCcw,
  ShieldCheck,
  TrendingDown,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
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
  savingsCents?: number;
  priceComparisonSummary?: string;
  refundable?: boolean;
  refundTerms?: string;
  status?: string;
  refundedAmountCents?: number;
  refundId?: string;
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
  onRefundSuccess?: (refundId: string) => void;
}

export function PaymentReceiptCard({ details, onRefundSuccess }: PaymentReceiptCardProps) {
  const [copyCaptureId, hasCopiedCaptureId] = useCopyToClipboard();
  const [copyOrderId, hasCopiedOrderId] = useCopyToClipboard();
  const [isRefunding, setIsRefunding] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | undefined>(details.status);
  const [refundId, setRefundId] = useState<string | undefined>(
    (details.refundId as string) || undefined,
  );

  const isRefunded = localStatus === 'refunded' || details.status === 'refunded';
  const captureId = details.paypalCaptureId || 'SANDBOX_CAPTURED';
  const orderId = details.paypalOrderId;
  const isSimulatedCapture =
    !details.paypalCaptureId ||
    details.paypalCaptureId.startsWith('SIMULATED-') ||
    details.paypalCaptureId === 'SANDBOX_CAPTURED';
  const isSimulatedOrder = !orderId || orderId.startsWith('SIMULATED-');
  const amountNumber = Number(details.amountCents ?? (details.amount as number) ?? 0);
  const amountFormatted = `$${(amountNumber / 100).toFixed(2)} ${details.currency || 'USD'}`;
  const itemName = cleanItemName(details.itemDescription);
  const merchant = details.merchantName || 'Sandbox Digital Marketplace';
  const categoryLabel = formatCategory(details.merchantCategory || 'digital_goods');

  const handleCopyCapture = async () => {
    await copyCaptureId(captureId);
    toast.success('Capture ID copied');
  };

  const handleCopyOrder = async () => {
    if (orderId) {
      await copyOrderId(orderId);
      toast.success('Order ID copied');
    }
  };

  const handleRequestRefund = async () => {
    if (isRefunding || isRefunded) return;

    const targetId =
      details.purchaseIntentId ||
      details.transactionId ||
      details.paypalCaptureId ||
      details.paypalOrderId;

    if (!targetId) {
      toast.error('Refund Reference Missing', {
        description: 'Unable to locate purchase reference for refund processing.',
      });
      return;
    }

    setIsRefunding(true);

    try {
      const res = await fetch(`/api/v1/purchases/${targetId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseIntentId: details.purchaseIntentId,
          transactionId: details.transactionId,
          paypalCaptureId: details.paypalCaptureId,
          reason: 'Autonomous purchase refund requested by operator via AgentPay',
        }),
      });

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        const errorMsg =
          typeof data.error === 'string'
            ? data.error
            : 'Failed to process refund with PayPal sandbox.';
        toast.error('Refund Failed', { description: errorMsg });
        return;
      }

      setLocalStatus('refunded');
      const resolvedRefundId = (data.refundId as string) || 'COMPLETED';
      setRefundId(resolvedRefundId);
      toast.success('Refund Completed', {
        description: `${amountFormatted} refunded via PayPal and restored to 24h spending ledger.`,
      });
      onRefundSuccess?.(resolvedRefundId);
    } catch (err) {
      console.error('Refund request error:', err);
      toast.error('Refund Failed', {
        description: 'A network error occurred. Please check your connection and retry.',
      });
    } finally {
      setIsRefunding(false);
    }
  };

  const auditTargetId = details.purchaseIntentId || details.transactionId;
  const auditHref = auditTargetId ? `/audit?id=${auditTargetId}&tab=payloads` : '/audit';

  return (
    <Card
      className={`bg-card rounded-xl border shadow-xs transition-colors ${
        isRefunded ? 'border-amber-500/40' : 'border-emerald-500/40'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`flex size-7 items-center justify-center rounded-full ${
                isRefunded
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isRefunded ? <Undo2 className="size-4" /> : <CheckCircle2 className="size-4" />}
            </div>
            <div>
              <CardTitle className="text-foreground text-sm font-semibold tracking-tight">
                {isRefunded ? 'Payment Settled & Refunded' : 'Payment Settled & Captured'}
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                {isRefunded
                  ? 'PayPal Sandbox Settlement Reversed'
                  : 'PayPal Sandbox Autonomous Settlement'}
              </CardDescription>
            </div>
          </div>

          {isRefunded ? (
            <Badge
              variant="outline"
              className="gap-1.5 border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
            >
              <Undo2 className="size-3.5" />
              <span>Refunded via PayPal</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
            >
              <ShieldCheck className="size-3.5" />
              <span>Policy Compliant</span>
            </Badge>
          )}
        </div>

        <div className="mt-2.5">
          <div className="text-foreground text-base leading-tight font-semibold">{itemName}</div>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span>
              Merchant: <span className="text-foreground font-medium">{merchant}</span>
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span>{categoryLabel}</span>
            {details.refundable === false && (
              <>
                <span className="text-muted-foreground/60">•</span>
                <span
                  className="font-medium text-amber-600 dark:text-amber-400"
                  title={(details.refundTerms as string) || 'Final Sale: Non-refundable'}
                >
                  Final Sale (Non-refundable)
                </span>
              </>
            )}
            {details.refundable === true && !isRefunded && (
              <>
                <span className="text-muted-foreground/60">•</span>
                <span
                  className="font-medium text-blue-600 dark:text-blue-400"
                  title={(details.refundTerms as string) || 'Refund Eligible (14-Day)'}
                >
                  Refund Eligible (14-Day)
                </span>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Refunded Banner */}
        {isRefunded && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Undo2 className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold">Refund Settled via PayPal</span>
                <div className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                  {amountFormatted} restored to agent 24h spending ledger
                </div>
              </div>
            </div>
            {refundId && (
              <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400">
                {refundId}
              </span>
            )}
          </div>
        )}

        {/* Captured Amount Banner */}
        <div className="border-border/70 bg-muted/30 flex items-center justify-between rounded-lg border px-3.5 py-3">
          <span className="text-muted-foreground text-xs font-medium">
            {isRefunded ? 'Captured Amount (Reversed)' : 'Captured Amount'}
          </span>
          <div className="text-right">
            <span
              className={`font-mono text-lg font-bold ${
                isRefunded ? 'text-muted-foreground/70 line-through' : 'text-foreground'
              }`}
            >
              {amountFormatted}
            </span>
            {isRefunded && (
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Net: $0.00 (Refunded)
              </div>
            )}
          </div>
        </div>

        {/* Smart Price Optimization Callout */}
        {Number(details.savingsCents) > 0 && !isRefunded && (
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
            <TrendingDown className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">
              Smart Price Optimization: Saved ${(Number(details.savingsCents) / 100).toFixed(2)} vs
              competing catalog merchants.
            </span>
          </div>
        )}

        {/* Identifiers Grid */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                PayPal Capture ID
              </span>
              <div className="flex items-center gap-1.5">
                {!isSimulatedCapture && (
                  <a
                    href={`https://www.sandbox.paypal.com/activity/payment/${captureId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="View Capture on PayPal Sandbox"
                    aria-label="View Capture on PayPal Sandbox"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
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
              <div className="flex items-center gap-1.5">
                {orderId && !isSimulatedOrder && (
                  <a
                    href={`https://www.sandbox.paypal.com/activity/payment/${orderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="View Order on PayPal Sandbox"
                    aria-label="View Order on PayPal Sandbox"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
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
            </div>
            <div className="text-foreground truncate font-mono text-xs font-medium">
              {orderId || 'PayPal Orders API v2'}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-border/60 bg-muted/10 flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs">
        {/* Left Status Text */}
        <div>
          {isRefunded ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <Undo2 className="size-3" /> Reversed on PayPal ledger
            </span>
          ) : details.refundable === false ? (
            <span
              className="text-muted-foreground flex items-center gap-1 text-[11px]"
              title={(details.refundTerms as string) || 'Final Sale: ineligble for refund'}
            >
              <Ban className="size-3 text-amber-500/80" /> Final Sale • Ineligible for refund
            </span>
          ) : (
            <span className="text-muted-foreground text-[11px]">
              Audited & logged to PayPal ledger
            </span>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {details.refundable === true && !isRefunded && (
            <Button
              variant="outline"
              size="sm"
              disabled={isRefunding}
              onClick={handleRequestRefund}
              className="h-7 gap-1.5 border-rose-200/80 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              {isRefunding ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  <span>Refunding...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="size-3" />
                  <span>Request Refund</span>
                </>
              )}
            </Button>
          )}

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
        </div>
      </CardFooter>
    </Card>
  );
}
