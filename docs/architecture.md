```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Tier                      │
│              Next.js 16 (React 19)                      │
│         TanStack Query · Tailwind · shadcn/ui           │
├─────────────────────────────────────────────────────────┤
│                    API Tier                              │
│            Fastify 5 · TypeBox · OpenAPI                │
│          Request validation · CORS · Swagger            │
├─────────────────────────────────────────────────────────┤
│                   Data Tier                              │
│     PostgreSQL + pgvector (projects, commits, reports)   │
│     Drizzle ORM · postgres-js driver                     │
│     Store layer per domain (src/projects/stores/, …)     │
│     isomorphic-git · local repo archives (repos/)        │
│     Octokit (GitHub REST API — discovery only)          │
│     ──[future]──── GitLab · Bitbucket                    │
└─────────────────────────────────────────────────────────┘
```

## RAG (Vectors: partial, semantic search not shipped)

The commit corpus and embedding pipeline are real; semantic search over it is **not shipped yet**:

- `commit_chunks.commit_message` is the **embedding source** (commit/PR review, not code review — the message is the unit of meaning). `metadata` carries `files_changed` and `validation.status` (`confirmed`/`flagged`/`skipped`) + `notes` from the free rule guardrail.
- `content_hash` (SHA-256 of the message) and `embedding_hash` gate re-embedding: a row's embedding is current iff `embedding_hash = content_hash`. `embedding vector(512)` + the HNSW index (`commit_embedding_hnsw_idx`) are populated by the non-blocking `embedNewChunks()` (OpenRouter, `openai/text-embedding-3-small`, 512 dims) invoked after report generation, plus the `embed:backfill` script for one-time catch-up. If no OpenRouter key is available ingestion degrades gracefully and the backfill catches up later.
- There is no semantic-search endpoint (`cosineDistance` over the HNSW index is the planned path) and no prompt-enrichment/retrieval in report generation yet.

The full strategy (why, corpus shape, cost/reliability properties) is documented in [`docs/embeddings.md`](embeddings.md).

## Commit ingestion (batch, archive-based)

Commit ingestion is **synchronous, batch, and local**. Instead of paginating the GitHub API per commit, we clone the branch once and read everything from disk with the native `git` binary — no background worker, no job queue, no watermark.

```
report generation (synchronous)
   └─ repositories/archive-service.ensureArchive(owner, repo, branch)
        repos/{owner}/{repo}/{branch}/   (git clone via native git + GITHUB_TOKEN)
        · incremental fetch on repeat runs — only new objects transfer
        ▼
   repositories/git-reader.listCommitsInRange(dir, ref, since, until)
        · commits in the report window, read from the local .git
        · per-commit file scope (`git diff-tree --name-status`)
        ▼
   classify with the free rule guardrail (skip empty/junk; flag misleading)
        ▼
   upsert commit_chunks (dedupe by SHA; commit_message is the embedding source)
        →  embedNewChunks (batch)
        ▼
   read window from Postgres → generate report
```

**Why batch:** the workload needs *everything* (all metadata + file scopes) from a remote, rate-limited API. A clone collapses that into one idempotent fetch; every fragile per-item call (pagination, retries, 429s) disappears. The GitHub REST API is used only for **discovery** (repo/branch listing, connection check) and the clone itself.

**Dedupe by SHA:** re-running ingestion for the same window writes nothing new (upsert `ON CONFLICT DO NOTHING`-style by `(project_id, commit_sha, branch)`), and already-synced commits are skipped before any file-scope work.

**Failure handling:** the only remote step is the clone/fetch (retryable with backoff). No LLM call happens during ingestion — the only LLM work is report generation itself.

**Status:** there is no `/projects/:id/sync` endpoint — ingestion is inline in report generation and the archive freshness is implicit (fetch-before-read).

**Report generation guard:** never starts (not even the clone) without a valid AI provider key — stored credential or env fallback — otherwise `ProviderKeyError` (400).

## Tech Debt

The MVP solved one concrete problem as fast as possible. Every shortcut was intentional but now needs addressing.

### Git provider coupling

