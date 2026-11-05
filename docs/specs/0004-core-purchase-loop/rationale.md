# Rationale: 0004. Core purchase loop

## Context

Autonomous agent commerce requires software agents to execute financial transactions on behalf of users without manual intervention for routine purchases. Traditional checkout experiences rely on human redirection through browser dialogs, two factor authentication screens, and interactive approval flows. For an autonomous agent protocol, payment execution must occur server to server while remaining safe, auditable, and bounded.

This feature represents the first vertical slice in AgentPay. We need a dependable mechanism to test whether an autonomous agent can receive a user prompt, interpret the purchase intent, create a valid payment order with PayPal, execute the capture step in sandbox, and record the outcome in our database. Without this slice, higher level governance features like policy enforcement, budget caps, and multi agent coordination would operate on simulated state rather than real payment rails.

## Options considered

### Option 1: Direct server side Orders v2 create and capture with Vercel AI SDK tool calling

The application uses `@paypal/paypal-server-sdk` configured with developer credentials to call PayPal Orders API v2 directly. When a user enters a purchase prompt, the Gemini model runs via Vercel AI SDK, decides whether to buy the requested asset, invokes a local tool with structured parameters, and executes order creation followed immediately by capture. Transaction identifiers and reasoning logs are persisted to PostgreSQL with Drizzle ORM.

**Pros**:

- Connects directly to official PayPal sandbox APIs with zero simulated shortcuts.
- Minimal moving parts, allowing rapid Tracer Bullet validation of the complete stack.
- Naturally captures both LLM reasoning steps and provider response payloads in the audit database.

**Cons**:

- Requires valid PayPal developer credentials in the local environment.
- Bypasses customer interactive authorization, which works in sandbox but requires vaulting or pre approved billing in live production.

### Option 2: Pre approved customer billing agreements with Vault tokens

The buyer agent links to a customer wallet through a pre approved PayPal Billing Agreement or Vault payment token. During execution, the server charges the vaulted token rather than creating a standalone sandbox order.

**Pros**:

- Matches production consumer authorization models where users grant recurring spending allowances to agents.
- Provides stronger payment method permanence across multiple sessions.

**Cons**:

- Introduces significant setup complexity, including vault token generation, buyer consent redirects, and payment method lifecycle management before the core loop is proven.
- Unnecessary for validating the initial sandbox tracer bullet slice.

### Option 3: Local mock payment simulator

A simulated PayPal service implements the Orders API interface in memory or through local JSON endpoints, returning fake capture identifiers without communicating with PayPal servers.

**Pros**:

- Allows offline development without network access or sandbox credentials.
- Instant test execution with predictable responses.

**Cons**:

- Fails to prove real integration with PayPal SDK types, network error handling, or credential authentication.
- Risks hiding integration bugs until late in the hackathon timeline.

## Rationale

We chose Option 1 because it achieves the thinnest complete thread through our chosen stack while testing real PayPal sandbox infrastructure. Option 3 creates an illusion of progress that leaves external API risks unaddressed. Option 2 introduces customer vault onboarding workflows that belong in later phases after basic agent order creation and capture work reliably. Option 1 gives the team an authentic end to end payment foundation that subsequent slices for guardrails, webhooks, and telemetry can build upon directly.
