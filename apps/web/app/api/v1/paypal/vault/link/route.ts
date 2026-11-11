import { requireAuth } from '@/lib/auth-helpers';
import { createVaultSetupToken, PayPalServiceError } from '@workspace/agent/paypal';
import { execSync } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';

let cachedTunnelUrl: { url: string; timestamp: number } | null = null;

function getVaultCallbackBase(req: NextRequest): string {
  if (process.env.PAYPAL_TUNNEL_URL) {
    return process.env.PAYPAL_TUNNEL_URL;
  }

  if (cachedTunnelUrl && Date.now() - cachedTunnelUrl.timestamp < 5 * 60 * 1000) {
    return cachedTunnelUrl.url;
  }

  try {
    const logs = execSync('docker logs agent-pay-tunnel', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    });
    const match = logs.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i);
    if (match?.[0]) {
      cachedTunnelUrl = { url: match[0], timestamp: Date.now() };
      return match[0];
    }
  } catch {
    // Docker not available or tunnel container not started
  }

  return process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  const { error: authError, session } = await requireAuth(req);
  if (authError || !session?.user) {
    return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const localOrigin = req.nextUrl.origin;
    const callbackBase = getVaultCallbackBase(req);
    const { approveUrl, setupTokenId } = await createVaultSetupToken({
      returnUrl: `${callbackBase}/api/v1/paypal/vault/return?uid=${encodeURIComponent(session.user.id)}&origin=${encodeURIComponent(localOrigin)}`,
      cancelUrl: `${callbackBase}/api/v1/paypal/vault/return?action=cancel&origin=${encodeURIComponent(localOrigin)}`,
    });
    return NextResponse.json({ setupTokenId, approveUrl }, { status: 200 });
  } catch (error) {
    if (error instanceof PayPalServiceError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode },
      );
    }
    const message = error instanceof Error ? error.message : 'Unexpected PayPal link error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