All external data flows through `src/shared/integrations/git-provider/` — an Octokit adapter with an interface. It's still imported directly by every consuming route/service (no DI), so adding GitLab or Bitbucket means touching each call site.

### Database coupling

The DB client is initialized at module load in `src/db/client.ts`. Access goes through per-domain stores (`src/projects/stores/`, `src/reports/stores/`, `src/credentials/stores/`) — routes never import `db` directly. The schema is a normalized model in `src/db/schema.ts`: `projects` (provider-generic: `git_provider` enum + `provider_project_id`/`provider_owner`, unique on `(git_provider, provider_project_id)`), `commit_chunks` (per-commit LLM summary + bounded diff patch + pgvector embedding), `reports`, `report_commits`, and `credentials`.

### No dependency injection

Services are imported at the top of files, not injected. Swapping implementations means changing import paths everywhere. Tests compensate with `vi.mock()`.

### No auth layer

The API has zero authentication. Fine for the MVP's trusted deployments. Impossible to open for multi-tenant SaaS without a full rework.

### Report generation (`src/reports/routes.ts`)

One ~160-line handler does validation, key resolution, batch ingestion, AI retry loop, and report persistence. Should be extracted into a service.

- Commit ingestion is synchronous and batch-based: `src/repositories/ingest.ts` clones the branch archive, reads the window's commits + real diffs from disk (isomorphic-git), summarizes/verifies them in batches with the small LLM, upserts `commit_chunks` (dedupe by SHA), and triggers embedding.
- Commit reads are store-first: `GET /api/v1/reports/:id/commits` serves stored rows from `report_commits` + `commit_chunks`; `POST /api/v1/reports` ingests the window, then reads it from Postgres.

### Validation & data-integrity gaps

- `startDate`/`endDate` are unvalidated strings; invalid dates surface as generic 500s.
- `limit`/`per_page` on the discovery endpoints are validated (coerced ints, 1–100) so bad input fails fast with a 400 instead of propagating NaN to the archive.
- `GET /repositories/*` and `/commits`/`/commits/count` are archive-backed (the preview triggers a clone/fetch of the branch); the normalized read path is `GET /reports/:id/commits`.
- No transactions: project upsert and report create are separate writes; the window ingest runs outside a transaction. A mid-way failure leaves chunks persisted without a report (safe today — chunks are the cache — but should be intentional).

### Diff grounding is file-level, not content-level

The report prompt is grounded on real, provable diff **scope** (files, line counts, commit link) — the commit message is demoted to a hint and flagged when it contradicts the diff (`git-diff.ts` computes the stats, `guardrail.ts` skips empty commits and flags junk/lying messages). Two deliberate shortcuts remain:

- **The report model never reads the patch hunks.** It knows *what/where* changed and *how much*, but the "why" is inferred from file paths + line counts + message + link, not from the changed lines themselves. A commit mislabeled as `refactor` that actually deletes a feature is only caught if the file paths reveal it. Closing this means condensing real hunks into the report prompt — a token cost we're deferring.
- **The embedding corpus is the commit message by design.** This is a commit/PR review tool, not a code reviewer: with clear conventional commits the message is a legitimate summary, so generating a diff-derived one via a batched LLM is **unnecessary**. Revisit only if search ships *and* message-based embeddings prove insufficient (the `embed:backfill` script already exists for one-time re-embedding).

## What needs to happen

Decouple in three phases, no big-bang rewrites:

1. **Git provider interface** — extract an adapter behind a single interface so routes don't know or care whether data comes from GitHub, GitLab, or Bitbucket
2. **Data access layer** — store layer extracted into per-domain stores under each domain folder (`src/projects/stores/`, etc.); Postgres + pgvector provides the connected data model. The vector-search half of this (HNSW on `commit_chunks.embedding`) is infrastructure-ready but **WIP** — embeddings are populated, the `cosineDistance` search endpoint is not — see "RAG (Vectors: partial, semantic search not shipped)" above
3. **Dependency injection** — wire providers and stores into the app via Fastify's decorate mechanism so routes receive their dependencies instead of importing them

Each migration follows the same pattern: extract interface, write new implementation behind it, run both in parallel, flip the default, remove the old one.
