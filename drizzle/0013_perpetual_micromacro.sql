CREATE TABLE "signal_advisory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"rubric_kind" text NOT NULL,
	"score" smallint,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signal_advisory_signal_id_unique" UNIQUE("signal_id")
);
--> statement-breakpoint
ALTER TABLE "signal_advisory" ADD CONSTRAINT "signal_advisory_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE restrict ON UPDATE no action;