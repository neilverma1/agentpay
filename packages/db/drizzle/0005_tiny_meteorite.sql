CREATE TABLE "paypal_vault" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"vault_id" text NOT NULL,
	"paypal_customer_id" text,
	"payer_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paypal_vault_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "paypal_vault" ADD CONSTRAINT "paypal_vault_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paypal_vault_user_id_idx" ON "paypal_vault" USING btree ("user_id");