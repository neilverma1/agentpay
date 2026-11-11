import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { agent, db, eq } from '@workspace/db';
import crypto from 'crypto';
import { z } from 'zod';
import { getOfferById, MERCHANT_CATALOG, searchOffers } from '../catalog';
import { toggleAgentFreeze } from '../freeze';
import { getAgentSpentLast24Hours, getOrCreateAgentPolicy } from '../policy';
import { AgentPurchaseError, executeAgentPurchaseLoop } from '../purchase';
import { getAgentTelemetry } from '../telemetry';

export interface McpServerOptions {
  name?: string;
  version?: string;
}

async function resolveAgentOwner(agentId: string, providedUserId?: string): Promise<string> {
  if (providedUserId) return providedUserId;
  const targetAgent = await db.query.agent.findFirst({
    where: eq(agent.id, agentId),
  });
  if (!targetAgent) {
    throw new Error(
      `Agent '${agentId}' not found. Please provide an existing agent ID or create one first.`,
    );
  }
  return targetAgent.userId;
}

/**
 * Creates and configures the AgentPay Model Context Protocol (MCP) server
 * with tools for catalog lookup, policy evaluation, purchase execution,
 * emergency freezing, and audit telemetry.
 */
export function createAgentPayMcpServer(options: McpServerOptions = {}) {
  const server = new McpServer({
    name: options.name || 'agentpay-server',
    version: options.version || '1.0.0',
  });

  // 1. Search Merchant Catalog Tool
  server.tool(
    'agentpay_search_catalog',
    'Search the verified merchant catalog for software licenses, cloud compute, and API credits. Returns verified prices in cents and merchant categories to avoid hallucinated pricing.',
    {
      query: z
        .string()
        .min(1)
        .describe('Search query for tools or services, e.g. "anthropic", "github", "figma"'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(5)
        .describe('Maximum number of items to return'),
    },
    async ({ query, limit }) => {
      try {
        const matches = searchOffers(query, limit);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: matches.length,
                  query,
                  offers: matches.map((offer) => ({
                    offerId: offer.offerId,
                    title: offer.title,
                    merchant: offer.merchantName,
                    category: offer.merchantCategory,
                    priceUsd: (offer.priceCents / 100).toFixed(2),
                    priceCents: offer.priceCents,
                    refundable: offer.refundable,
                    refundTerms: offer.refundTerms,
                    tags: offer.tags,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to search catalog: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // 2. Get Offer Details Tool
  server.tool(
    'agentpay_get_offer_details',
    'Retrieve exact specifications, pricing, and refundability terms for a specific catalog offer ID.',
    {
      offerId: z
        .string()
        .min(1)
        .describe('Exact catalog offer identifier, e.g. "api-anthropic-credits-25"'),
    },
    async ({ offerId }) => {
      const offer = getOfferById(offerId);
      if (!offer) {
        return {
          content: [
            {
              type: 'text',
              text: `Offer '${offerId}' was not found in the verified merchant catalog.`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ...offer,
                priceUsd: (offer.priceCents / 100).toFixed(2),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // 3. Check Spending Policy Tool
  server.tool(
    'agentpay_check_spending_policy',
    'Inspect the spending policy, rolling 24-hour spend, remaining daily budget headroom, and approval thresholds for an agent before requesting a purchase.',
    {
      agentId: z.string().min(1).describe('The UUID of the agent to check policy for'),
    },
    async ({ agentId }) => {
      try {
        const policy = await getOrCreateAgentPolicy(agentId);
        const spentLast24HoursCents = await getAgentSpentLast24Hours(agentId);
        const remainingDailyCents = Math.max(0, policy.maxDailySpendCents - spentLast24HoursCents);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  agentId,
                  limits: {
                    singleTransactionLimitUsd: (policy.singleTransactionLimitCents / 100).toFixed(
                      2,
                    ),
                    singleTransactionLimitCents: policy.singleTransactionLimitCents,
                    maxDailySpendUsd: (policy.maxDailySpendCents / 100).toFixed(2),
                    maxDailySpendCents: policy.maxDailySpendCents,
                    requireApprovalAboveUsd: (policy.requireApprovalAboveCents / 100).toFixed(2),
                    requireApprovalAboveCents: policy.requireApprovalAboveCents,
                  },
                  velocity: {
                    spentLast24HoursUsd: (spentLast24HoursCents / 100).toFixed(2),
                    spentLast24HoursCents,
                    remainingDailyBudgetUsd: (remainingDailyCents / 100).toFixed(2),
                    remainingDailyBudgetCents: remainingDailyCents,
                  },
                  rules: {
                    allowedCategories: policy.allowedMerchantCategories,
                    blockedCategories: policy.blockedMerchantCategories,
                    requireApprovalForNonRefundable: policy.requireApprovalForNonRefundable,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to retrieve policy for agent '${agentId}': ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // 4. Execute Purchase Intent Tool
  server.tool(
    'agentpay_execute_purchase',
    'Execute a purchase intent with autonomous policy evaluation and PayPal settlement. If within threshold, captures immediately via PayPal; if above threshold, safely stages an approval request.',
    {
      agentId: z.string().min(1).describe('The UUID of the agent initiating the purchase'),
      prompt: z
        .string()
        .min(1)
        .max(1000)
        .describe(
          'Natural language purchase command, e.g. "Buy Anthropic developer API credits for $25.00"',
        ),
      userId: z
        .string()
        .optional()
        .describe('User ID for the session (defaults to the agent owner in database)'),
      idempotencyKey: z
        .string()
        .optional()
        .describe('Unique idempotency key to prevent double execution'),
    },
    async ({ agentId, prompt, userId, idempotencyKey }) => {
      try {
        const resolvedUserId = await resolveAgentOwner(agentId, userId);
        const effectiveIdempotencyKey =
          idempotencyKey || `mcp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        const result = await executeAgentPurchaseLoop({
          agentId,
          userId: resolvedUserId,
          prompt,
          idempotencyKey: effectiveIdempotencyKey,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: result.status,
                  item: result.itemDescription,
                  merchant: result.merchantName,
                  category: result.merchantCategory,
                  amountUsd: (result.amountCents / 100).toFixed(2),
                  amountCents: result.amountCents,
                  paypalOrderId: result.paypalOrderId || null,
                  paypalCaptureId: result.paypalCaptureId || null,
                  approvalRequestId: result.approvalRequestId || null,
                  ruleTriggered: result.ruleTriggered || null,
                  error: result.error || null,
                  clarificationMessage: result.clarificationMessage || null,
                  reasoningSteps: result.reasoningLog.map((step) => ({
                    step: step.step,
                    tool: step.toolName,
                    thought: step.thought,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        const statusCode = err instanceof AgentPurchaseError ? err.statusCode : 500;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: (err as Error).message,
                  statusCode,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // 5. Emergency Freeze Tool
  server.tool(
    'agentpay_freeze_agent',
    'Emergency kill switch: freeze or unfreeze an agent wallet to instantly halt or restore all autonomous purchasing capabilities.',
    {
      agentId: z.string().min(1).describe('The agent UUID to freeze or unfreeze'),
      action: z.enum(['freeze', 'unfreeze']).describe('Action to execute'),
      userId: z.string().optional().describe('Owner user ID (defaults to agent owner in database)'),
      reason: z
        .string()
        .max(500)
        .optional()
        .describe('Reason for the emergency freeze or unfreeze action'),
    },
    async ({ agentId, action, userId, reason }) => {
      try {
        const resolvedUserId = await resolveAgentOwner(agentId, userId);
        const result = await toggleAgentFreeze({
          agentId,
          userId: resolvedUserId,
          action,
          reason,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: result.success,
                  agentId: result.agentId,
                  status: result.status,
                  action,
                  reason: reason || null,
                  updatedAt: result.updatedAt,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Freeze action failed: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // 6. Audit Telemetry Feed Tool
  server.tool(
    'agentpay_get_telemetry',
    'Retrieve recent audit telemetry events, policy evaluations, and PayPal transaction records for an agent.',
    {
      agentId: z.string().min(1).describe('The agent UUID to inspect telemetry for'),
      userId: z.string().optional().describe('Owner user ID (defaults to agent owner in database)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(20)
        .describe('Maximum number of audit events to return'),
      status: z
        .string()
        .optional()
        .describe('Filter by status (e.g. "completed", "requires_approval", "rejected")'),
    },
    async ({ agentId, userId, limit, status }) => {
      try {
        const resolvedUserId = await resolveAgentOwner(agentId, userId);
        const data = await getAgentTelemetry({
          agentId,
          userId: resolvedUserId,
          limit,
          status,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  agentId,
                  totalItems: data.items.length,
                  nextCursor: data.nextCursor,
                  agentStatus: data.agentStatus,
                  items: data.items.map((item) => ({
                    id: item.id,
                    createdAt: item.createdAt,
                    prompt: item.prompt,
                    itemDescription: item.itemDescription,
                    merchantName: item.merchantName,
                    amountUsd: (item.amountCents / 100).toFixed(2),
                    status: item.status,
                    paypalOrderId: item.paypalOrderId,
                    paypalCaptureId: item.paypalCaptureId,
                    approvalRequestId: item.approvalRequestId,
                    ruleTriggered: item.ruleTriggered,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to fetch telemetry: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // 7. Resource: Catalog Dump
  server.resource(
    'catalog',
    'agentpay://catalog',
    {
      description: 'Complete list of verified SaaS and developer merchants in the AgentPay catalog',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'agentpay://catalog',
          text: JSON.stringify(MERCHANT_CATALOG, null, 2),
          mimeType: 'application/json',
        },
      ],
    }),
  );

  return server;
}

/**
 * Starts the AgentPay MCP server using standard StdioServerTransport,
 * suitable for Claude Desktop, Cursor, and CLI agent integrations.
 */
export async function startAgentPayStdioServer() {
  const server = createAgentPayMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('AgentPay MCP Server running on stdio.\n');
}
