CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "report_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"phase" text,
	"commit_count" integer DEFAULT 0 NOT NULL,
	"progress" text,
	"error" jsonb,
	"data" jsonb NOT NULL,
	"project_id" uuid,
	"report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
