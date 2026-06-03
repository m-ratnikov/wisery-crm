CREATE TYPE "public"."draft_status" AS ENUM('generated', 'selected', 'archived');--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"channel" text DEFAULT 'linkedin' NOT NULL,
	"body" text NOT NULL,
	"status" "draft_status" DEFAULT 'selected' NOT NULL,
	"provider" text NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_profile_id_user_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profile"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drafts_prospect_idx" ON "drafts" USING btree ("prospect_id");