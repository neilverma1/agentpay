import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, hasToolCall, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import {
  compareMatchingOffers,
  getOfferById,
  searchOffers,
  selectCheapestMatchingOffer,
  type CatalogOffer,
  type PriceComparison,
} from './catalog';

/** One entry in the agent's reasoning trace, before the caller numbers and timestamps it. */
export interface BuyerAgentStep {
  toolName: string;
  thought: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface ClarificationOption {
  label: string;
  prompt: string;
}

export type OfferSelection =
  | {
      kind: 'selected';
      offer: CatalogOffer;
      quantity: number;
      priceComparison?: PriceComparison;
      steps: BuyerAgentStep[];
      source: 'model' | 'fallback';
    }
  | {
      kind: 'clarification';
      offer: CatalogOffer;
      requestedQuantity: number;
      statedAmountCents: number;
      totalAmountCents: number;
      message: string;
      options: ClarificationOption[];
      steps: BuyerAgentStep[];
    }
  | {
      kind: 'none';
      ruleTriggered: 'no_catalog_match' | 'unknown_offer';
      reason: string;
      steps: BuyerAgentStep[];
    };

const MAX_AGENT_STEPS = 6;

const requestPurchaseSchema = z.object({
  offerId: z.string().describe('The offerId of the chosen offer from searchOffers'),
  quantity: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe(
      'MANDATORY: Exact quantity/count requested by user (integer between 1 and 100). ' +
        'Inspect conversational quantity cues like "2 more", "two", "pair", "3x", "5 units". ' +
        'If the user specifies no quantity or multiplier, output 1.',
    ),
  reasoning: z.string().describe('Why this offer is the best choice'),
});

const SYSTEM_PROMPT = `You are the autonomous buyer agent for AgentPay.
Your goal is to fulfill the user's purchase request safely and accurately using the merchant catalog.

Workflow:
1. Search: Call searchOffers to find offers matching the user's product request. Call searchOffers multiple times if needed to compare competing merchants.
2. Price comparison: If multiple merchants sell the requested product, select the lowest-priced offer.
3. Quantity extraction:
   - Carefully inspect the prompt for requested quantities, counts, and multipliers (e.g. "2 more", "two chargers", "another 3", "5 seats", "10x").
   - You MUST pass the exact integer in the 'quantity' parameter of requestPurchase.
   - If the user does not specify any count, pass quantity: 1.
4. Finalize: Call requestPurchase with the chosen offerId, the extracted quantity, and your reasoning.

Important:
- Never guess or invent offerIds, prices, or merchants. All purchases must map to an offer from searchOffers.
- You have zero authority over spending policies or approvals. Spending limits are enforced separately by the server.`;

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

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  couple: 2,
  pair: 2,
  both: 2,
  dozen: 12,
};

function parseQuantityToken(token: string): number | null {
  const lower = token.toLowerCase().trim();
  if (WORD_NUMBERS[lower] !== undefined) {
    return WORD_NUMBERS[lower];
  }
  const parsed = parseInt(lower, 10);
  if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
    return parsed;
  }
  return null;
}

/**
 * Extracts numeric quantity from prompt while respecting catalog titles that contain numbers.
 */
