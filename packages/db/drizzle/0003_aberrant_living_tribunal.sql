CREATE TABLE "webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paypal_webhook_id" text,
	"transmission_id" text NOT NULL,
	"event_type" text NOT NULL,
	"resource_type" text NOT NULL,
	"summary" text,
	"status" text DEFAULT 'received' NOT NULL,
	"raw_headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_event_transmission_id_unique" UNIQUE("transmission_id")
);
--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "refunded_amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "webhook_event_transmission_id_idx" ON "webhook_event" USING btree ("transmission_id");--> statement-breakpoint
CREATE INDEX "webhook_event_event_type_idx" ON "webhook_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "webhook_event_status_idx" ON "webhook_event" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_event_created_at_idx" ON "webhook_event" USING btree ("created_at");