CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
DROP TABLE "project_sync_state" CASCADE;--> statement-breakpoint
DROP TABLE "sync_jobs" CASCADE;--> statement-breakpoint
ALTER TABLE "commit_chunks" ADD COLUMN "diff_patch" text;--> statement-breakpoint
DROP TYPE "public"."sync_job_status";