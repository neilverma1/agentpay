import {
  capturePayPalOrder,
  createPayPalOrder,
  PayPalServiceError,
  sanitizeDetails,
} from '@/lib/paypal/service';
import { google } from '@ai-sdk/google';
import { agent, db, eq, purchaseIntent, transaction } from '@workspace/db';
import { generateText, tool } from 'ai';
import { z } from 'zod';

export interface ExecutePurchaseParams {
  agentId: string;
  userId: string;
  prompt: string;
  idempotencyKey: string;
}

export interface ReasoningStep {
  step: number;
  toolName: string;
  thought: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  timestamp: string;
}

export interface PurchaseExecutionResult {
  purchaseIntentId: string;
  transactionId: string;
  paypalOrderId: string;
  paypalCaptureId: string;
  amountCents: number;
  currency: string;
  status: string;
  itemDescription: string;
  merchantName: string;
  reasoningLog: ReasoningStep[];
  capturedAt?: string;
  error?: string;
}

export class AgentPurchaseError extends Error {
  statusCode: number;
  purchaseIntentId?: string;
  transactionId?: string;
  details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    purchaseIntentId?: string,
    transactionId?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AgentPurchaseError';
    this.statusCode = statusCode;
    this.purchaseIntentId = purchaseIntentId;
    this.transactionId = transactionId;
    this.details = sanitizeDetails(details);
  }
}

function parsePromptFallback(prompt: string): {
  itemDescription: string;
  merchantName: string;
  amountCents: number;
  thought: string;
} {
  // Extract amount if present in prompt like "$12", "12 dollars", "$12.50"
  const dollarMatch =
    prompt.match(/\$(\d+(\.\d{1,2})?)/) || prompt.match(/(\d+(\.\d{1,2})?)\s*(dollars|usd)/i);
  let amountCents = 1000; // Default $10.00
  if (dollarMatch && dollarMatch[1]) {
    const parsedDollars = parseFloat(dollarMatch[1]);
    if (!isNaN(parsedDollars) && parsedDollars > 0) {
      amountCents = Math.round(parsedDollars * 100);
    }
  }

  // Extract merchant if user mentioned "from [Merchant]" or "on [Merchant]"
  const merchantMatch = prompt.match(
    /(?:from|on|at)\s+([A-Za-z0-9\s]+?)(?:\s+(?:for|to|\$|\d)|$)/i,
  );
  const merchantName =
    merchantMatch && merchantMatch[1]?.trim()
      ? merchantMatch[1].trim()
      : 'Sandbox Digital Marketplace';

  // Extract description
  const cleanDescription = prompt.length > 5 ? prompt.slice(0, 100) : 'Digital Compute Voucher';

  return {
    itemDescription: cleanDescription,
    merchantName,
    amountCents,
    thought: `Identified purchase goal for ${cleanDescription} at ${merchantName} for ${(amountCents / 100).toFixed(2)} USD.`,
  };
}

