ALTER TABLE "prospects" ALTER COLUMN "signal_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "origin" text DEFAULT 'signal' NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_origin_chk" CHECK (("prospects"."origin" <> 'signal' OR "prospects"."signal_id" IS NOT NULL) AND ("prospects"."origin" <> 'manual' OR ("prospects"."signal_id" IS NULL AND "prospects"."name" IS NOT NULL)));