CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"type" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"provider" text NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_person_idx" ON "messages" USING btree ("person_id");