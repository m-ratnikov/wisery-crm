CREATE TABLE "pipeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pipeline_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "pipeline_id" uuid;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "status_id" uuid;--> statement-breakpoint
ALTER TABLE "pipeline_status" ADD CONSTRAINT "pipeline_status_pipeline_id_pipeline_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipeline"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_status_pipeline_id_uq" ON "pipeline_status" USING btree ("pipeline_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_status_position_uq" ON "pipeline_status" USING btree ("pipeline_id","position");--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_pipeline_id_pipeline_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipeline"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_pipeline_status_fk" FOREIGN KEY ("pipeline_id","status_id") REFERENCES "public"."pipeline_status"("pipeline_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
INSERT INTO "pipeline" ("name","slug","is_default") VALUES ('LinkedIn outreach','linkedin-outreach',true) ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "pipeline_status" ("pipeline_id","name","position")
SELECT p.id, s.name, s.position FROM "pipeline" p,
  (VALUES ('Cold',0),('CR Sent',1),('CR Accepted',2),('FU Sent',3),('Conversation',4),('Discovery call',5),('Not Interested',6),('Ghosted',7),('Proposal Sent',8),('On Hold',9)) AS s(name,position)
WHERE p.slug='linkedin-outreach'
ON CONFLICT ("pipeline_id","position") DO NOTHING;--> statement-breakpoint
UPDATE "person" SET
  "pipeline_id" = (SELECT id FROM "pipeline" WHERE slug='linkedin-outreach'),
  "status_id" = (SELECT ps.id FROM "pipeline_status" ps JOIN "pipeline" p ON ps.pipeline_id=p.id WHERE p.slug='linkedin-outreach' AND ps.name='Cold')
WHERE "pipeline_id" IS NULL;