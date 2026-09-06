import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default("postgres://scrapecat:scrapecat@localhost:5432/scrapecat"),
  OPENROUTER_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default("openai/gpt-5.6-luna"),
  DEEPSEEK_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  GITHUB_TOKEN: z.string().default(""),
  GIT_PROVIDER: z.enum(["github", "gitlab"]).default("github"),
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required (use: openssl rand -base64 32)"),
  EMBEDDING_MODEL: z.string().default("openai/text-embedding-3-small"),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  EMBEDDING_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  REPO_ARCHIVE_DIR: z.string().default("repos"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const missing: string[] = [];
if (!parsed.data.OPENROUTER_API_KEY) missing.push("OPENROUTER_API_KEY");
if (!parsed.data.GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
if (missing.length > 0) {
  console.warn(`Warning: missing environment variables — ${missing.join(", ")}`);
}

export const env = parsed.data;
