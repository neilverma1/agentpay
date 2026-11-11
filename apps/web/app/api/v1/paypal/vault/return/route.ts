import { requireAuth } from '@/lib/auth-helpers';
import { createVaultPaymentToken } from '@/lib/paypal/service';
import { db, paypalVault } from '@workspace/db';
import { NextRequest, NextResponse } from 'next/server';

/** PayPal redirects here after the user approves the vault setup. */
export async function GET(req: NextRequest) {
  const { session } = await requireAuth(req);
  const uidParam = req.nextUrl.searchParams.get('uid');
  const userId = session?.user?.id || uidParam;
  const redirectOrigin =
    req.nextUrl.searchParams.get('origin') ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    req.nextUrl.origin;

  function makeRedirect(status: string): NextResponse {
    return NextResponse.redirect(new URL(`/settings/general?paypal=${status}`, redirectOrigin));
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized: missing user identifier' }, { status: 401 });
  }

  const setupTokenId = req.nextUrl.searchParams.get('approval_token_id');
  if (!setupTokenId) {
    return makeRedirect('cancelled');
  }

  try {
    const wallet = await createVaultPaymentToken(setupTokenId);
    await db
      .insert(paypalVault)
      .values({
        userId,
        vaultId: wallet.vaultId,
        paypalCustomerId: wallet.paypalCustomerId,
        payerEmail: wallet.payerEmail,
      })
      .onConflictDoUpdate({
        target: paypalVault.userId,
        set: {
          vaultId: wallet.vaultId,
          paypalCustomerId: wallet.paypalCustomerId,
          payerEmail: wallet.payerEmail,
          updatedAt: new Date(),
        },
      });
    return makeRedirect('linked');
  } catch (error) {
    console.error('PayPal vault link failed:', error);
    return makeRedirect('error');
  }
}
