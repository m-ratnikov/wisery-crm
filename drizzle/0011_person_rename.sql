ALTER TABLE "prospects" RENAME TO "person";--> statement-breakpoint
ALTER TABLE "person" RENAME CONSTRAINT "prospects_origin_chk" TO "person_origin_chk";--> statement-breakpoint
ALTER TABLE "person" RENAME CONSTRAINT "prospects_signal_id_signals_id_fk" TO "person_signal_id_signals_id_fk";--> statement-breakpoint
ALTER TABLE "person" RENAME CONSTRAINT "prospects_company_id_companies_id_fk" TO "person_company_id_companies_id_fk";--> statement-breakpoint
ALTER INDEX "prospects_signal_idx" RENAME TO "person_signal_idx";--> statement-breakpoint
ALTER INDEX "prospects_company_idx" RENAME TO "person_company_idx";--> statement-breakpoint
ALTER TABLE "scorings" RENAME COLUMN "prospect_id" TO "person_id";--> statement-breakpoint
ALTER TABLE "scorings" RENAME CONSTRAINT "scorings_prospect_id_prospects_id_fk" TO "scorings_person_id_person_id_fk";--> statement-breakpoint
ALTER INDEX "scorings_prospect_idx" RENAME TO "scorings_person_idx";--> statement-breakpoint
ALTER TABLE "drafts" RENAME COLUMN "prospect_id" TO "person_id";--> statement-breakpoint
ALTER TABLE "drafts" RENAME CONSTRAINT "drafts_prospect_id_prospects_id_fk" TO "drafts_person_id_person_id_fk";--> statement-breakpoint
ALTER INDEX "drafts_prospect_idx" RENAME TO "drafts_person_idx";--> statement-breakpoint
ALTER TABLE "dossiers" RENAME COLUMN "prospect_id" TO "person_id";--> statement-breakpoint
ALTER TABLE "dossiers" RENAME CONSTRAINT "dossiers_prospect_id_prospects_id_fk" TO "dossiers_person_id_person_id_fk";--> statement-breakpoint
ALTER INDEX "dossiers_prospect_uq" RENAME TO "dossiers_person_uq";--> statement-breakpoint
ALTER TABLE "outcomes" RENAME COLUMN "prospect_id" TO "person_id";--> statement-breakpoint
ALTER TABLE "outcomes" RENAME CONSTRAINT "outcomes_prospect_id_prospects_id_fk" TO "outcomes_person_id_person_id_fk";--> statement-breakpoint
ALTER INDEX "outcomes_prospect_idx" RENAME TO "outcomes_person_idx";
