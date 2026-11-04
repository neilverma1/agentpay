# AgentPay

> **Programmable spend guardrails and human-in-the-loop controls for autonomous AI agents.**  
> Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

---

## The Problem

In the era of autonomous AI agents, agents can browse the web, write code, and negotiate services. However, giving an AI direct access to real money creates a major dilemma:

- **Unrestricted access:** Risk of hallucinations, prompt injection, and drained bank accounts.
- **Manual checkout every time:** Destroys autonomy and turns an autonomous agent back into a basic search engine.

---

## The Solution

**AgentPay** bridges the trust gap between autonomous AI agents and PayPal by introducing a programmable safety protocol:

1. **Autonomous Micro-Purchases:** Agent executes transactions under a safe threshold (e.g., <$25 for domain renewals, cloud compute top-ups) autonomously via the PayPal Orders API.
2. **Progressive Human-in-the-Loop (HitL):** Transactions exceeding budget limits or touching sensitive categories pause execution and trigger instant 1-click approval prompts.
3. **Semantic Policy Engine:** Enforces natural-language category restrictions (e.g., _only developer tooling and infrastructure_) alongside hard daily spending caps.
4. **Real-Time Telemetry & Kill Switch:** Interactive audit trail of agent reasoning, merchant details, PayPal transaction IDs, and an emergency wallet freeze button.
5. **Cryptographic Webhook Verification:** Verifies PayPal webhook events server-side to guarantee state consistency and fraud prevention.

---

## License

[MIT](LICENSE)
