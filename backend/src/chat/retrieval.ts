import type { ChatCitation } from "@/db/schema";
import { embedTexts } from "@/projects/embeddings";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import type { CommitSearchResult } from "@/projects/stores/commit-chunks-store";

export const RETRIEVAL_LIMIT = 30;

const CANDIDATE_POOL = 120;

const COMMIT_BOOST: Record<string, number> = {
  "feat!": 5,
  feat: 4,
  "fix!": 4,
  "refactor!": 3,
  breaking: 4,
  fix: 2,
  refactor: 1,
  docs: 0.5,
  chore: 0.5,
  test: 0.5,
};

function importanceScore(row: CommitSearchResult, similarity: number): number {
  let boost = 0;
  const msg = row.commitMessage;
  const prefix = msg.match(/^(\w+!?)(?:\(.+?\))?!?/)?.[1];
  if (prefix) boost = COMMIT_BOOST[prefix.toLowerCase()] ?? 0;
  if (msg.startsWith("Merge pull request")) boost += 3;
  if (/breaking|BREAKING/i.test(msg)) boost += 4;
  const files = row.metadata?.filesChanged?.length ?? 0;
  if (files >= 20) boost += 3;
  else if (files >= 10) boost += 2;
  else if (files >= 5) boost += 1;
  return similarity * 0.5 + boost * 0.5;
}

function toCitation(row: CommitSearchResult): ChatCitation {
  return {
    commitSha: row.commitSha,
    commitMessage: row.commitMessage,
    author: row.author ?? null,
    committedAt: row.committedAt.toISOString(),
    filesChanged: row.metadata?.filesChanged ?? [],
    commitUrl: row.metadata?.commitUrl ?? null,
  };
}

export async function retrieveCommits(opts: {
  projectId: string;
  query: string;
  limit?: number;
  branch?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ChatCitation[]> {
  const limit = opts.limit ?? RETRIEVAL_LIMIT;
  const embeddedCount = await commitChunksStore.countChunksForProject({
    projectId: opts.projectId,
    branch: opts.branch,
    embeddedOnly: true,
  });

  let rows: (CommitSearchResult & { _similarity?: number })[] | null = null;
  if (embeddedCount > 0) {
    try {
      const [embedding] = await embedTexts([opts.query]);
      rows = await commitChunksStore.semanticSearchCommits({
        projectId: opts.projectId,
        embedding,
        limit: CANDIDATE_POOL,
        branch: opts.branch,
        startDate: opts.startDate,
        endDate: opts.endDate,
      });
    } catch {
      rows = null;
    }
  }

  if (!rows || rows.length === 0) {
    rows = await commitChunksStore.keywordSearchCommits({
      projectId: opts.projectId,
      query: opts.query,
      limit: CANDIDATE_POOL,
      branch: opts.branch,
      startDate: opts.startDate,
      endDate: opts.endDate,
    });
  }

  if (!rows || rows.length === 0) return [];

  const scored = rows
    .map((row, i) => ({
      row,
      score: importanceScore(row, 1 - i / CANDIDATE_POOL),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.row);

  return scored.map(toCitation);
}