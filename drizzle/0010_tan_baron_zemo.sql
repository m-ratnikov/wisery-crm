CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid,
	"name" text NOT NULL,
	"domain" text,
	"linkedin_url" text,
	"firmographics" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"disposition" text NOT NULL,
	"created_entity_id" uuid,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signal_decisions_signal_id_unique" UNIQUE("signal_id")
);
--> statement-breakpoint
DROP INDEX "rubric_one_active_uq";--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "type" text DEFAULT 'prospect' NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "monitored" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "rubric" ADD COLUMN "kind" text DEFAULT 'icp' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_decisions" ADD CONSTRAINT "signal_decisions_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospects_company_idx" ON "prospects" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rubric_one_active_uq" ON "rubric" USING btree ("kind") WHERE "rubric"."active";