import { requireAuth } from '@/lib/auth-helpers';
import { createVaultPaymentToken } from '@workspace/agent/paypal';
import { db, paypalVault } from '@workspace/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { error: authError, session } = await requireAuth(req);
  if (authError || !session?.user) {
    return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { setupTokenId?: string; vaultSetupToken?: string };
    const setupTokenId = body.vaultSetupToken || body.setupTokenId;

    if (!setupTokenId) {
      return NextResponse.json({ error: 'Missing setup token identifier' }, { status: 400 });
    }

    const wallet = await createVaultPaymentToken(setupTokenId);

    await db
      .insert(paypalVault)
      .values({
        userId: session.user.id,
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

    return NextResponse.json(
      {
        success: true,
        payerEmail: wallet.payerEmail,
        vaultId: wallet.vaultId,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('PayPal vault confirmation failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to confirm PayPal link';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
