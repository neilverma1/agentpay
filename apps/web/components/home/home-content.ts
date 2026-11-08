export const LOOP_STEPS = [
  {
    title: 'The agent finds an offer',
    body: 'The agent searches the merchant catalog and selects an offerId. Price and category come from the catalog, not the model.',
  },
  {
    title: 'Deterministic guardrails',
    body: 'Daily caps, single-item ceilings, category blocks, and approval thresholds evaluate in code before any payment is initiated.',
  },
  {
    title: 'Capture or human approval',
    body: 'Under the threshold, PayPal captures the sandbox order. Over it, the agent pauses in-thread until you approve or reject.',
  },
] as const;

export const FEATURES = [
  {
    title: 'Code-enforced guardrails',
    body: 'Set strict approval thresholds, 24-hour daily spend caps, and blocked merchant categories (gambling, crypto). A prompt-injected agent cannot bypass code.',
  },
  {
    title: 'In-thread human approval',
    body: 'Over-threshold purchases pause the agent cleanly and wait for your decision via desktop dialogs or mobile sheets before capturing via PayPal.',
  },
  {
    title: 'Cryptographic audit ledger',
    body: 'Every reasoning step, policy check, and PayPal webhook signature is recorded with monospace tabular figures and real-time state telemetry.',
  },
] as const;
