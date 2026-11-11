/**
 * Copy and scripted demo data for the marketing homepage.
 * Amounts are integer cents so formatting stays exact (see `formatUsd`).
 */

export type Outcome = 'captured' | 'pending' | 'blocked';

export type DecisionEvent = {
  id: string;
  agent: string;
  item: string;
  amountCents: number;
  rule: string;
  outcome: Outcome;
};

/** Mirrors `DEFAULT_POLICY_CONFIG` in packages/agent/src/policy.ts. */
export const DEMO_POLICY = {
  maxDailySpendCents: 50000,
  singleTransactionLimitCents: 50000,
  requireApprovalAboveCents: 5000,
  spentLast24HoursCents: 31240,
  blockedMerchantCategories: ['gambling', 'adult_content', 'weapons', 'crypto_exchange'],
} as const;

export const DECISION_EVENTS: readonly DecisionEvent[] = [
  {
    id: 'evt-1',
    agent: 'Research agent',
    item: 'API credits, 10k requests',
    amountCents: 1900,
    rule: 'Under the $50.00 approval threshold',
    outcome: 'captured',
  },
  {
    id: 'evt-2',
    agent: 'Procurement agent',
    item: '4 GPU hours',
    amountCents: 7450,
    rule: 'Over the $50.00 approval threshold',
    outcome: 'pending',
  },
  {
    id: 'evt-3',
    agent: 'Shopping agent',
    item: 'Sports betting credit',
    amountCents: 2500,
    rule: 'Category gambling is blocked',
    outcome: 'blocked',
  },
  {
    id: 'evt-4',
    agent: 'Travel agent',
    item: 'Airport lounge pass',
    amountCents: 3200,
    rule: 'Under the $50.00 approval threshold',
    outcome: 'captured',
  },
  {
    id: 'evt-5',
    agent: 'Procurement agent',
    item: 'Annual design tool seat',
    amountCents: 62000,
    rule: 'Over the $500.00 single purchase ceiling',
    outcome: 'blocked',
  },
  {
    id: 'evt-6',
    agent: 'Research agent',
    item: 'Dataset license',
    amountCents: 4800,
    rule: 'Under the $50.00 approval threshold',
    outcome: 'captured',
  },
] as const;

export const BUILT_ON = [
  'PayPal Orders & Vault',
  'Model Context Protocol',
  'Vercel AI SDK',
  'Google Gemini',
  'Drizzle ORM',
  'PostgreSQL',
] as const;

export const LOOP_STEPS = [
  {
    title: 'The agent picks an offer',
    body: 'It searches a trusted merchant catalog and chooses an offer. Price and category come from the catalog, never from the model, so a prompt cannot change them.',
  },
  {
    title: 'Your policy runs in code',
    body: 'The daily cap, single purchase ceiling, blocked categories and approval threshold are checked before any PayPal order exists.',
  },
  {
    title: 'PayPal captures, or you decide',
    body: 'Under the threshold, the order is captured in the PayPal sandbox. Over it, the agent pauses in the chat until you approve or reject.',
  },
] as const;

export const AUDIT_ROWS = [
  { time: '14:02:11', agent: 'Research agent', amountCents: 1900, outcome: 'captured' },
  { time: '14:05:47', agent: 'Procurement agent', amountCents: 7450, outcome: 'pending' },
  { time: '14:06:03', agent: 'Shopping agent', amountCents: 2500, outcome: 'blocked' },
  { time: '14:09:30', agent: 'Travel agent', amountCents: 3200, outcome: 'captured' },
] as const satisfies readonly {
  time: string;
  agent: string;
  amountCents: number;
  outcome: Outcome;
}[];

export const FAQS = [
  {
    id: 'money',
    question: 'Does any real money move?',
    answer:
      'No. AgentPay runs against the PayPal sandbox. Orders, captures and webhooks are real API calls, but they use sandbox accounts.',
  },
  {
    id: 'injection',
    question: 'What if the agent is prompt-injected?',
    answer:
      'The model can only choose an offer from the catalog. Price, category and every limit are checked in code on the server, so persuading the model does not change what gets paid.',
  },
  {
    id: 'approval',
    question: 'How do I approve a purchase?',
    answer:
      'Over-threshold purchases appear in the chat thread with Approve and Reject buttons. Approving captures the PayPal order; rejecting cancels it and the agent continues without it.',
  },
  {
    id: 'limits',
    question: 'Which limits can I set?',
    answer:
      'A rolling 24-hour spending cap, a single purchase ceiling, an approval threshold, blocked merchant categories, and an option to require approval for non-refundable items.',
  },
  {
    id: 'audit',
    question: 'What gets recorded?',
    answer:
      'Every policy decision, approval and PayPal webhook is written to the audit log with the rule that applied, so you can see why each purchase was allowed or stopped.',
  },
] as const;
