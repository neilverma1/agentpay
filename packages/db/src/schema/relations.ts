import { relations } from 'drizzle-orm';
import { agent, agentPolicy } from './agent';
import { account, session, user } from './auth';
import { approvalRequest, purchaseIntent, transaction } from './commerce';

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  agents: many(agent),
  purchaseIntents: many(purchaseIntent),
  transactions: many(transaction),
  reviewedApprovals: many(approvalRequest, { relationName: 'reviewer' }),
}));

export const agentRelations = relations(agent, ({ one, many }) => ({
  user: one(user, {
    fields: [agent.userId],
    references: [user.id],
  }),
  policy: one(agentPolicy, {
    fields: [agent.id],
    references: [agentPolicy.agentId],
  }),
  purchaseIntents: many(purchaseIntent),
  approvalRequests: many(approvalRequest),
  transactions: many(transaction),
}));

export const agentPolicyRelations = relations(agentPolicy, ({ one }) => ({
  agent: one(agent, {
    fields: [agentPolicy.agentId],
    references: [agent.id],
  }),
}));

export const purchaseIntentRelations = relations(purchaseIntent, ({ one }) => ({
  agent: one(agent, {
    fields: [purchaseIntent.agentId],
    references: [agent.id],
  }),
  user: one(user, {
    fields: [purchaseIntent.userId],
    references: [user.id],
  }),
  approvalRequest: one(approvalRequest, {
    fields: [purchaseIntent.id],
    references: [approvalRequest.purchaseIntentId],
  }),
  transaction: one(transaction, {
    fields: [purchaseIntent.id],
    references: [transaction.purchaseIntentId],
  }),
}));

export const approvalRequestRelations = relations(approvalRequest, ({ one }) => ({
  purchaseIntent: one(purchaseIntent, {
    fields: [approvalRequest.purchaseIntentId],
    references: [purchaseIntent.id],
  }),
  agent: one(agent, {
    fields: [approvalRequest.agentId],
    references: [agent.id],
  }),
  reviewer: one(user, {
    fields: [approvalRequest.reviewerId],
    references: [user.id],
    relationName: 'reviewer',
  }),
}));

export const transactionRelations = relations(transaction, ({ one }) => ({
  purchaseIntent: one(purchaseIntent, {
    fields: [transaction.purchaseIntentId],
    references: [purchaseIntent.id],
  }),
  agent: one(agent, {
    fields: [transaction.agentId],
    references: [agent.id],
  }),
  user: one(user, {
    fields: [transaction.userId],
    references: [user.id],
  }),
}));
