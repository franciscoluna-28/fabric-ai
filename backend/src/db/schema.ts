import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const AVAILABLE_CREDENTIAL_PROVIDERS = [
  "openai",
  "openrouter",
  "deepseek",
  "github",
  "gitlab",
] as const;

const credentialProviderEnum = pgEnum(
  "credential_provider",
  AVAILABLE_CREDENTIAL_PROVIDERS,
);

const AVAILABLE_GIT_PROVIDERS = ["github", "gitlab"] as const;

const gitProviderEnum = pgEnum("git_provider", AVAILABLE_GIT_PROVIDERS);

export type GitProvider = (typeof gitProviderEnum)["enumValues"][number];

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(512)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`; 
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
});

export type CommitChunkMetadata = {
  filesChanged?: string[];
  fileStats?: {
    filepath: string;
    status: "added" | "deleted" | "modified";
    additions: number;
    deletions: number;
  }[];
  additions?: number;
  deletions?: number;
  commitUrl?: string;
  prNumber?: number;
  prTitle?: string;
  prUrl?: string;
  summary?: { model?: string; at?: string };
  validation?: {
    status?: "confirmed" | "flagged" | "skipped";
    notes?: string[];
  };
};

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gitProvider: gitProviderEnum("git_provider").default("github").notNull(),
    providerProjectId: text("provider_project_id").notNull(),
    providerOwner: text("provider_owner").default("").notNull(),
    repositoryName: text("repository_name").notNull(),
    defaultBranch: text("default_branch").default("main").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // The same external id can exist across providers (GitHub 123 vs GitLab 123).
    providerExternalIdIdx: uniqueIndex("projects_git_provider_project_id_idx").on(
      table.gitProvider,
      table.providerProjectId,
    ),
  }),
);

export const commitChunks = pgTable(
  "commit_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    commitSha: text("commit_sha").notNull(),
    branch: text("branch").notNull().default("main"),
    commitMessage: text("commit_message").notNull(),
    author: text("author"),
    embedding: vector("embedding"),
    contentHash: text("content_hash"),
    embeddingHash: text("embedding_hash"),
    metadata: jsonb("metadata")
      .$type<CommitChunkMetadata>()
      .default({}),
    committedAt: timestamp("committed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      projectShaIdx: uniqueIndex("commit_project_sha_branch_idx").on(
        table.projectId,
        table.commitSha,
        table.branch,
      ),
      embeddingIdx: index("commit_embedding_hnsw_idx").using(
        "hnsw",
        table.embedding.op("vector_cosine_ops"),
      ),
    };
  },
);

export const reportJobs = pgTable("report_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: text("status").notNull().default("queued"),
  phase: text("phase"),
  commitCount: integer("commit_count").notNull().default(0),
  progress: text("progress"),
  error: jsonb("error").$type<{ message: string; status: number } | null>(),
  data: jsonb("data").notNull(),
  projectId: uuid("project_id"),
  reportId: uuid("report_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  sessionId: uuid("session_id")
    .references(() => chatSessions.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  originalMarkdown: text("original_markdown").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  branch: text("branch").notNull(),
  customInstructions: text("custom_instructions"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reportCommits = pgTable(
  "report_commits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .references(() => reports.id, { onDelete: "cascade" })
      .notNull(),
    commitSha: text("commit_sha").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    reportCommitUnique: uniqueIndex("report_commit_unique_idx").on(
      table.reportId,
      table.commitSha,
    ),
    reportIdIdx: index("report_commits_report_id_idx").on(table.reportId),
  }),
);

export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: credentialProviderEnum("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    keyHint: text("key_hint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerUnique: uniqueIndex("credentials_provider_unique").on(table.provider),
  }),
);

export type ChatCitation = {
  commitSha: string;
  commitMessage: string;
  author: string | null;
  committedAt: string;
  filesChanged: string[];
  commitUrl: string | null;
};

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").default("New chat").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("chat_sessions_project_id_idx").on(table.projectId),
  }),
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .references(() => chatSessions.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    branch: text("branch"),
    citations: jsonb("citations")
      .$type<ChatCitation[]>()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index("chat_messages_session_id_idx").on(table.sessionId),
  }),
);

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  reportProvider: text("report_provider").default("openrouter").notNull(),
  reportModel: text("report_model").default("nvidia/nemotron-3-ultra-550b-a55b:free").notNull(),
  embeddingProvider: text("embedding_provider").default("openrouter").notNull(),
  embeddingModel: text("embedding_model").default("openai/text-embedding-3-small").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CredentialProvider = (typeof credentialProviderEnum)["enumValues"][number];
