'use client';

import { AuditHeader } from '@/components/telemetry/audit-header';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@workspace/ui/components/alert';
import { Button } from '@workspace/ui/components/button';
import { Spinner } from '@workspace/ui/components/spinner';
import {
  AlertOctagonIcon,
  LockIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { useState } from 'react';

interface FreezeControlProps {
  agentId: string;
  agentName?: string;
  isFrozen: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  onToggleFreeze: (action: 'freeze' | 'unfreeze', reason?: string) => Promise<unknown>;
  isToggling: boolean;
}

export function FreezeControl({
  isFrozen,
  isFetching,
  onRefresh,
  onToggleFreeze,
  isToggling,
}: FreezeControlProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleAction = async () => {
    if (isFrozen) {
      await onToggleFreeze('unfreeze');
    } else {
      await onToggleFreeze('freeze', 'Operator emergency manual freeze');
      setShowConfirm(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Universal Page Header with Refresh and Emergency Freeze in the top right */}
      <AuditHeader>
        {/* Actions in top-right: Refresh + Emergency Freeze */}
        <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onRefresh()}
            disabled={isFetching}
            title="Refresh telemetry"
            aria-label="Refresh telemetry"
          >
            <RefreshCwIcon className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>

          {!isFrozen ? (
            showConfirm ? (
              <div className="animate-in fade-in flex items-center gap-1.5 duration-150">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleAction}
                  disabled={isToggling}
                  className="h-9 text-xs font-semibold shadow-sm"
                >
                  {isToggling ? <Spinner className="mr-1 size-3.5" /> : null}
                  Confirm Freeze
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirm(false)}
                  disabled={isToggling}
                  className="h-9 text-xs"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirm(true)}
                className="border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10 text-destructive hover:text-destructive h-9 text-xs font-medium"
              >
                <ShieldAlertIcon className="mr-1 size-3.5" />
                Emergency Freeze
              </Button>
            )
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="border-destructive/30 bg-destructive/5 text-destructive/70 h-9 cursor-not-allowed text-xs font-medium"
            >
              <LockIcon className="mr-1 size-3.5" />
              Wallet Frozen
            </Button>
          )}
        </div>
      </AuditHeader>

      {/* Freeze Active Alert Banner */}
      {isFrozen && (
        <Alert
          variant="destructive"
          className="border-destructive/40 bg-destructive/5 dark:bg-destructive/10"
        >
          <AlertOctagonIcon className="text-destructive size-4 shrink-0" />

          <AlertTitle className="font-semibold tracking-tight">
            Emergency Wallet Freeze Active
          </AlertTitle>
          <AlertDescription>
            All autonomous purchase intents and PayPal transactions are blocked until the wallet is
            unfrozen.
          </AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAction}
              disabled={isToggling}
              className="border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10 text-destructive w-full shrink-0 font-medium sm:w-auto"
            >
              {isToggling ? (
                <>
                  <Spinner className="mr-1 size-3.5" />
                  Unfreezing...
                </>
              ) : (
                <>
                  <ShieldCheckIcon className="mr-1 size-3.5" />
                  Unfreeze Wallet
                </>
              )}
            </Button>
          </AlertAction>
        </Alert>
      )}
    </div>
  );
}
