CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"report_provider" text DEFAULT 'openrouter' NOT NULL,
	"report_model" text DEFAULT 'nvidia/nemotron-3-ultra-550b-a55b:free' NOT NULL,
	"embedding_provider" text DEFAULT 'openrouter' NOT NULL,
	"embedding_model" text DEFAULT 'openai/text-embedding-3-small' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
