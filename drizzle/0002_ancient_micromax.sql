CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scorings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"rubric_id" uuid NOT NULL,
	"score" smallint NOT NULL,
	"reason" text,
	"summary" text,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorings" ADD CONSTRAINT "scorings_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorings" ADD CONSTRAINT "scorings_rubric_id_rubric_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubric"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospects_signal_idx" ON "prospects" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "scorings_prospect_idx" ON "scorings" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "scorings_rubric_idx" ON "scorings" USING btree ("rubric_id");