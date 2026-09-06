CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "commit_chunks" DROP COLUMN "diff_summary";--> statement-breakpoint
ALTER TABLE "commit_chunks" DROP COLUMN "diff_patch";