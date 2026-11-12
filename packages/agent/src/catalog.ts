/**
 * Mock merchant catalog. This is the only source of truth for an offer's price,
 * merchant and category (spec 0009). The buyer agent may only name an `offerId`;
 * it never supplies these values, so the spending policy cannot be talked past
 * with a false price or category.
 */

export interface CatalogOffer {
  readonly offerId: string;
  readonly title: string;
  readonly merchantName: string;
  readonly merchantCategory: string;
  readonly priceCents: number;
  readonly currency: 'USD';
  readonly tags: readonly string[];
  readonly refundable: boolean;
  readonly refundTerms: string;
}

export const MERCHANT_CATALOG: readonly CatalogOffer[] = [
  {
    offerId: 'api-anthropic-credits-25',
    title: 'Anthropic developer tier API credits',
    merchantName: 'Anthropic',
    merchantCategory: 'developer_tools',
    priceCents: 2500,
    currency: 'USD',
    tags: ['anthropic', 'api', 'credits', 'developer', 'claude', 'tokens', 'tier'],
    refundable: false,
    refundTerms: 'Digital consumable: non-refundable once provisioned',
  },
  {
    offerId: 'figma-pro-seat-45',
    title: 'Figma Pro seat subscription',
    merchantName: 'Figma',
    merchantCategory: 'software_licenses',
    priceCents: 4500,
    currency: 'USD',
    tags: ['figma', 'design', 'seat', 'subscription', 'pro'],
    refundable: true,
    refundTerms: '14-day money-back guarantee for unused seats',
  },
  {
    offerId: 'github-enterprise-license-84',
    title: 'GitHub Enterprise (4-seat team license)',
    merchantName: 'GitHub',
    merchantCategory: 'developer_tools',
    priceCents: 8400,
    currency: 'USD',
    tags: ['github', 'enterprise', 'team', 'license', 'developer', 'git', 'seats'],
    refundable: true,
    refundTerms: '14-day refund policy for unassigned seats',
  },
  {
    offerId: 'aws-compute-reserve-120',
    title: 'AWS Cloud compute reserve',
    merchantName: 'Amazon Web Services',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 12000,
    currency: 'USD',
    tags: ['aws', 'amazon', 'cloud', 'compute', 'reserve', 'hosting', 'server'],
    refundable: false,
    refundTerms: 'Reserved compute capacity: non-refundable once allocated',
  },
  {
    offerId: 'gpu-runpod-4h',
    title: '4 GPU hours (A10G)',
    merchantName: 'RunPod',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 7450,
    currency: 'USD',
    tags: ['gpu', 'compute', 'cloud', 'training', 'hours', 'runpod'],
    refundable: false,
    refundTerms: 'Compute hours: non-refundable once instance boots',
  },
  {
    offerId: 'gpu-vultr-4h',
    title: '4 GPU hours (A10G Cloud GPU)',
    merchantName: 'Vultr',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 7900,
    currency: 'USD',
    tags: ['gpu', 'compute', 'cloud', 'training', 'hours', 'vultr'],
    refundable: false,
    refundTerms: 'Compute hours: non-refundable once instance boots',
  },
  {
    offerId: 'gpu-aws-4h',
    title: '4 GPU hours (AWS EC2 G5)',
    merchantName: 'Amazon Web Services',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 8240,
    currency: 'USD',
    tags: ['gpu', 'compute', 'cloud', 'training', 'hours', 'aws', 'ec2'],
    refundable: false,
    refundTerms: 'Compute hours: non-refundable once instance boots',
  },
  {
    offerId: 'electronics-logitech-mx3-bestbuy',
    title: 'Logitech MX Master 3S Wireless Mouse',
    merchantName: 'Best Buy',
    merchantCategory: 'electronics',
    priceCents: 9900,
    currency: 'USD',
    tags: [
      'logitech',
      'mx',
      'master',
      '3s',
      'mouse',
      'wireless',
      'ergonomic',
      'electronics',
      'peripheral',
    ],
    refundable: true,
    refundTerms: '30-day return policy (standard PayPal Buyer Protection)',
  },
  {
    offerId: 'electronics-logitech-mx3-microcenter',
    title: 'Logitech MX Master 3S Wireless Mouse',
    merchantName: 'Micro Center',
    merchantCategory: 'electronics',
    priceCents: 8900,
    currency: 'USD',
    tags: [
      'logitech',
      'mx',
      'master',
      '3s',
      'mouse',
      'wireless',
      'ergonomic',
      'electronics',
      'peripheral',
    ],
    refundable: true,
    refundTerms: '30-day return policy (standard PayPal Buyer Protection)',
  },
  {
    offerId: 'electronics-anker-gan-65w',
    title: 'Anker 65W GaN USB-C Fast Charger',
    merchantName: 'Anker Direct',
    merchantCategory: 'electronics',
    priceCents: 2999,
    currency: 'USD',
    tags: ['anker', 'charger', 'usb', 'usbc', 'gan', 'fast', 'adapter', 'electronics', 'power'],
    refundable: true,
    refundTerms: '30-day money-back guarantee',
  },
  {
    offerId: 'electronics-keychron-k2',
    title: 'Keychron K2 Wireless Mechanical Keyboard',
    merchantName: 'Keychron',
    merchantCategory: 'electronics',
    priceCents: 7900,
    currency: 'USD',
    tags: [
      'keychron',
      'keyboard',
      'mechanical',
      'wireless',
      'k2',
      'typing',
      'electronics',
      'peripheral',
    ],
    refundable: true,
    refundTerms: '14-day return window for original packaging',
  },
  {
    offerId: 'electronics-sony-wh1000xm5',
    title: 'Sony WH-1000XM5 Noise Canceling Headphones',
    merchantName: 'Sony Store',
    merchantCategory: 'electronics',
    priceCents: 34800,
    currency: 'USD',
    tags: [
      'sony',
      'headphones',
      'noise',
      'canceling',
      'wireless',
      'audio',
      'headset',
      'electronics',
    ],
    refundable: true,
    refundTerms: '30-day return policy with pre-paid label',
  },
  {
    offerId: 'electronics-apple-macbook-pro-16',
    title: 'Apple MacBook Pro 16-inch (M3 Max)',
    merchantName: 'Apple Store',
    merchantCategory: 'electronics',
    priceCents: 249900,
    currency: 'USD',
    tags: ['apple', 'macbook', 'pro', '16', 'laptop', 'computer', 'm3', 'electronics'],
    refundable: true,
    refundTerms: '14-day standard Apple return window',
  },
  {
    offerId: 'coffee-bluebottle-espresso',
    title: 'Artisan Espresso Whole Beans, 2 lb Bag',
    merchantName: 'Blue Bottle Coffee',
    merchantCategory: 'food_and_beverage',
    priceCents: 3200,
    currency: 'USD',
    tags: ['coffee', 'beans', 'espresso', 'roast', 'whole', 'beverage', 'food', 'perishable'],
    refundable: false,
    refundTerms: 'Perishable food consumable: non-refundable once shipped',
  },
  {
    offerId: 'office-amazon-basics-wrist-rest',
    title: 'Amazon Basics Ergonomic Mouse Wrist Rest',
    merchantName: 'Amazon Basics',
    merchantCategory: 'office_supplies',
    priceCents: 1650,
    currency: 'USD',
    tags: [
      'wrist',
      'rest',
      'ergonomic',
      'mouse',
      'pad',
      'foam',
      'office',
      'supplies',
      'desk',
      'amazon',
      'basics',
    ],
    refundable: true,
    refundTerms: '30-day money-back guarantee',
  },
  {
    offerId: 'api-credits-openai-15',
    title: 'OpenAI API usage credits',
    merchantName: 'OpenAI',
    merchantCategory: 'developer_tools',
    priceCents: 1500,
    currency: 'USD',
    tags: ['api', 'credits', 'developer', 'calls', 'openai', 'gpt'],
    refundable: false,
    refundTerms: 'Digital consumable: non-refundable once provisioned',
  },
  {
    offerId: 'ci-minutes-vercel-9',
    title: 'Vercel Pro build & compute minutes, 1000',
    merchantName: 'Vercel',
    merchantCategory: 'developer_tools',
    priceCents: 900,
    currency: 'USD',
    tags: ['ci', 'build', 'minutes', 'developer', 'pipeline', 'vercel', 'deploy'],
    refundable: false,
    refundTerms: 'Build minutes: non-refundable once queued',
  },
  {
    offerId: 'dev-cloudflare-workers-20',
    title: 'Cloudflare Workers & Workers AI subscription',
    merchantName: 'Cloudflare',
    merchantCategory: 'developer_tools',
    priceCents: 2000,
    currency: 'USD',
    tags: ['cloudflare', 'workers', 'ai', 'edge', 'developer', 'serverless', 'cdn'],
    refundable: true,
    refundTerms: '30-day money-back guarantee for unused tier period',
  },
  {
    offerId: 'gpu-cluster-week',
    title: 'Dedicated GPU cluster, 1 week',
    merchantName: 'Amazon Web Services',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 90000,
    currency: 'USD',
    tags: ['gpu', 'cluster', 'compute', 'cloud', 'dedicated', 'week', 'aws'],
    refundable: false,
    refundTerms: 'Dedicated hardware reservation: non-refundable',
  },
  {
    offerId: 'ebooks-amazon-kindle',
    title: 'Kindle programming ebook bundle',
    merchantName: 'Amazon Kindle',
    merchantCategory: 'digital_goods',
    priceCents: 1800,
    currency: 'USD',
    tags: ['ebook', 'books', 'programming', 'bundle', 'reading', 'kindle', 'amazon'],
    refundable: false,
    refundTerms: 'Digital download: final sale',
  },
  {
    offerId: 'casino-luckyspin',
    title: 'Casino credits, 100 chips',
    merchantName: 'LuckySpin Casino',
    merchantCategory: 'gambling',
    priceCents: 2500,
    currency: 'USD',
    tags: ['casino', 'chips', 'credits', 'gambling', 'bet'],
    refundable: false,
    refundTerms: 'Gambling chips: strictly non-refundable',
  },
  {
    offerId: 'crypto-coinbase-100',
    title: 'Coinbase crypto token purchase, 100 USD',
    merchantName: 'Coinbase',
    merchantCategory: 'crypto_exchange',
    priceCents: 10000,
    currency: 'USD',
    tags: ['crypto', 'token', 'bitcoin', 'exchange', 'coin', 'coinbase'],
    refundable: false,
    refundTerms: 'Blockchain transaction: strictly non-refundable',
  },
];

const STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'any',
  'buy',
  'for',
  'from',
  'get',
  'i',
  'me',
  'my',
  'of',
  'on',
  'order',
  'please',
  'purchase',
  'the',
  'to',
  'want',
  'with',
]);

function stem(token: string): string {
  return token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
    .map(stem);
}

function offerTokens(offer: CatalogOffer): Set<string> {
  return new Set([
    ...offer.tags.map(stem),
    ...tokenize(offer.title),
    ...tokenize(offer.merchantName),
    ...tokenize(offer.merchantCategory.replace(/_/g, ' ')),
  ]);
}

interface ScoredOffer {
  offer: CatalogOffer;
  score: number;
}

function scoreOffers(query: string): ScoredOffer[] {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return [];

  return MERCHANT_CATALOG.map((offer) => {
    const tokens = offerTokens(offer);
    let score = 0;
    for (const token of queryTokens) {
      if (tokens.has(token)) score += 1;
    }
    return { offer, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.offer.priceCents - b.offer.priceCents);
}

/** Returns catalog offers that match the query, best match first, then cheapest. */
export function searchOffers(query: string, limit = 5): CatalogOffer[] {
  return scoreOffers(query)
    .slice(0, limit)
    .map((entry) => entry.offer);
}

/** Looks up an offer by id. Returns undefined when the id is not in the catalog. */
export function getOfferById(offerId: string): CatalogOffer | undefined {
  return MERCHANT_CATALOG.find((offer) => offer.offerId === offerId);
}

/**
 * Deterministic selection used when no model is available: among the best
 * matching offers, pick the cheapest. Returns undefined when nothing matches.
 */
export function selectCheapestMatchingOffer(query: string): CatalogOffer | undefined {
  const scored = scoreOffers(query);
  const best = scored[0];
  if (!best) return undefined;

  return scored
    .filter((entry) => entry.score === best.score)
    .map((entry) => entry.offer)
    .sort((a, b) => a.priceCents - b.priceCents)[0];
}

export interface PriceComparison {
  matchedCount: number;
  chosenOffer: CatalogOffer;
  cheapestPriceCents: number;
  highestPriceCents: number;
  savingsCents: number;
  alternatives: Array<{ merchantName: string; priceCents: number }>;
  summary: string;
}

/**
 * Compares competing merchant offers matching a prompt and calculates savings against alternatives.
 */
export function compareMatchingOffers(
  query: string,
  chosenOffer: CatalogOffer,
): PriceComparison | null {
  const scored = scoreOffers(query);
  const best = scored[0];
  if (!best) return null;

  const topOffers = scored
    .filter((entry) => entry.score === best.score)
    .map((entry) => entry.offer);

  if (topOffers.length <= 1) return null;

  const sortedByPrice = [...topOffers].sort((a, b) => a.priceCents - b.priceCents);
  const cheapest = sortedByPrice[0]!;
  const mostExpensive = sortedByPrice[sortedByPrice.length - 1]!;
  const savings = mostExpensive.priceCents - chosenOffer.priceCents;

  const alternatives = sortedByPrice
    .filter((o) => o.offerId !== chosenOffer.offerId)
    .map((o) => ({ merchantName: o.merchantName, priceCents: o.priceCents }));

  const chosenPrice = `$${(chosenOffer.priceCents / 100).toFixed(2)}`;
  const savingsFormatted = `$${(savings / 100).toFixed(2)}`;

  const altList = alternatives
    .map((a) => `${a.merchantName} ($${(a.priceCents / 100).toFixed(2)})`)
    .join(', ');

  const summary =
    savings > 0
      ? `Found ${topOffers.length} competing merchants. Selected ${chosenOffer.merchantName} at ${chosenPrice} (vs ${altList}), saving ${savingsFormatted}.`
      : `Found ${topOffers.length} merchants offering comparable services. Selected ${chosenOffer.merchantName} at ${chosenPrice}.`;

  return {
    matchedCount: topOffers.length,
    chosenOffer,
    cheapestPriceCents: cheapest.priceCents,
    highestPriceCents: mostExpensive.priceCents,
    savingsCents: Math.max(0, savings),
    alternatives,
    summary,
  };
}