export function extractQuantityFromPrompt(prompt: string, offer?: CatalogOffer): number {
  const trimmed = prompt.trim();
  const numToken = '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|couple|pair|dozen)';

  // 1. Explicit multiplier like "10x", "10 x", "x10"
  const multiplierMatch = trimmed.match(
    new RegExp(`\\b(?:x\\s*(${numToken})|\\b(${numToken})\\s*x)\\b`, 'i'),
  );
  if (multiplierMatch) {
    const val = parseQuantityToken(multiplierMatch[1] || multiplierMatch[2] || '');
    if (val !== null) return val;
  }

  // 2. Explicit "more / additional / extra / another": e.g. "2 more ...", "two more", "another 2"
  const moreMatch =
    trimmed.match(new RegExp(`\\b(${numToken})\\s+(?:more|additional|extra)\\b`, 'i')) ||
    trimmed.match(new RegExp(`\\b(?:another|extra)\\s+(${numToken})\\b`, 'i'));
  if (moreMatch) {
    const val = parseQuantityToken(moreMatch[1] || '');
    if (val !== null) return val;
  }

  // 3. Leading quantity at prompt start: e.g. "2 Anker chargers", "2 more ...", "two Anker..."
  const leadingMatch = trimmed.match(
    new RegExp(`^\\s*(${numToken})\\s+(?:more\\s+|of\\s+|units?\\s+of\\s+)?`, 'i'),
  );
  if (leadingMatch && leadingMatch[1]) {
    const val = parseQuantityToken(leadingMatch[1]);
    if (val !== null) {
      // Guard: if offer title starts with this exact number (e.g. "4 GPU hours" when prompt is "4 GPU hours")
      const titleStartsWithNum = offer && offer.title.toLowerCase().startsWith(`${val} `);
      const promptHasExplicitMore = /\b(?:more|of|units?|items?)\b/i.test(leadingMatch[0]);
      if (!titleStartsWithNum || promptHasExplicitMore) {
        return val;
      }
    }
  }

  // 4. Action verbs followed by a number: "buy 10", "purchase 5", "order 3", "get 2", "need 2"
  const actionMatch = trimmed.match(
    new RegExp(
      `\\b(?:buy|purchase|order|get|need|want|grab|add)\\s+(?:another\\s+|a\\s+)?(${numToken})\\b`,
      'i',
    ),
  );
  if (actionMatch && actionMatch[1]) {
    const qty = parseQuantityToken(actionMatch[1]);
    if (qty !== null) {
      // Guard: only treat as part of product name if offer starts with this number (e.g. "4 GPU hours")
      if (offer && offer.title.toLowerCase().startsWith(`${qty} `)) {
        return 1;
      }
      return qty;
    }
  }

  // 5. Units/seats/credits/licenses/copies preceded by a number: "10 credits", "5 seats", "2 licenses"
  const unitMatch = trimmed.match(
    new RegExp(
      `\\b(${numToken})\\s*(?:units?|seats?|licenses?|credits?|copies|subscriptions?|packages?|chargers?|mice|mouses?|keyboards?|laptops?)\\b`,
      'i',
    ),
  );
  if (unitMatch && unitMatch[1]) {
    const qty = parseQuantityToken(unitMatch[1]);
    if (qty !== null) {
      if (offer && offer.title.toLowerCase().startsWith(`${qty} `)) {
        return 1;
      }
      return qty;
    }
  }

  return 1;
}

/**
 * Extracts dollar amount from prompt in cents if explicitly mentioned (e.g. "$25", "$25.00", "25 dollars").
 */
export function extractAmountCentsFromPrompt(prompt: string): number | null {
  const dollarMatch = prompt.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (dollarMatch && dollarMatch[1]) {
    return Math.round(parseFloat(dollarMatch[1].replace(/,/g, '')) * 100);
  }
  const wordMatch = prompt.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:dollars?|usd)\b/i);
  if (wordMatch && wordMatch[1]) {
    return Math.round(parseFloat(wordMatch[1].replace(/,/g, '')) * 100);
  }
  return null;
}

/**
 * Formats a clear, conversational question when a prompt has unit pricing ambiguity.
 */
export function formatClarificationMessage(
  offer: CatalogOffer,
  quantity: number,
  statedAmountCents: number,
  totalAmountCents: number,
): string {
  const unitPriceFormatted = `$${(offer.priceCents / 100).toFixed(2)}`;
  const totalFormatted = `$${(totalAmountCents / 100).toFixed(2)}`;
  const statedFormatted = `$${(statedAmountCents / 100).toFixed(2)}`;

  const trimmedTitle = offer.title.trim();
  const verb = trimmedTitle.toLowerCase().endsWith('s') ? 'are' : 'is';

  const lowerTitle = offer.title.toLowerCase();
  let singularUnit = 'item';
  let pluralUnit = 'items';

  if (lowerTitle.includes('credit')) {
    singularUnit = 'credit';
    pluralUnit = 'credits';
  } else if (lowerTitle.includes('seat')) {
    singularUnit = 'seat';
    pluralUnit = 'seats';
  } else if (lowerTitle.includes('license')) {
    singularUnit = 'license';
    pluralUnit = 'licenses';
  } else if (lowerTitle.includes('hour')) {
    singularUnit = 'hour';
    pluralUnit = 'hours';
  } else if (lowerTitle.includes('minute')) {
    singularUnit = 'minute';
    pluralUnit = 'minutes';
  }

  if (statedAmountCents === offer.priceCents) {
    return `${trimmedTitle} ${verb} ${unitPriceFormatted} each (${totalFormatted} total for ${quantity}). Did you want me to buy 1 ${singularUnit} for ${statedFormatted}, or ${quantity} ${pluralUnit} for ${totalFormatted}?`;
  }

  return `${trimmedTitle} ${verb} ${unitPriceFormatted} each (${totalFormatted} total for ${quantity}), but you mentioned ${statedFormatted}. Did you want me to buy 1 ${singularUnit} for ${statedFormatted}, or ${quantity} ${pluralUnit} for ${totalFormatted}?`;
}

export interface ClarificationContext {
  offerId: string;
  requestedQuantity: number;
  statedAmountCents: number;
  totalAmountCents: number;
}

/**
 * Resolves follow-up responses to a clarification question (e.g. "Do 1", "Use option 1", "1", "2").
 */
