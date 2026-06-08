ALTER TABLE "person" ALTER COLUMN "pipeline_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ALTER COLUMN "status_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "person" DROP COLUMN "status";