export async function executeAgentPurchaseLoop(
  params: ExecutePurchaseParams,
): Promise<PurchaseExecutionResult> {
  const { agentId, userId, prompt, idempotencyKey } = params;

  // 1. Idempotency Check
  const existingIntent = await db.query.purchaseIntent.findFirst({
    where: eq(purchaseIntent.idempotencyKey, idempotencyKey),
  });

  if (existingIntent) {
    const existingTx = await db.query.transaction.findFirst({
      where: eq(transaction.purchaseIntentId, existingIntent.id),
    });

    return {
      purchaseIntentId: existingIntent.id,
      transactionId: existingTx?.id ?? '',
      paypalOrderId: existingTx?.paypalOrderId ?? '',
      paypalCaptureId: existingTx?.paypalCaptureId ?? '',
      amountCents: existingTx?.amountCents ?? existingIntent.estimatedAmountCents,
      currency: existingIntent.currency,
      status: existingTx?.status ?? existingIntent.status,
      itemDescription: existingIntent.itemDescription,
      merchantName: existingIntent.merchantName,
      reasoningLog: (existingIntent.reasoningLog as unknown as ReasoningStep[]) || [],
      capturedAt: existingTx?.capturedAt?.toISOString(),
    };
  }

  // 2. Validate or ensure target agent exists and belongs to the user
  let targetAgent = await db.query.agent.findFirst({
    where: eq(agent.id, agentId),
  });

  if (!targetAgent) {
    const [createdAgent] = await db
      .insert(agent)
      .values({
        userId,
        name: 'Autonomous Buyer Agent',
        status: 'active',
        model: 'gemini-2.5-flash',
      })
      .returning();
    targetAgent = createdAgent;
  } else if (targetAgent.userId !== userId) {
    throw new AgentPurchaseError(
      'You do not have permission to execute purchases with this agent.',
      403,
    );
  }

  if (!targetAgent) {
    throw new AgentPurchaseError('Target agent could not be resolved.', 500);
  }

  const reasoningLog: ReasoningStep[] = [];

  // 3. Buyer Agent Reasoning via Vercel AI SDK or deterministic fallback
  let parsedItem = {
    itemDescription: 'Digital Compute Voucher',
    merchantName: 'Sandbox Digital Marketplace',
    amountCents: 1000,
    thought: 'Selected standard sandbox compute credit asset for execution.',
  };

  const hasGoogleKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

  if (hasGoogleKey) {
    try {
      const result = await generateText({
        model: google('gemini-2.5-flash'),
        system: `You are an autonomous buyer agent for AgentPay.
Your task is to parse purchase goals, determine item details, merchant name, and price in cents.
If price or merchant are omitted, default to sensible sandbox digital assets ($10.00 Digital Compute Voucher from Sandbox Digital Marketplace).
Always invoke the purchaseAsset tool to confirm your decision.`,
        prompt,
        tools: {
          purchaseAsset: tool({
            description: 'Determine the asset and pricing parameters for the purchase',
            inputSchema: z.object({
              itemDescription: z.string().describe('Item or asset description'),
              merchantName: z.string().describe('Merchant or service provider name'),
              amountCents: z
                .number()
                .int()
                .positive()
                .describe('Price in integer cents, e.g. 1000 for $10.00'),
              reasoning: z.string().describe('Summary of agent evaluation'),
            }),
          }),
        },
      });

      const toolCall = result.toolCalls?.find((tc) => tc.toolName === 'purchaseAsset');
      if (toolCall && 'input' in toolCall && toolCall.input) {
        const toolInput = toolCall.input as {
          itemDescription?: string;
          merchantName?: string;
          amountCents?: number;
          reasoning?: string;
        };
        parsedItem = {
          itemDescription: toolInput.itemDescription || parsedItem.itemDescription,
          merchantName: toolInput.merchantName || parsedItem.merchantName,
          amountCents: toolInput.amountCents || parsedItem.amountCents,
          thought:
            toolInput.reasoning ||
            'Evaluated prompt and confirmed digital asset parameters with Gemini.',
        };
      } else {
        parsedItem = parsePromptFallback(prompt);
      }
    } catch {
      parsedItem = parsePromptFallback(prompt);
    }
  } else {
    parsedItem = parsePromptFallback(prompt);
  }

  reasoningLog.push({
    step: 1,
    toolName: 'parse_intent',
    thought: parsedItem.thought,
    input: { prompt },
    output: {
      itemDescription: parsedItem.itemDescription,
      merchantName: parsedItem.merchantName,
      amountCents: parsedItem.amountCents,
    },
    timestamp: new Date().toISOString(),
  });

  // 4. Create Purchase Intent Record
  const [createdIntent] = await db
    .insert(purchaseIntent)
    .values({
      agentId: targetAgent.id,
      userId,
      idempotencyKey,
      prompt,
      itemDescription: parsedItem.itemDescription,
      merchantName: parsedItem.merchantName,
      estimatedAmountCents: parsedItem.amountCents,
      currency: 'USD',
      status: 'executing_payment',
      reasoningLog: sanitizeDetails(reasoningLog) as unknown as Array<Record<string, unknown>>,
    })
    .returning();

  if (!createdIntent) {
    throw new AgentPurchaseError('Failed to record purchase intent.', 500);
  }

  // 5. Create Transaction Record
  const [createdTx] = await db
    .insert(transaction)
    .values({
      purchaseIntentId: createdIntent.id,
      agentId: targetAgent.id,
      userId,
      amountCents: parsedItem.amountCents,
      currency: 'USD',
      status: 'created',
      paymentMethod: 'paypal',
    })
    .returning();

  if (!createdTx) {
    throw new AgentPurchaseError('Failed to initialize transaction.', 500, createdIntent.id);
  }

  try {
    // 6. PayPal Create Order
    const createRes = await createPayPalOrder({
      purchaseIntentId: createdIntent.id,
      amountCents: parsedItem.amountCents,
      currency: 'USD',
      itemDescription: parsedItem.itemDescription,
      merchantName: parsedItem.merchantName,
    });

    reasoningLog.push({
      step: 2,
      toolName: 'create_paypal_order',
      thought: `Created sandbox PayPal order with intent CAPTURE (Order ID: ${createRes.orderId}).`,
      input: {
        purchaseIntentId: createdIntent.id,
        amountCents: parsedItem.amountCents,
        currency: 'USD',
      },
      output: {
        orderId: createRes.orderId,
      },
      timestamp: new Date().toISOString(),
    });

    await db
      .update(transaction)
      .set({
        paypalOrderId: createRes.orderId,
        status: 'pending_capture',
        updatedAt: new Date(),
      })
      .where(eq(transaction.id, createdTx.id));

    // 7. PayPal Capture Order
    const captureRes = await capturePayPalOrder(createRes.orderId);

    reasoningLog.push({
      step: 3,
      toolName: 'capture_paypal_order',
      thought: `Captured payment in sandbox via server credentials (Capture ID: ${captureRes.captureId}).`,
      input: {
        orderId: createRes.orderId,
      },
      output: {
        captureId: captureRes.captureId,
        status: captureRes.status,
        capturedAmountCents: captureRes.capturedAmountCents,
      },
      timestamp: new Date().toISOString(),
    });

    // 8. Update Transaction and Intent to Completed
    const finalAmountCents = captureRes.capturedAmountCents || parsedItem.amountCents;
    const capturedAt = new Date();

    await db
      .update(transaction)
      .set({
        paypalCaptureId: captureRes.captureId,
        amountCents: finalAmountCents,
        status: 'completed',
        rawPaypalResponse: sanitizeDetails(captureRes.rawResponse),
        capturedAt,
        updatedAt: capturedAt,
      })
      .where(eq(transaction.id, createdTx.id));

    await db
      .update(purchaseIntent)
      .set({
        status: 'completed',
        reasoningLog: sanitizeDetails(reasoningLog) as unknown as Array<Record<string, unknown>>,
        updatedAt: capturedAt,
      })
      .where(eq(purchaseIntent.id, createdIntent.id));

    return {
      purchaseIntentId: createdIntent.id,
      transactionId: createdTx.id,
      paypalOrderId: createRes.orderId,
      paypalCaptureId: captureRes.captureId,
      amountCents: finalAmountCents,
      currency: 'USD',
      status: 'completed',
      itemDescription: parsedItem.itemDescription,
      merchantName: parsedItem.merchantName,
      reasoningLog,
      capturedAt: capturedAt.toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Payment execution failed';
    const errorDetails = error instanceof PayPalServiceError ? error.details : undefined;
    const statusCode = error instanceof PayPalServiceError ? error.statusCode : 422;

    reasoningLog.push({
      step: reasoningLog.length + 1,
      toolName: 'error_handler',
      thought: `Payment failed: ${errorMessage}`,
      input: { orderId: createdTx.paypalOrderId ?? 'uncreated' },
      output: { error: errorMessage },
      timestamp: new Date().toISOString(),
    });

    try {
      await db
        .update(transaction)
        .set({
          status: 'failed',
          rawPaypalResponse: sanitizeDetails(errorDetails),
          updatedAt: new Date(),
        })
        .where(eq(transaction.id, createdTx.id));

      await db
        .update(purchaseIntent)
        .set({
          status: 'failed',
          rejectionReason: errorMessage,
          reasoningLog: sanitizeDetails(reasoningLog) as unknown as Array<Record<string, unknown>>,
          updatedAt: new Date(),
        })
        .where(eq(purchaseIntent.id, createdIntent.id));
    } catch {
      // Ignore secondary update errors to ensure the primary error is reported
    }

    throw new AgentPurchaseError(
      errorMessage,
      statusCode,
      createdIntent.id,
      createdTx.id,
      sanitizeDetails(errorDetails),
    );
  }
}
