import { z } from 'zod';
import { AGENT_AUDIT_ACTIONS, AGENT_STATUSES } from './agent';
import { CHAT_MESSAGE_ROLES, CHAT_THREAD_STATUSES } from './chat';
import {
  APPROVAL_REQUEST_STATUSES,
  PURCHASE_INTENT_STATUSES,
  TRANSACTION_STATUSES,
  WEBHOOK_EVENT_STATUSES,
} from './commerce';

export const agentStatusSchema = z.enum(AGENT_STATUSES);
export const agentAuditActionSchema = z.enum(AGENT_AUDIT_ACTIONS);
export const purchaseIntentStatusSchema = z.enum(PURCHASE_INTENT_STATUSES);
export const approvalRequestStatusSchema = z.enum(APPROVAL_REQUEST_STATUSES);
export const transactionStatusSchema = z.enum(TRANSACTION_STATUSES);
export const webhookEventStatusSchema = z.enum(WEBHOOK_EVENT_STATUSES);
export const chatThreadStatusSchema = z.enum(CHAT_THREAD_STATUSES);
export const chatMessageRoleSchema = z.enum(CHAT_MESSAGE_ROLES);

export const insertAgentSchema = z.object({
  userId: z.string().min(1, 'User identifier is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  model: z.string().min(1).default('gemini-2.5-flash'),
  status: agentStatusSchema.default('active'),
});

export const selectAgentSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  model: z.string(),
  status: agentStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const insertAgentPolicySchema = z
  .object({
    agentId: z.uuid('Valid agent identifier is required'),
    maxDailySpendCents: z.number().int().nonnegative('Daily spend limit must be zero or positive'),
    singleTransactionLimitCents: z
      .number()
      .int()
      .nonnegative('Single transaction limit must be zero or positive'),
    requireApprovalAboveCents: z
      .number()
      .int()
      .nonnegative('Approval threshold must be zero or positive'),
    allowedMerchantCategories: z.array(z.string()).default([]),
    blockedMerchantCategories: z.array(z.string()).default([]),
    currency: z.string().length(3).default('USD'),
  })
  .refine((data) => data.requireApprovalAboveCents <= data.singleTransactionLimitCents, {
    message: 'requireApprovalAboveCents must be less than or equal to singleTransactionLimitCents',
    path: ['requireApprovalAboveCents'],
  })
  .refine((data) => data.singleTransactionLimitCents <= data.maxDailySpendCents, {
    message: 'singleTransactionLimitCents must be less than or equal to maxDailySpendCents',
    path: ['singleTransactionLimitCents'],
  });

export const selectAgentPolicySchema = z.object({
  id: z.uuid(),
  agentId: z.uuid(),
  maxDailySpendCents: z.number().int(),
  singleTransactionLimitCents: z.number().int(),
  requireApprovalAboveCents: z.number().int(),
  allowedMerchantCategories: z.array(z.string()),
  blockedMerchantCategories: z.array(z.string()),
  currency: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const insertPurchaseIntentSchema = z.object({
  agentId: z.uuid('Valid agent identifier is required'),
  userId: z.string().min(1, 'User identifier is required'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  itemDescription: z.string().min(1, 'Item description is required'),
  merchantName: z.string().min(1, 'Merchant name is required'),
  merchantCategory: z.string().max(100).optional().nullable(),
  estimatedAmountCents: z.number().int().positive('Estimated amount must be greater than zero'),
  currency: z.string().length(3).default('USD'),
  status: purchaseIntentStatusSchema.default('pending'),
  reasoningLog: z.array(z.record(z.string(), z.unknown())).default([]),
  rejectionReason: z.string().max(1000).optional().nullable(),
});

export const selectPurchaseIntentSchema = z.object({
  id: z.uuid(),
  agentId: z.uuid(),
  userId: z.string(),
  idempotencyKey: z.string(),
  prompt: z.string(),
  itemDescription: z.string(),
  merchantName: z.string(),
  merchantCategory: z.string().nullable(),
  estimatedAmountCents: z.number().int(),
  currency: z.string(),
  status: purchaseIntentStatusSchema,
  reasoningLog: z.array(z.record(z.string(), z.unknown())),
  rejectionReason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const insertApprovalRequestSchema = z.object({
  purchaseIntentId: z.uuid('Valid purchase intent identifier is required'),
  agentId: z.uuid('Valid agent identifier is required'),
  reviewerId: z.string().optional().nullable(),
  status: approvalRequestStatusSchema.default('pending'),
  ruleTriggered: z.string().min(1, 'Triggered rule is required'),
  triggerDetails: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().max(1000).optional().nullable(),
  reviewedAt: z.date().optional().nullable(),
});

export const selectApprovalRequestSchema = z.object({
  id: z.uuid(),
  purchaseIntentId: z.uuid(),
  agentId: z.uuid(),
  reviewerId: z.string().nullable(),
  status: approvalRequestStatusSchema,
  ruleTriggered: z.string(),
  triggerDetails: z.record(z.string(), z.unknown()),
  notes: z.string().nullable(),
  reviewedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const insertTransactionSchema = z.object({
  purchaseIntentId: z.uuid('Valid purchase intent identifier is required'),
  agentId: z.uuid('Valid agent identifier is required'),
  userId: z.string().min(1, 'User identifier is required'),
  paypalOrderId: z.string().max(255).optional().nullable(),
  paypalCaptureId: z.string().max(255).optional().nullable(),
  amountCents: z.number().int().positive('Transaction amount must be greater than zero'),
  currency: z.string().length(3).default('USD'),
  status: transactionStatusSchema.default('created'),
  paymentMethod: z.string().default('paypal'),
  refundedAmountCents: z.number().int().nonnegative().default(0),
  rawPaypalResponse: z.record(z.string(), z.unknown()).optional().nullable(),
  capturedAt: z.date().optional().nullable(),
});

export const selectTransactionSchema = z.object({
  id: z.uuid(),
  purchaseIntentId: z.uuid(),
  agentId: z.uuid(),
  userId: z.string(),
  paypalOrderId: z.string().nullable(),
  paypalCaptureId: z.string().nullable(),
  amountCents: z.number().int(),
  currency: z.string(),
  status: transactionStatusSchema,
  paymentMethod: z.string(),
  refundedAmountCents: z.number().int(),
  rawPaypalResponse: z.record(z.string(), z.unknown()).nullable(),
  capturedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type InsertAgentInput = z.infer<typeof insertAgentSchema>;
export type SelectAgentOutput = z.infer<typeof selectAgentSchema>;
export type InsertAgentPolicyInput = z.infer<typeof insertAgentPolicySchema>;
export type SelectAgentPolicyOutput = z.infer<typeof selectAgentPolicySchema>;
export type InsertPurchaseIntentInput = z.infer<typeof insertPurchaseIntentSchema>;
export type SelectPurchaseIntentOutput = z.infer<typeof selectPurchaseIntentSchema>;
export type InsertApprovalRequestInput = z.infer<typeof insertApprovalRequestSchema>;
export type SelectApprovalRequestOutput = z.infer<typeof selectApprovalRequestSchema>;
export type InsertTransactionInput = z.infer<typeof insertTransactionSchema>;
export type SelectTransactionOutput = z.infer<typeof selectTransactionSchema>;

export const insertAgentAuditLogSchema = z.object({
  agentId: z.uuid('Valid agent identifier is required'),
  actorUserId: z.string().min(1, 'Actor user identifier is required'),
  action: agentAuditActionSchema,
  previousStatus: z.string().min(1),
  newStatus: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
});

export const selectAgentAuditLogSchema = z.object({
  id: z.uuid(),
  agentId: z.uuid(),
  actorUserId: z.string(),
  action: agentAuditActionSchema,
  previousStatus: z.string(),
  newStatus: z.string(),
  reason: z.string().nullable(),
  createdAt: z.date(),
});

export type InsertAgentAuditLogInput = z.infer<typeof insertAgentAuditLogSchema>;
export type SelectAgentAuditLogOutput = z.infer<typeof selectAgentAuditLogSchema>;

export const insertWebhookEventSchema = z.object({
  paypalWebhookId: z.string().max(255).optional().nullable(),
  transmissionId: z.string().min(1, 'Transmission identifier is required'),
  eventType: z.string().min(1, 'Event type is required'),
  resourceType: z.string().min(1, 'Resource type is required'),
  summary: z.string().optional().nullable(),
  status: webhookEventStatusSchema.default('received'),
  rawHeaders: z.record(z.string(), z.unknown()).default({}),
  payload: z.record(z.string(), z.unknown()).default({}),
  errorMessage: z.string().optional().nullable(),
  processedAt: z.date().optional().nullable(),
});

export const selectWebhookEventSchema = z.object({
  id: z.uuid(),
  paypalWebhookId: z.string().nullable(),
  transmissionId: z.string(),
  eventType: z.string(),
  resourceType: z.string(),
  summary: z.string().nullable(),
  status: webhookEventStatusSchema,
  rawHeaders: z.record(z.string(), z.unknown()),
  payload: z.record(z.string(), z.unknown()),
  errorMessage: z.string().nullable(),
  processedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type InsertWebhookEventInput = z.infer<typeof insertWebhookEventSchema>;
export type SelectWebhookEventOutput = z.infer<typeof selectWebhookEventSchema>;

export const insertChatThreadSchema = z.object({
  userId: z.string().min(1, 'User identifier is required'),
  agentId: z.string().uuid('Valid agent identifier is required'),
  title: z.string().max(255).default('New Commerce Mission'),
  status: chatThreadStatusSchema.default('active'),
});

export const selectChatThreadSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  agentId: z.string().uuid(),
  title: z.string(),
  status: chatThreadStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type InsertChatThreadInput = z.infer<typeof insertChatThreadSchema>;
export type SelectChatThreadOutput = z.infer<typeof selectChatThreadSchema>;

export const insertChatMessageSchema = z.object({
  threadId: z.string().uuid('Valid thread identifier is required'),
  role: chatMessageRoleSchema,
  content: z.string().min(1, 'Content is required'),
  parts: z.array(z.record(z.string(), z.unknown())).default([]),
  purchaseIntentId: z.string().uuid().optional().nullable(),
});

export const selectChatMessageSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  role: chatMessageRoleSchema,
  content: z.string(),
  parts: z.array(z.record(z.string(), z.unknown())),
  purchaseIntentId: z.string().uuid().nullable(),
  createdAt: z.date(),
});

export type InsertChatMessageInput = z.infer<typeof insertChatMessageSchema>;
export type SelectChatMessageOutput = z.infer<typeof selectChatMessageSchema>;
