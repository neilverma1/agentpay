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
  | { kind: 'selected'; offer: CatalogOffer; steps: BuyerAgentStep[]; source: 'model' | 'fallback' }
  | {
      kind: 'none';
      ruleTriggered: 'no_catalog_match' | 'unknown_offer';
      reason: string;
      steps: BuyerAgentStep[];
    };

const MAX_AGENT_STEPS = 6;

const requestPurchaseSchema = z.object({
  offerId: z.string().describe('The offerId of the chosen offer'),
  reasoning: z.string().describe('Why this offer is the best choice'),
});

const SYSTEM_PROMPT = `You are the buyer agent for AgentPay.
Find the best offer for the user's goal in the merchant catalog.
Call searchOffers (more than once if useful) and compare merchants, then call requestPurchase with the offerId of the offer you choose.
You cannot pay for anything yourself. Spending is controlled by a separate policy that you cannot change or bypass.`;

function summarizeOffers(offers: readonly CatalogOffer[]): Array<Record<string, unknown>> {
  return offers.map((offer) => ({
    offerId: offer.offerId,
    title: offer.title,
    merchantName: offer.merchantName,
    priceCents: offer.priceCents,
  }));
}

function selectedStep(offer: CatalogOffer, thought: string): BuyerAgentStep {
  return {
    toolName: 'select_offer',
    thought,
    input: { offerId: offer.offerId },
    output: {
      offerId: offer.offerId,
      merchantName: offer.merchantName,
      merchantCategory: offer.merchantCategory,
      priceCents: offer.priceCents,
      source: 'catalog',
    },
  };
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

  steps.push(
    selectedStep(
      offer,
      `Chose the cheapest matching offer: ${offer.title} from ${offer.merchantName}.`,
    ),
  );
  return { kind: 'selected', offer, steps, source: 'fallback' };
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
  let requested: { offerId: string; reasoning: string } | null = null;

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

  steps.push(selectedStep(offer, requested.reasoning));
  return { kind: 'selected', offer, steps, source: 'model' };
}
