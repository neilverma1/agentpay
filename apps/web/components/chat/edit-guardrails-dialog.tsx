'use client';

import { Alert, AlertDescription } from '@workspace/ui/components/alert';
import { Button } from '@workspace/ui/components/button';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

export interface PolicyData {
  maxDailySpendCents: number;
  requireApprovalAboveCents: number;
  requireApprovalForNonRefundable?: boolean;
  remainingDailySpendCents?: number;
  spentLast24HoursCents?: number;
}

export interface EditGuardrailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPolicy: PolicyData | null;
  onPolicyUpdated: (updatedPolicy: PolicyData) => void;
}

export function EditGuardrailsDialog({
  open,
  onOpenChange,
  currentPolicy,
  onPolicyUpdated,
}: EditGuardrailsDialogProps) {
  const [dailyLimitDollars, setDailyLimitDollars] = React.useState('500.00');
  const [approvalThresholdDollars, setApprovalThresholdDollars] = React.useState('50.00');
  const [requireApprovalForNonRefundable, setRequireApprovalForNonRefundable] =
    React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (currentPolicy && open) {
      setDailyLimitDollars((currentPolicy.maxDailySpendCents / 100).toFixed(2));
      setApprovalThresholdDollars((currentPolicy.requireApprovalAboveCents / 100).toFixed(2));
      setRequireApprovalForNonRefundable(Boolean(currentPolicy.requireApprovalForNonRefundable));
      setErrorMessage(null);
    }
  }, [currentPolicy, open]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const dailyLimit = parseFloat(dailyLimitDollars);
    const approvalThreshold = parseFloat(approvalThresholdDollars);

    if (isNaN(dailyLimit) || dailyLimit <= 0) {
      setErrorMessage('Please enter a valid positive daily spending limit.');
      return;
    }

    if (isNaN(approvalThreshold) || approvalThreshold <= 0) {
      setErrorMessage('Please enter a valid positive approval threshold.');
      return;
    }

    const maxDailySpendCents = Math.round(dailyLimit * 100);
    const requireApprovalAboveCents = Math.round(approvalThreshold * 100);

    if (requireApprovalAboveCents > maxDailySpendCents) {
      setErrorMessage('Approval threshold cannot exceed the daily spending limit.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/v1/agent/policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxDailySpendCents,
          requireApprovalAboveCents,
          singleTransactionLimitCents: maxDailySpendCents,
          requireApprovalForNonRefundable,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update policy');
      }

      toast.success('Agent spending guardrails updated');
      onPolicyUpdated(data.policy);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update policy';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Spending Guardrails</DialogTitle>
          <DialogDescription>
            Configure wallet ceilings and autonomous approval gates for your buyer agent.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="daily-spend-limit">Daily Spending Limit (USD)</Label>
            <Input
              id="daily-spend-limit"
              type="number"
              step="0.01"
              min="1.00"
              max="10000.00"
              value={dailyLimitDollars}
              onChange={(e) => setDailyLimitDollars(e.target.value)}
              placeholder="500.00"
              required
            />
            <p className="text-muted-foreground text-xs">
              Maximum cumulative spend allowed in a rolling 24 hour window.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="approval-threshold">Autonomous Approval Threshold (USD)</Label>
            <Input
              id="approval-threshold"
              type="number"
              step="0.01"
              min="0.50"
              max="10000.00"
              value={approvalThresholdDollars}
              onChange={(e) => setApprovalThresholdDollars(e.target.value)}
              placeholder="50.00"
              required
            />
            <p className="text-muted-foreground text-xs">
              Purchases above this amount will pause for your approval before capture.
            </p>
          </div>

          <div className="border-border/80 bg-muted/20 hover:bg-muted/30 flex items-start space-x-3 rounded-lg border p-3.5 transition-colors">
            <Checkbox
              id="strict-compliance"
              checked={requireApprovalForNonRefundable}
              onCheckedChange={(checked) => setRequireApprovalForNonRefundable(Boolean(checked))}
              className="mt-0.5"
            />
            <div className="space-y-1 leading-none">
              <Label
                htmlFor="strict-compliance"
                className="text-foreground flex cursor-pointer items-center gap-1.5 text-xs font-semibold"
              >
                <ShieldCheck className="text-primary size-3.5" />
                Strict Compliance Mode
              </Label>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Require human operator approval for all non-refundable and digital consumable items,
                regardless of transaction amount.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Guardrails
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
