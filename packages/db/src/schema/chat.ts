import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { agent } from './agent';
import { user } from './auth';
import { purchaseIntent } from './commerce';

export const CHAT_THREAD_STATUSES = ['active', 'archived'] as const;
export type ChatThreadStatus = (typeof CHAT_THREAD_STATUSES)[number];

export const CHAT_MESSAGE_ROLES = ['user', 'assistant', 'system'] as const;
export type ChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];

export const chatThread = pgTable(
  'chat_thread',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    title: text('title').default('New Commerce Mission').notNull(),
    status: text('status').default('active').$type<ChatThreadStatus>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('chat_thread_user_id_idx').on(table.userId),
    index('chat_thread_agent_id_idx').on(table.agentId),
  ],
);

export const chatMessage = pgTable(
  'chat_message',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => chatThread.id, { onDelete: 'cascade' }),
    role: text('role').$type<ChatMessageRole>().notNull(),
    content: text('content').notNull(),
    parts: jsonb('parts').$type<Array<Record<string, unknown>>>().default([]).notNull(),
    purchaseIntentId: uuid('purchase_intent_id').references(() => purchaseIntent.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('chat_message_thread_id_idx').on(table.threadId),
    index('chat_message_purchase_intent_id_idx').on(table.purchaseIntentId),
  ],
);
