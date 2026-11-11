'use client';

import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Spinner } from '@workspace/ui/components/spinner';
import { CheckCircle2, Wallet } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface PaypalLinkCardProps {
  linkedEmail: string | null;
  isLinked: boolean;
  clientId?: string;
}

export function PaypalLinkCard({ linkedEmail, isLinked }: PaypalLinkCardProps) {
  const searchParams = useSearchParams();
  const returnStatus = searchParams.get('paypal');
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (returnStatus === 'linked') toast.success('PayPal account linked.');
    if (returnStatus === 'cancelled') toast.info('PayPal linking was cancelled.');
    if (returnStatus === 'error') toast.error('Could not link PayPal. Please try again.');
  }, [returnStatus]);

  const handleLink = async () => {
    setIsLinking(true);
    try {
      const res = await fetch('/api/v1/paypal/vault/link', { method: 'POST' });
      const data = (await res.json()) as { approveUrl?: string; error?: string };
      if (!res.ok || !data.approveUrl) {
        throw new Error(data.error || 'Failed to start linking');
      }
      window.location.assign(data.approveUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Linking failed');
      setIsLinking(false);
    }
  };

  return (
    <Card id="paypal" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          PayPal Account
        </CardTitle>
        <CardDescription>
          Link PayPal once so your agent can pay within your spending limits without asking each
          time. Only a secure PayPal token is stored.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {isLinked ? (
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Linked{linkedEmail ? `: ${linkedEmail}` : ''}</span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No PayPal account linked.</p>
          )}
        </div>

        <div>
          <Button
            type="button"
            variant={isLinked ? 'outline' : 'default'}
            onClick={handleLink}
            disabled={isLinking}
          >
            {isLinking && <Spinner className="mr-2 size-4" />}
            {isLinked ? 'Relink PayPal' : 'Connect PayPal'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
