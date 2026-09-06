import { logger } from "@/shared/logger";
import { timed } from "@/shared/timing";
import { ensureArchive } from "@/repositories/archive-service";
import { listCommitsInRange, type LocalCommit } from "@/repositories/git-reader";
import { getCommitChangedFiles, type CommitChangedStats } from "@/repositories/git-diff";
import { classifyCommit, type CommitGuardResult } from "@/repositories/guardrail";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import { type CommitChunkInput } from "@/projects/stores/commit-chunks-store";
import { embedNewChunks } from "@/projects/embed-chunks";

export type IngestResult = {
  commitsFound: number;
  chunksWritten: number;
  tipSha: string;
};

export type IngestProgress = (
  stage: "archive" | "commits" | "ingest" | "embedding",
  message: string,
  done?: number,
  total?: number,
) => void;

const BATCH_SIZE = 50;
const WALK_CONCURRENCY = 8;

/**
 * Runs `fn` over `items` with at most `limit` promises in flight. The commit
 * file-scope reads shell out to the native git binary (async, non-blocking),
 * but spawning dozens of processes at once is still wasteful — a modest
 * concurrency bounds process count while keeping the loop responsive.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Batch-ingests the commit window for a repo branch into `commit_chunks`.
 *
 * 1. Ensure the local git archive is current (clone or incremental fetch).
 * 2. List commits in `[startDate, endDate]` from disk (native git).
 * 3. Walk each NEW commit's tree vs its parent to get the real file scope
 *    (OID compare only — no blob reads, bounded memory).
 * 4. Guardrail: skip empty/no-op commits, flag uninformative or lying messages.
 * 5. Upsert chunks in small batches (dedupe by SHA) — never hold the whole
 *    window in memory at once.
 * 6. Trigger embedding.
 *
 * No per-item GitHub API calls, no pagination, no watermark — the archive is
 * the source of truth and dedupe is by SHA. `onProgress` reports stages so the
 * caller can persist + stream live status.
 */
export async function ingestCommits(opts: {
  owner: string;
  repo: string;
  branch: string;
  projectId: string;
  startDate?: Date;
  endDate?: Date;
  onProgress?: IngestProgress;
}): Promise<IngestResult> {
  const { owner, repo, branch, projectId, startDate, endDate, onProgress } = opts;
  const base = { owner, repo, branch, projectId };

  const archive = await timed("ingest.ensureArchive", base, () =>
    ensureArchive({ owner, repo, branch }),
  );

  const commits = await timed(
    "ingest.listCommitsInRange",
    { ...base, startDate: startDate?.toISOString(), endDate: endDate?.toISOString() },
    () =>
      listCommitsInRange({
        dir: archive.dir,
        ref: branch,
        since: startDate,
        until: endDate,
      }),
  );
  onProgress?.("commits", `Found ${commits.length} commits`, commits.length, commits.length);

  const existing = await timed("ingest.getChunksByShas", { ...base, shas: commits.length }, () =>
    commitChunksStore.getChunksByShas({
      projectId,
      shas: commits.map((c) => c.sha),
      branch,
    }),
  );

  const newCommits = commits.filter((c) => !existing.has(c.sha));
  logger.info(
    {
      ...base,
      commitsFound: commits.length,
      alreadyStored: commits.length - newCommits.length,
    },
    "ingest.prepareChunks complete",
  );

  let chunksWritten = 0;
  let skipped = 0;
  for (let i = 0; i < newCommits.length; i += BATCH_SIZE) {
    const batch = newCommits.slice(i, i + BATCH_SIZE);
    const chunks: CommitChunkInput[] = [];
    const batchStart = performance.now();

    const diffs = await mapLimit(batch, WALK_CONCURRENCY, async (c) => {
      const stats = await getCommitChangedFiles({
        dir: archive.dir,
        parentSha: c.parentSha,
        commitSha: c.sha,
      });
      return { sha: c.sha, stats } as const;
    });
    const diffBySha = new Map(diffs.map((d) => [d.sha, d]));

    type IngestEntry = {
      c: LocalCommit;
      stats: CommitChangedStats;
      guard: CommitGuardResult;
    };
    const entries: IngestEntry[] = [];
    for (const c of batch) {
      const d = diffBySha.get(c.sha);
      if (!d) continue;
      const guard = classifyCommit({ message: c.message, filesChanged: d.stats.filesChanged });
      if (guard.status === "skipped") {
        skipped += 1;
        continue;
      }
      entries.push({ c, stats: d.stats, guard });
    }

    for (const { c, stats, guard } of entries) {
      chunks.push({
        projectId,
        commitSha: c.sha,
        branch,
        commitMessage: c.message,
        author: c.author,
        metadata: {
          filesChanged: stats.files.map((f) => f.filepath),
          commitUrl: `https://github.com/${owner}/${repo}/commit/${c.sha}`,
          validation: { status: guard.status, notes: guard.notes },
        },
        committedAt: new Date(c.date),
      });
    }

    if (chunks.length > 0) {
      await commitChunksStore.upsertCommitChunks({ inputs: chunks });
      chunksWritten += chunks.length;
    }
    const processed = Math.min(i + batch.length, newCommits.length);
    logger.info(
      {
        ...base,
        batchIndex: i / BATCH_SIZE,
        processed,
        total: newCommits.length,
        chunksWritten,
        skipped,
        durationMs: Math.round(performance.now() - batchStart),
      },
      "ingest batch complete",
    );
    onProgress?.(
      "ingest",
      `Stored ${chunksWritten} of ${newCommits.length} commits`,
      processed,
      newCommits.length,
    );
  }

  let embedded = 0;
  if (chunksWritten > 0) {
    onProgress?.("embedding", "Embedding commit summaries");
    const result = await timed("ingest.embedNewChunks", base, () =>
      embedNewChunks(projectId),
    );
    embedded = result.embedded;
  }

  logger.info(
    {
      ...base,
      commitsFound: commits.length,
      chunksWritten,
      skipped,
      embedded,
      tipSha: archive.tipSha,
    },
    "ingest complete",
  );

  return {
    commitsFound: commits.length,
    chunksWritten,
    tipSha: archive.tipSha,
  };
}
