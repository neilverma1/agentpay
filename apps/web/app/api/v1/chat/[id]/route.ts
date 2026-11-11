import { requireAuth } from '@/lib/auth-helpers';
import {
  AgentPurchaseError,
  executeAgentPurchaseLoop,
  getOfferById,
  resolveClarificationReply,
} from '@workspace/agent';
import { and, chatMessage, chatThread, db, desc, eq } from '@workspace/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const chatRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty').max(1000).optional(),
  idempotencyKey: z.string().max(128).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .optional(),
});

export async function POST(
  req: NextRequest,
  context?: { params?: Promise<{ id?: string }> | { id?: string } },
) {
  const { error: authError, session } = await requireAuth(req);
  if (authError || !session?.user) {
    return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await context?.params;
  const threadId = resolvedParams?.id;
  if (!threadId) {
    return NextResponse.json({ error: 'Thread identifier is required' }, { status: 400 });
  }

  const thread = await db.query.chatThread.findFirst({
    where: and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)),
    with: { agent: true },
  });

  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }

  if (thread.agent.status === 'frozen') {
    return NextResponse.json(
      {
        error:
          'Agent wallet is currently frozen by compliance control. Unfreeze agent to resume autonomous purchases.',
        code: 'AGENT_FROZEN',
      },
      { status: 423 },
    );
  }

  const rawBody = await req.json().catch(() => ({}));
  const validated = chatRequestSchema.safeParse(rawBody);
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid chat payload', issues: validated.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  let prompt = validated.data.prompt;
  if (!prompt && validated.data.messages && validated.data.messages.length > 0) {
    const lastUserMessage = [...validated.data.messages].reverse().find((m) => m.role === 'user');
    prompt = lastUserMessage?.content;
  }

  if (!prompt || !prompt.trim()) {
    return NextResponse.json({ error: 'No prompt text found in request' }, { status: 400 });
  }

  const userPromptText = prompt.trim();

  // 1. Persist user message to chat_message table (avoid duplicating initial prompt if already inserted by thread creation)
  const existingLastMessage = await db.query.chatMessage.findFirst({
    where: eq(chatMessage.threadId, thread.id),
    orderBy: [desc(chatMessage.createdAt)],
  });

  const isAlreadySaved =
    existingLastMessage &&
    existingLastMessage.role === 'user' &&
    existingLastMessage.content === userPromptText;

  let savedUserMessageId = existingLastMessage?.id;

  if (!isAlreadySaved) {
    const [insertedMsg] = await db
      .insert(chatMessage)
      .values({
        threadId: thread.id,
        role: 'user',
        content: userPromptText,
        parts: [],
      })
      .returning();
    savedUserMessageId = insertedMsg?.id;
  }

  const idempotencyKey =
    validated.data.idempotencyKey ||
    (savedUserMessageId ? `chat-msg-${savedUserMessageId}` : `chat-${thread.id}-${Date.now()}`);

  // 2. Stream agent execution and thoughts via Server Sent Events
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(eventType: string, data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        sendEvent('thinking', {
          step: 1,
          thought: 'Analyzing purchase intent and extracting commercial parameters...',
          timestamp: new Date().toLocaleTimeString(),
        });

        // Small delay for natural streaming cadence
        await new Promise((resolve) => setTimeout(resolve, 300));

        sendEvent('tool_call', {
          step: 2,
          toolName: 'evaluate_spending_policy',
          thought: 'Checking agent spending limits and rolling 24 hour budget headroom...',
          timestamp: new Date().toLocaleTimeString(),
        });

        // Check if there was an active clarification request from previous turn
        const previousAssistantMessage = await db.query.chatMessage.findFirst({
          where: and(eq(chatMessage.threadId, thread.id), eq(chatMessage.role, 'assistant')),
          orderBy: [desc(chatMessage.createdAt)],
        });

        const clarificationPart = Array.isArray(previousAssistantMessage?.parts)
          ? (previousAssistantMessage.parts.find(
              (p) =>
                typeof p === 'object' &&
                p !== null &&
                (p as Record<string, unknown>).type === 'clarification_request',
            ) as Record<string, unknown> | undefined)
          : undefined;

        let effectivePrompt = userPromptText;

        if (clarificationPart && clarificationPart.offerId) {
          const offer = getOfferById(clarificationPart.offerId as string);
          if (offer) {
            const resolved = resolveClarificationReply(
              userPromptText,
              {
                offerId: offer.offerId,
                requestedQuantity: Number(clarificationPart.requestedQuantity) || 1,
                statedAmountCents: Number(clarificationPart.statedAmountCents) || offer.priceCents,
                totalAmountCents: Number(clarificationPart.totalAmountCents) || offer.priceCents,
              },
              offer.title,
            );
            if (resolved) {
              effectivePrompt = resolved;
            }
          }
        }

        const purchaseResult = await executeAgentPurchaseLoop({
          agentId: thread.agentId,
          userId: session.user.id,
          prompt: effectivePrompt,
          idempotencyKey,
        });

        if (purchaseResult.reasoningLog && purchaseResult.reasoningLog.length > 0) {
          for (const step of purchaseResult.reasoningLog) {
            sendEvent('reasoning_step', {
              step: step.step,
              toolName: step.toolName,
              thought: step.thought,
              input: step.input,
              output: step.output,
              timestamp: step.timestamp,
            });
          }
        }

        let assistantContent = '';
        const parts: Array<Record<string, unknown>> = [];

        if (purchaseResult.status === 'clarification_needed') {
          assistantContent =
            purchaseResult.clarificationMessage || 'Could you please clarify your request?';

          sendEvent('clarification_needed', {
            message: assistantContent,
            status: 'clarification_needed',
            clarificationDetails: purchaseResult.clarificationDetails,
            options: purchaseResult.clarificationOptions,
          });

          parts.push({
            type: 'clarification_request',
            message: assistantContent,
            ...purchaseResult.clarificationDetails,
            options: purchaseResult.clarificationOptions,
          });
        } else if (purchaseResult.status === 'requires_approval') {
          if (purchaseResult.ruleTriggered === 'strict_compliance_non_refundable') {
            assistantContent = `I evaluated your request to purchase **${purchaseResult.itemDescription}** from **${purchaseResult.merchantName}** for **$${(purchaseResult.amountCents / 100).toFixed(2)}**. Strict Compliance Mode requires operator authorization for final-sale (non-refundable) items before capture.`;
          } else {
            assistantContent = `I evaluated your request to purchase **${purchaseResult.itemDescription}** from **${purchaseResult.merchantName}** for **$${(purchaseResult.amountCents / 100).toFixed(2)}**. This transaction exceeds autonomous spending limits (${purchaseResult.ruleTriggered || 'threshold exceeded'}). A human in the loop approval is required before capture.`;
          }

          if (purchaseResult.savingsCents && purchaseResult.savingsCents > 0) {
            assistantContent += `\n\n💡 **Smart Price Optimization**: Selected lowest-priced offer from ${purchaseResult.merchantName}, saving **$${(purchaseResult.savingsCents / 100).toFixed(2)}** compared to alternative catalog merchants.`;
          }

          sendEvent('approval_required', {
            purchaseIntentId: purchaseResult.purchaseIntentId,
            approvalRequestId: purchaseResult.approvalRequestId,
            itemDescription: purchaseResult.itemDescription,
            merchantName: purchaseResult.merchantName,
            merchantCategory: purchaseResult.merchantCategory,
            amountCents: purchaseResult.amountCents,
            currency: purchaseResult.currency,
            ruleTriggered: purchaseResult.ruleTriggered,
            savingsCents: purchaseResult.savingsCents,
            priceComparisonSummary: purchaseResult.priceComparisonSummary,
            refundable: purchaseResult.refundable,
            refundTerms: purchaseResult.refundTerms,
            status: 'pending_approval',
          });

          parts.push({
            type: 'action_card',
            cardType: 'approval_required',
            purchaseIntentId: purchaseResult.purchaseIntentId,
            approvalRequestId: purchaseResult.approvalRequestId,
            itemDescription: purchaseResult.itemDescription,
            merchantName: purchaseResult.merchantName,
            amountCents: purchaseResult.amountCents,
            currency: purchaseResult.currency,
            ruleTriggered: purchaseResult.ruleTriggered,
            savingsCents: purchaseResult.savingsCents,
            priceComparisonSummary: purchaseResult.priceComparisonSummary,
            refundable: purchaseResult.refundable,
            refundTerms: purchaseResult.refundTerms,
            createdAt: new Date().toISOString(),
          });
        } else if (purchaseResult.status === 'completed') {
          assistantContent = `Successfully purchased **${purchaseResult.itemDescription}** from **${purchaseResult.merchantName}** for **$${(purchaseResult.amountCents / 100).toFixed(2)}**. Payment captured via PayPal sandbox (Capture ID: \`${purchaseResult.paypalCaptureId}\`).`;

          if (purchaseResult.savingsCents && purchaseResult.savingsCents > 0) {
            assistantContent += `\n\n💡 **Smart Price Optimization**: Saved **$${(purchaseResult.savingsCents / 100).toFixed(2)}** by selecting ${purchaseResult.merchantName} over competing catalog options.`;
          }

          sendEvent('payment_completed', {
            purchaseIntentId: purchaseResult.purchaseIntentId,
            transactionId: purchaseResult.transactionId,
            paypalOrderId: purchaseResult.paypalOrderId,
            paypalCaptureId: purchaseResult.paypalCaptureId,
            itemDescription: purchaseResult.itemDescription,
            merchantName: purchaseResult.merchantName,
            merchantCategory: purchaseResult.merchantCategory,
            amountCents: purchaseResult.amountCents,
            currency: purchaseResult.currency,
            savingsCents: purchaseResult.savingsCents,
            priceComparisonSummary: purchaseResult.priceComparisonSummary,
            refundable: purchaseResult.refundable,
            refundTerms: purchaseResult.refundTerms,
            status: 'completed',
          });

          parts.push({
            type: 'action_card',
            cardType: 'payment_completed',
            purchaseIntentId: purchaseResult.purchaseIntentId,
            transactionId: purchaseResult.transactionId,
            paypalOrderId: purchaseResult.paypalOrderId,
            paypalCaptureId: purchaseResult.paypalCaptureId,
            itemDescription: purchaseResult.itemDescription,
            merchantName: purchaseResult.merchantName,
            amountCents: purchaseResult.amountCents,
            currency: purchaseResult.currency,
            savingsCents: purchaseResult.savingsCents,
            priceComparisonSummary: purchaseResult.priceComparisonSummary,
            refundable: purchaseResult.refundable,
            refundTerms: purchaseResult.refundTerms,
          });
        } else if (purchaseResult.status === 'rejected') {
          assistantContent = `Autonomous purchase blocked by spending guardrail: ${purchaseResult.error || 'Spending policy check failed.'}`;

          sendEvent('policy_violation', {
            purchaseIntentId: purchaseResult.purchaseIntentId,
            itemDescription: purchaseResult.itemDescription,
            merchantName: purchaseResult.merchantName,
            merchantCategory: purchaseResult.merchantCategory,
            amountCents: purchaseResult.amountCents,
            currency: purchaseResult.currency,
            ruleTriggered: purchaseResult.ruleTriggered,
            rejectionReason: purchaseResult.error,
            status: 'rejected',
          });

          parts.push({
            type: 'action_card',
            cardType: 'policy_violation',
            purchaseIntentId: purchaseResult.purchaseIntentId,
            itemDescription: purchaseResult.itemDescription,
            merchantName: purchaseResult.merchantName,
            merchantCategory: purchaseResult.merchantCategory,
            amountCents: purchaseResult.amountCents,
            currency: purchaseResult.currency,
            ruleTriggered: purchaseResult.ruleTriggered,
            rejectionReason: purchaseResult.error,
            status: 'rejected',
          });
        } else {
          assistantContent = `Could not complete purchase: ${purchaseResult.error || 'Transaction policy check failed.'}`;
          sendEvent('payment_failed', {
            error: purchaseResult.error,
            status: 'failed',
          });
        }

        sendEvent('text', { content: assistantContent });

        // Save assistant message to database with parts
        await db.insert(chatMessage).values({
          threadId: thread.id,
          role: 'assistant',
          content: assistantContent,
          parts: [
            ...(purchaseResult.reasoningLog
              ? purchaseResult.reasoningLog.map((r) => ({
                  type: 'reasoning_step',
                  ...r,
                }))
              : []),
            ...parts,
          ],
          purchaseIntentId: purchaseResult.purchaseIntentId || null,
        });

        // Update thread updatedAt timestamp
        await db
          .update(chatThread)
          .set({ updatedAt: new Date() })
          .where(eq(chatThread.id, thread.id));

        sendEvent('done', { status: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown execution failure';
        const statusCode = err instanceof AgentPurchaseError ? err.statusCode : 500;

        sendEvent('error', {
          error: message,
          statusCode,
        });

        const isMissingVault = message.toLowerCase().includes('no paypal account linked');
        const formattedContent = isMissingVault ? `⚠️ ${message}` : `Error: ${message}`;

        await db.insert(chatMessage).values({
          threadId: thread.id,
          role: 'assistant',
          content: formattedContent,
          parts: [{ type: 'error', message }],
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
