CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
DROP INDEX IF EXISTS "commit_embedding_hnsw_idx";--> statement-breakpoint
UPDATE "commit_chunks" SET "embedding" = NULL, "embedding_hash" = NULL WHERE "embedding" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "commit_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(512);--> statement-breakpoint
CREATE INDEX "commit_embedding_hnsw_idx" ON "commit_chunks" USING hnsw ("embedding" vector_cosine_ops);
