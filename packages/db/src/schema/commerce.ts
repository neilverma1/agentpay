import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { agent } from './agent';
import { user } from './auth';

export const PURCHASE_INTENT_STATUSES = [
  'pending',
  'evaluating_policy',
  'requires_approval',
  'approved',
  'executing_payment',
  'completed',
  'rejected',
  'failed',
] as const;
export type PurchaseIntentStatus = (typeof PURCHASE_INTENT_STATUSES)[number];

export const APPROVAL_REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'expired'] as const;
export type ApprovalRequestStatus = (typeof APPROVAL_REQUEST_STATUSES)[number];

export const TRANSACTION_STATUSES = [
  'created',
  'pending_capture',
  'completed',
  'failed',
  'refunded',
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const WEBHOOK_EVENT_STATUSES = ['received', 'processed', 'ignored', 'failed'] as const;
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

export const purchaseIntent = pgTable(
  'purchase_intent',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    prompt: text('prompt').notNull(),
    itemDescription: text('item_description').notNull(),
    merchantName: text('merchant_name').notNull(),
    merchantCategory: text('merchant_category'),
    estimatedAmountCents: integer('estimated_amount_cents').notNull(),
    currency: text('currency').default('USD').notNull(),
    status: text('status').default('pending').$type<PurchaseIntentStatus>().notNull(),
    reasoningLog: jsonb('reasoning_log')
      .$type<Array<Record<string, unknown>>>()
      .default([])
      .notNull(),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('purchase_intent_agent_id_idx').on(table.agentId),
    index('purchase_intent_user_id_idx').on(table.userId),
    index('purchase_intent_status_idx').on(table.status),
    index('purchase_intent_created_at_idx').on(table.createdAt),
  ],
);

export const approvalRequest = pgTable(
  'approval_request',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    purchaseIntentId: uuid('purchase_intent_id')
      .notNull()
      .unique()
      .references(() => purchaseIntent.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    reviewerId: text('reviewer_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    status: text('status').default('pending').$type<ApprovalRequestStatus>().notNull(),
    ruleTriggered: text('rule_triggered').notNull(),
    triggerDetails: jsonb('trigger_details').$type<Record<string, unknown>>().default({}).notNull(),
    notes: text('notes'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('approval_request_purchase_intent_id_idx').on(table.purchaseIntentId),
    index('approval_request_agent_id_idx').on(table.agentId),
    index('approval_request_status_idx').on(table.status),
  ],
);

export const transaction = pgTable(
  'transaction',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    purchaseIntentId: uuid('purchase_intent_id')
      .notNull()
      .unique()
      .references(() => purchaseIntent.id, { onDelete: 'restrict' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'restrict' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    paypalOrderId: text('paypal_order_id').unique(),
    paypalCaptureId: text('paypal_capture_id').unique(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').default('USD').notNull(),
    status: text('status').default('created').$type<TransactionStatus>().notNull(),
    paymentMethod: text('payment_method').default('paypal').notNull(),
    refundedAmountCents: integer('refunded_amount_cents').default(0).notNull(),
    rawPaypalResponse: jsonb('raw_paypal_response').$type<Record<string, unknown>>(),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('transaction_agent_id_idx').on(table.agentId),
    index('transaction_created_at_idx').on(table.createdAt),
    index('transaction_paypal_order_id_idx').on(table.paypalOrderId),
  ],
);

export type PurchaseIntent = typeof purchaseIntent.$inferSelect;
export type NewPurchaseIntent = typeof purchaseIntent.$inferInsert;
export type ApprovalRequest = typeof approvalRequest.$inferSelect;
export type NewApprovalRequest = typeof approvalRequest.$inferInsert;
export type Transaction = typeof transaction.$inferSelect;
export type NewTransaction = typeof transaction.$inferInsert;

export const webhookEvent = pgTable(
  'webhook_event',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paypalWebhookId: text('paypal_webhook_id'),
    transmissionId: text('transmission_id').notNull().unique(),
    eventType: text('event_type').notNull(),
    resourceType: text('resource_type').notNull(),
    summary: text('summary'),
    status: text('status').default('received').$type<WebhookEventStatus>().notNull(),
    rawHeaders: jsonb('raw_headers').$type<Record<string, unknown>>().default({}).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
    errorMessage: text('error_message'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('webhook_event_transmission_id_idx').on(table.transmissionId),
    index('webhook_event_event_type_idx').on(table.eventType),
    index('webhook_event_status_idx').on(table.status),
    index('webhook_event_created_at_idx').on(table.createdAt),
  ],
);

export type WebhookEvent = typeof webhookEvent.$inferSelect;
export type NewWebhookEvent = typeof webhookEvent.$inferInsert;
