import { GeneralSettingsForm } from '@/components/settings/general-settings-form';
import { PaypalLinkCard } from '@/components/settings/paypal-link-card';
import { generatePageMetadata, pageMetadata } from '@/config/metadata';
import { requireUser } from '@/lib/auth-helpers';
import { db, eq, paypalVault } from '@workspace/db';
import type { ReactElement } from 'react';

export const metadata = generatePageMetadata(
  pageMetadata.settings.general.title,
  pageMetadata.settings.general.description,
  { noindex: true },
);

export default async function GeneralSettingsPage(): Promise<ReactElement> {
  const { user } = await requireUser();
  const vault = await db.query.paypalVault.findFirst({
    where: eq(paypalVault.userId, user.id),
  });

  const clientId = process.env.PAYPAL_CLIENT_ID || '';

  return (
    <GeneralSettingsForm user={user}>
      <PaypalLinkCard
        isLinked={Boolean(vault)}
        linkedEmail={vault?.payerEmail ?? null}
        clientId={clientId}
      />
    </GeneralSettingsForm>
  );
}
