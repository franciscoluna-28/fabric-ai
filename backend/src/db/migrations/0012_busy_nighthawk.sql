CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "projects" ALTER COLUMN "provider_project_id" SET DATA TYPE text;