export function resolveClarificationReply(
  userText: string,
  clarification: ClarificationContext,
  offerTitle: string,
): string | null {
  const text = userText.trim().toLowerCase();
  const clean = text.replace(/^[.,!?]+|[.,!?]+$/g, '');

  const singleAmountFormatted = `$${(clarification.statedAmountCents / 100).toFixed(2)}`;
  const totalAmountFormatted = `$${(clarification.totalAmountCents / 100).toFixed(2)}`;
  const singleDollarNumber = (clarification.statedAmountCents / 100).toFixed(0);
  const totalDollarNumber = (clarification.totalAmountCents / 100).toFixed(0);

  const option1Regex = new RegExp(
    `^(?:use\\s+|choose\\s+|select\\s+|pick\\s+|do\\s+)?(?:option\\s+)?1$|\\b(?:just|only|buy|get)\\s+1\\b|^1\\b|\\bfirst(?:\\s+one)?\\b|\\$${singleDollarNumber}\\b`,
    'i',
  );

  const option2Regex = new RegExp(
    `^(?:use\\s+|choose\\s+|select\\s+|pick\\s+|do\\s+)?(?:option\\s+)?2$|\\b(?:buy|get|all)\\s+${clarification.requestedQuantity}\\b|^${clarification.requestedQuantity}\\b|\\bsecond(?:\\s+one)?\\b|\\bboth\\b|\\$${totalDollarNumber}\\b`,
    'i',
  );

  const matches1 = option1Regex.test(clean);
  const matches2 = option2Regex.test(clean);

  if (matches1 && !matches2) {
    return `Buy 1 ${offerTitle} for ${singleAmountFormatted}`;
  }

  if (matches2 && !matches1) {
    return `Buy ${clarification.requestedQuantity} ${offerTitle} for ${totalAmountFormatted}`;
  }

  return null;
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
  const statedAmountCents = extractAmountCentsFromPrompt(prompt);

  if (statedAmountCents !== null) {
    const totalAmountCents = offer.priceCents * quantity;
    if (quantity > 1 && totalAmountCents !== statedAmountCents) {
      const message = formatClarificationMessage(
        offer,
        quantity,
        statedAmountCents,
        totalAmountCents,
      );
      const options: ClarificationOption[] = [
        {
          label: `Buy 1 for $${(statedAmountCents / 100).toFixed(2)}`,
          prompt: `Buy 1 ${offer.title} for $${(statedAmountCents / 100).toFixed(2)}`,
        },
        {
          label: `Buy ${quantity} for $${(totalAmountCents / 100).toFixed(2)}`,
          prompt: `Buy ${quantity} ${offer.title} for $${(totalAmountCents / 100).toFixed(2)}`,
        },
      ];
      steps.push({
        toolName: 'clarify_offer_pricing',
        thought: `Pricing ambiguity detected: prompt mentioned $${(statedAmountCents / 100).toFixed(2)}, but ${quantity}x ${offer.title} is $${(totalAmountCents / 100).toFixed(2)} ($${(offer.priceCents / 100).toFixed(2)} each). Requesting user clarification.`,
        input: { offerId: offer.offerId, quantity, statedAmountCents, totalAmountCents },
        output: { clarification: message, options },
      });
      return {
        kind: 'clarification',
        offer,
        requestedQuantity: quantity,
        statedAmountCents,
        totalAmountCents,
        message,
        options,
        steps,
      };
    }
  }

  const priceComparison = compareMatchingOffers(prompt, offer);
  let thought =
    quantity > 1
      ? `Chose the cheapest matching offer: ${quantity}x ${offer.title} from ${offer.merchantName}.`
      : `Chose the cheapest matching offer: ${offer.title} from ${offer.merchantName}.`;

  if (priceComparison && priceComparison.savingsCents > 0) {
    thought += ` Saved $${(priceComparison.savingsCents / 100).toFixed(2)} vs competing catalog merchants.`;
  }

  const step = selectedStep(offer, quantity, thought);
  if (priceComparison) {
    step.output = {
      ...step.output,
      priceComparison: {
        matchedCount: priceComparison.matchedCount,
        savingsCents: priceComparison.savingsCents,
        summary: priceComparison.summary,
      },
    };
  }

  steps.push(step);
  return {
    kind: 'selected',
    offer,
    quantity,
    priceComparison: priceComparison || undefined,
    steps,
    source: 'fallback',
  };
}

export type LLMProvider = 'openai' | 'google';

export interface ActiveLanguageModel {
  model: Parameters<typeof generateText>[0]['model'];
  provider: LLMProvider;
  modelName: string;
}

