import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const AGENT_STATUSES = ['active', 'frozen', 'archived'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const agent = pgTable(
  'agent',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    model: text('model').default('gemini-2.5-flash').notNull(),
    status: text('status').default('active').$type<AgentStatus>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('agent_user_id_idx').on(table.userId),
    index('agent_status_idx').on(table.status),
  ],
);

export const agentPolicy = pgTable(
  'agent_policy',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id')
      .notNull()
      .unique()
      .references(() => agent.id, { onDelete: 'cascade' }),
    maxDailySpendCents: integer('max_daily_spend_cents').notNull(),
    singleTransactionLimitCents: integer('single_transaction_limit_cents').notNull(),
    requireApprovalAboveCents: integer('require_approval_above_cents').notNull(),
    allowedMerchantCategories: jsonb('allowed_merchant_categories')
      .$type<string[]>()
      .default([])
      .notNull(),
    blockedMerchantCategories: jsonb('blocked_merchant_categories')
      .$type<string[]>()
      .default([])
      .notNull(),
    currency: text('currency').default('USD').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('agent_policy_agent_id_idx').on(table.agentId)],
);

export type Agent = typeof agent.$inferSelect;
export type NewAgent = typeof agent.$inferInsert;
export type AgentPolicy = typeof agentPolicy.$inferSelect;
export type NewAgentPolicy = typeof agentPolicy.$inferInsert;
