import { google } from '@ai-sdk/google';
import { generateText, hasToolCall, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import {
  getOfferById,
  searchOffers,
  selectCheapestMatchingOffer,
  type CatalogOffer,
} from './catalog';

/** One entry in the agent's reasoning trace, before the caller numbers and timestamps it. */
export interface BuyerAgentStep {
  toolName: string;
  thought: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export type OfferSelection =
  | {
      kind: 'selected';
      offer: CatalogOffer;
      quantity: number;
      steps: BuyerAgentStep[];
      source: 'model' | 'fallback';
    }
  | {
      kind: 'none';
      ruleTriggered: 'no_catalog_match' | 'unknown_offer';
      reason: string;
      steps: BuyerAgentStep[];
    };

const MAX_AGENT_STEPS = 6;

const requestPurchaseSchema = z.object({
  offerId: z.string().describe('The offerId of the chosen offer'),
  quantity: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(1)
    .describe('The quantity requested by user (integer between 1 and 100, default 1)'),
  reasoning: z.string().describe('Why this offer is the best choice'),
});

const SYSTEM_PROMPT = `You are the buyer agent for AgentPay.
Find the best offer for the user's goal in the merchant catalog.
Call searchOffers (more than once if useful) and compare merchants, then call requestPurchase with the offerId, the quantity requested (default 1 unless user specified multiple units), and reasoning of the offer you choose.
You cannot pay for anything yourself. Spending is controlled by a separate policy that you cannot change or bypass.`;

function summarizeOffers(offers: readonly CatalogOffer[]): Array<Record<string, unknown>> {
  return offers.map((offer) => ({
    offerId: offer.offerId,
    title: offer.title,
    merchantName: offer.merchantName,
    priceCents: offer.priceCents,
  }));
}

function selectedStep(offer: CatalogOffer, quantity: number, thought: string): BuyerAgentStep {
  return {
    toolName: 'select_offer',
    thought,
    input: { offerId: offer.offerId, quantity },
    output: {
      offerId: offer.offerId,
      quantity,
      merchantName: offer.merchantName,
      merchantCategory: offer.merchantCategory,
      priceCents: offer.priceCents * quantity,
      unitPriceCents: offer.priceCents,
      source: 'catalog',
    },
  };
}

/**
 * Extracts numeric quantity from prompt while respecting catalog titles that contain numbers.
 */
export function extractQuantityFromPrompt(prompt: string, offer?: CatalogOffer): number {
  const trimmed = prompt.trim();

  // 1. Explicit multiplier like "10x", "10 x", "x10"
  const multiplierMatch = trimmed.match(/\b(?:x\s*(\d+)|\b(\d+)\s*x)\b/i);
  if (multiplierMatch) {
    const val = parseInt(multiplierMatch[1] || multiplierMatch[2] || '1', 10);
    if (val >= 1 && val <= 100) return val;
  }

  // 2. Action verbs followed by a number: "buy 10", "purchase 5", "order 3", "get 2"
  const actionMatch = trimmed.match(/\b(?:buy|purchase|order|get)\s+(\d+)\b/i);
  if (actionMatch && actionMatch[1]) {
    const qty = parseInt(actionMatch[1], 10);
    // Guard: check if the number is part of the matched offer's title (e.g. "4 GPU hours")
    if (offer && offer.title.toLowerCase().startsWith(`${qty} `)) {
      return 1;
    }
    if (offer && offer.title.toLowerCase().includes(`${qty}`)) {
      return 1;
    }
    if (qty >= 1 && qty <= 100) return qty;
  }

  // 3. Units/seats/credits/licenses/copies preceded by a number: "10 credits", "5 seats", "2 licenses"
  const unitMatch = trimmed.match(
    /\b(\d+)\s*(?:units?|seats?|licenses?|credits?|copies|subscriptions?|packages?)\b/i,
  );
  if (unitMatch && unitMatch[1]) {
    const qty = parseInt(unitMatch[1], 10);
    if (
      offer &&
      (offer.title.toLowerCase().startsWith(`${qty} `) ||
        offer.title.toLowerCase().includes(`${qty}`))
    ) {
      return 1;
    }
    if (qty >= 1 && qty <= 100) return qty;
  }

  return 1;
}

/** Deterministic selection used with no model key, or when the model fails to choose. */
export function selectOfferWithoutModel(
  prompt: string,
  priorSteps: BuyerAgentStep[],
): OfferSelection {
  const steps = [...priorSteps];
  const matches = searchOffers(prompt);

  steps.push({
    toolName: 'search_offers',
    thought: `Searched the merchant catalog and found ${matches.length} matching offer${matches.length === 1 ? '' : 's'}.`,
    input: { query: prompt },
    output: { offers: summarizeOffers(matches) },
  });

  const offer = selectCheapestMatchingOffer(prompt);
  if (!offer) {
    return {
      kind: 'none',
      ruleTriggered: 'no_catalog_match',
      reason:
        'No offer in the merchant catalog matches this request. Try something like "4 GPU hours", "API credits" or "a notes app subscription".',
      steps,
    };
  }

  const quantity = extractQuantityFromPrompt(prompt, offer);
  steps.push(
    selectedStep(
      offer,
      quantity,
      quantity > 1
        ? `Chose the cheapest matching offer: ${quantity}x ${offer.title} from ${offer.merchantName}.`
        : `Chose the cheapest matching offer: ${offer.title} from ${offer.merchantName}.`,
    ),
  );
  return { kind: 'selected', offer, quantity, steps, source: 'fallback' };
}

/**
 * Runs the buyer agent. The model can search the catalog and name an offer id.
 * Price, merchant and category always come from the catalog entry, never from the model.
 */
export async function selectOfferForPrompt(prompt: string): Promise<OfferSelection> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return selectOfferWithoutModel(prompt, []);
  }

  const steps: BuyerAgentStep[] = [];
  let requested: { offerId: string; quantity?: number; reasoning: string } | null = null;

  try {
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      system: SYSTEM_PROMPT,
      prompt,
      tools: {
        searchOffers: tool({
          description: 'Search the merchant catalog. Returns matching offers with their prices.',
          inputSchema: z.object({
            query: z.string().describe('What to look for, for example "4 GPU hours"'),
          }),
          execute: async ({ query }) => {
            const matches = searchOffers(query);
            steps.push({
              toolName: 'search_offers',
              thought: `Searched the merchant catalog for "${query}" and found ${matches.length} offer${matches.length === 1 ? '' : 's'}.`,
              input: { query },
              output: { offers: summarizeOffers(matches) },
            });
            return { offers: summarizeOffers(matches) };
          },
        }),
        requestPurchase: tool({
          description:
            'Choose the offer to buy. Only the offerId counts. Price and merchant come from the catalog.',
          inputSchema: requestPurchaseSchema,
        }),
      },
      stopWhen: [hasToolCall('requestPurchase'), stepCountIs(MAX_AGENT_STEPS)],
    });

    for (const step of result.steps) {
      for (const call of step.toolCalls) {
        if (call.toolName === 'requestPurchase') {
          const parsed = requestPurchaseSchema.safeParse(call.input);
          if (parsed.success) requested = parsed.data;
        }
      }
    }
  } catch {
    return selectOfferWithoutModel(prompt, steps);
  }

  if (!requested) {
    return selectOfferWithoutModel(prompt, steps);
  }

  const offer = getOfferById(requested.offerId);
  if (!offer) {
    steps.push({
      toolName: 'select_offer',
      thought: `The agent named offer "${requested.offerId}", which is not in the merchant catalog. Purchase refused.`,
      input: { offerId: requested.offerId },
      output: { error: 'unknown_offer' },
    });
    return {
      kind: 'none',
      ruleTriggered: 'unknown_offer',
      reason: `Offer "${requested.offerId}" is not in the merchant catalog.`,
      steps,
    };
  }

  const quantity = Math.max(1, Math.min(100, Math.floor(requested.quantity || 1)));
  steps.push(selectedStep(offer, quantity, requested.reasoning));
  return { kind: 'selected', offer, quantity, steps, source: 'model' };
}
