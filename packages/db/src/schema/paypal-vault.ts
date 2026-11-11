import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth';

/**
 * A user's vaulted PayPal wallet. Only opaque PayPal tokens are stored, never card or
 * account details, so the agent can pay autonomously after a one-time user approval.
 */
export const paypalVault = pgTable(
  'paypal_vault',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    vaultId: text('vault_id').notNull(),
    paypalCustomerId: text('paypal_customer_id'),
    payerEmail: text('payer_email'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('paypal_vault_user_id_idx').on(table.userId)],
);

export type PaypalVault = typeof paypalVault.$inferSelect;
export type NewPaypalVault = typeof paypalVault.$inferInsert;
