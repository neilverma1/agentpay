CREATE TABLE "agent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"model" text DEFAULT 'gemini-2.5-flash' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"max_daily_spend_cents" integer NOT NULL,
	"single_transaction_limit_cents" integer NOT NULL,
	"require_approval_above_cents" integer NOT NULL,
	"allowed_merchant_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocked_merchant_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_policy_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "approval_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_intent_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"reviewer_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"rule_triggered" text NOT NULL,
	"trigger_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_request_purchase_intent_id_unique" UNIQUE("purchase_intent_id")
);
--> statement-breakpoint
CREATE TABLE "purchase_intent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"prompt" text NOT NULL,
	"item_description" text NOT NULL,
	"merchant_name" text NOT NULL,
	"merchant_category" text,
	"estimated_amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reasoning_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_intent_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_intent_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"paypal_order_id" text,
	"paypal_capture_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"payment_method" text DEFAULT 'paypal' NOT NULL,
	"raw_paypal_response" jsonb,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_purchase_intent_id_unique" UNIQUE("purchase_intent_id"),
	CONSTRAINT "transaction_paypal_order_id_unique" UNIQUE("paypal_order_id"),
	CONSTRAINT "transaction_paypal_capture_id_unique" UNIQUE("paypal_capture_id")
);
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_policy" ADD CONSTRAINT "agent_policy_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_purchase_intent_id_purchase_intent_id_fk" FOREIGN KEY ("purchase_intent_id") REFERENCES "public"."purchase_intent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_intent" ADD CONSTRAINT "purchase_intent_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_intent" ADD CONSTRAINT "purchase_intent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_purchase_intent_id_purchase_intent_id_fk" FOREIGN KEY ("purchase_intent_id") REFERENCES "public"."purchase_intent"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_user_id_idx" ON "agent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_status_idx" ON "agent" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_policy_agent_id_idx" ON "agent_policy" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "approval_request_purchase_intent_id_idx" ON "approval_request" USING btree ("purchase_intent_id");--> statement-breakpoint
CREATE INDEX "approval_request_agent_id_idx" ON "approval_request" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "approval_request_status_idx" ON "approval_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_intent_agent_id_idx" ON "purchase_intent" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "purchase_intent_user_id_idx" ON "purchase_intent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "purchase_intent_status_idx" ON "purchase_intent" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_intent_created_at_idx" ON "purchase_intent" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transaction_agent_id_idx" ON "transaction" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "transaction_created_at_idx" ON "transaction" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transaction_paypal_order_id_idx" ON "transaction" USING btree ("paypal_order_id");