/**
 * Resolves the configured LLM provider and model.
 * Supports OpenAI (OPENAI_API_KEY / AGENTPAY_OPENAI_API_KEY) and Google Gemini (GOOGLE_GENERATIVE_AI_API_KEY).
 * When both are available, AGENTPAY_LLM_PROVIDER can explicitly select 'openai' or 'google'.
 */
export function getLanguageModel(): ActiveLanguageModel | null {
  const openAiKey = process.env.OPENAI_API_KEY || process.env.AGENTPAY_OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  const explicitProvider = process.env.AGENTPAY_LLM_PROVIDER?.toLowerCase() as
    | LLMProvider
    | undefined;

  if (explicitProvider === 'openai' && openAiKey) {
    const client = createOpenAI({ apiKey: openAiKey });
    const modelName = process.env.AGENTPAY_OPENAI_MODEL || 'gpt-4o-mini';
    return { model: client(modelName), provider: 'openai', modelName };
  }

  if (explicitProvider === 'google' && googleKey) {
    const modelName = process.env.AGENTPAY_GEMINI_MODEL || 'gemini-2.5-flash';
    return { model: google(modelName), provider: 'google', modelName };
  }

  if (openAiKey) {
    const client = createOpenAI({ apiKey: openAiKey });
    const modelName = process.env.AGENTPAY_OPENAI_MODEL || 'gpt-4o-mini';
    return { model: client(modelName), provider: 'openai', modelName };
  }

  if (googleKey) {
    const modelName = process.env.AGENTPAY_GEMINI_MODEL || 'gemini-2.5-flash';
    return { model: google(modelName), provider: 'google', modelName };
  }

  return null;
}

/**
 * Runs the buyer agent. The model can search the catalog and name an offer id.
 * Price, merchant and category always come from the catalog entry, never from the model.
 */
export async function selectOfferForPrompt(prompt: string): Promise<OfferSelection> {
  const activeModel = getLanguageModel();
  if (!activeModel) {
    return selectOfferWithoutModel(prompt, []);
  }

  const steps: BuyerAgentStep[] = [];
  let requested: { offerId: string; quantity?: number; reasoning: string } | null = null;

  try {
    const result = await generateText({
      model: activeModel.model,
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

  const promptQty = extractQuantityFromPrompt(prompt, offer);
  const modelQty = requested.quantity;
  const resolvedQty = promptQty > 1 ? promptQty : (modelQty ?? promptQty ?? 1);
  const quantity = Math.max(1, Math.min(100, Math.floor(resolvedQty)));
  const statedAmountCents = extractAmountCentsFromPrompt(prompt);

  if (statedAmountCents !== null) {
    const totalAmountCents = offer.priceCents * quantity;
    if (quantity > 1 && totalAmountCents !== statedAmountCents) {
      const message = formatClarificationMessage(
        offer,
        quantity,
        statedAmountCents,
        totalAmountCents,
      );
      const options: ClarificationOption[] = [
        {
          label: `Buy 1 for $${(statedAmountCents / 100).toFixed(2)}`,
          prompt: `Buy 1 ${offer.title} for $${(statedAmountCents / 100).toFixed(2)}`,
        },
        {
          label: `Buy ${quantity} for $${(totalAmountCents / 100).toFixed(2)}`,
          prompt: `Buy ${quantity} ${offer.title} for $${(totalAmountCents / 100).toFixed(2)}`,
        },
      ];
      steps.push({
        toolName: 'clarify_offer_pricing',
        thought: `Pricing ambiguity detected: prompt mentioned $${(statedAmountCents / 100).toFixed(2)}, but ${quantity}x ${offer.title} is $${(totalAmountCents / 100).toFixed(2)} ($${(offer.priceCents / 100).toFixed(2)} each). Requesting user clarification.`,
        input: { offerId: offer.offerId, quantity, statedAmountCents, totalAmountCents },
        output: { clarification: message, options },
      });
      return {
        kind: 'clarification',
        offer,
        requestedQuantity: quantity,
        statedAmountCents,
        totalAmountCents,
        message,
        options,
        steps,
      };
    }
  }

  const priceComparison = compareMatchingOffers(prompt, offer);
  let thought = requested.reasoning;
  if (priceComparison && priceComparison.savingsCents > 0) {
    thought += ` (Best value: saved $${(priceComparison.savingsCents / 100).toFixed(2)} vs competing merchants)`;
  }
  const step = selectedStep(offer, quantity, thought);
  if (priceComparison) {
    step.output = {
      ...step.output,
      priceComparison: {
        matchedCount: priceComparison.matchedCount,
        savingsCents: priceComparison.savingsCents,
        summary: priceComparison.summary,
      },
    };
  }
  steps.push(step);
  return {
    kind: 'selected',
    offer,
    quantity,
    priceComparison: priceComparison || undefined,
    steps,
    source: 'model',
  };
}
