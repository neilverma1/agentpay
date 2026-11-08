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
  },
  {
    offerId: 'figma-pro-seat-45',
    title: 'Figma Pro seat subscription',
    merchantName: 'Figma',
    merchantCategory: 'software_licenses',
    priceCents: 4500,
    currency: 'USD',
    tags: ['figma', 'design', 'seat', 'subscription', 'pro'],
  },
  {
    offerId: 'github-enterprise-license-85',
    title: 'GitHub Enterprise Team license',
    merchantName: 'GitHub',
    merchantCategory: 'developer_tools',
    priceCents: 8500,
    currency: 'USD',
    tags: ['github', 'enterprise', 'team', 'license', 'developer', 'git'],
  },
  {
    offerId: 'aws-compute-reserve-120',
    title: 'AWS Cloud compute reserve',
    merchantName: 'Amazon Web Services',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 12000,
    currency: 'USD',
    tags: ['aws', 'amazon', 'cloud', 'compute', 'reserve', 'hosting', 'server'],
  },
  {
    offerId: 'gpu-nimbus-4h',
    title: '4 GPU hours (A10G)',
    merchantName: 'CloudNimbus',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 7450,
    currency: 'USD',
    tags: ['gpu', 'compute', 'cloud', 'training', 'hours'],
  },
  {
    offerId: 'gpu-stratus-4h',
    title: '4 GPU hours (A10G)',
    merchantName: 'Stratus Compute',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 7900,
    currency: 'USD',
    tags: ['gpu', 'compute', 'cloud', 'training', 'hours'],
  },
  {
    offerId: 'gpu-cumulus-4h',
    title: '4 GPU hours (A10G)',
    merchantName: 'Cumulus GPU Cloud',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 8240,
    currency: 'USD',
    tags: ['gpu', 'compute', 'cloud', 'training', 'hours'],
  },
  {
    offerId: 'gpu-cluster-week',
    title: 'Dedicated GPU cluster, 1 week',
    merchantName: 'Cumulus GPU Cloud',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 90000,
    currency: 'USD',
    tags: ['gpu', 'cluster', 'compute', 'cloud', 'dedicated', 'week'],
  },
  {
    offerId: 'vm-nimbus-month',
    title: 'Small virtual machine, 1 month',
    merchantName: 'CloudNimbus',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 1200,
    currency: 'USD',
    tags: ['vm', 'server', 'cloud', 'hosting', 'month'],
  },
  {
    offerId: 'hosting-stratus-month',
    title: 'Static site hosting, 1 month',
    merchantName: 'Stratus Compute',
    merchantCategory: 'cloud_infrastructure',
    priceCents: 500,
    currency: 'USD',
    tags: ['hosting', 'website', 'static', 'cloud', 'month'],
  },
  {
    offerId: 'api-credits-codepipe',
    title: 'API credits, 10k calls',
    merchantName: 'CodePipe',
    merchantCategory: 'developer_tools',
    priceCents: 1500,
    currency: 'USD',
    tags: ['api', 'credits', 'developer', 'calls'],
  },
  {
    offerId: 'ci-minutes-buildly',
    title: 'CI build minutes, 1000',
    merchantName: 'Buildly',
    merchantCategory: 'developer_tools',
    priceCents: 900,
    currency: 'USD',
    tags: ['ci', 'build', 'minutes', 'developer', 'pipeline'],
  },
  {
    offerId: 'editor-pixelforge-year',
    title: 'Design editor license, 1 year',
    merchantName: 'PixelForge',
    merchantCategory: 'software_licenses',
    priceCents: 4900,
    currency: 'USD',
    tags: ['design', 'editor', 'software', 'license', 'subscription', 'year'],
  },
  {
    offerId: 'notes-notely-year',
    title: 'Notes app subscription, 1 year',
    merchantName: 'Notely',
    merchantCategory: 'software_licenses',
    priceCents: 2400,
    currency: 'USD',
    tags: ['notes', 'software', 'license', 'subscription', 'year'],
  },
  {
    offerId: 'ebooks-pageturn',
    title: 'Programming ebook bundle',
    merchantName: 'PageTurn',
    merchantCategory: 'digital_goods',
    priceCents: 1800,
    currency: 'USD',
    tags: ['ebook', 'books', 'programming', 'bundle', 'reading'],
  },
  {
    offerId: 'casino-luckyspin',
    title: 'Casino credits, 100 chips',
    merchantName: 'LuckySpin Casino',
    merchantCategory: 'gambling',
    priceCents: 2500,
    currency: 'USD',
    tags: ['casino', 'chips', 'credits', 'gambling', 'bet'],
  },
  {
    offerId: 'crypto-coinhub-100',
    title: 'Crypto token purchase, 100 USD',
    merchantName: 'CoinHub Exchange',
    merchantCategory: 'crypto_exchange',
    priceCents: 10000,
    currency: 'USD',
    tags: ['crypto', 'token', 'bitcoin', 'exchange', 'coin'],
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
