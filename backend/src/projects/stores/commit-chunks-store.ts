import { createHash } from "crypto";
import { and, asc, cosineDistance, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db, DbOrTx, Tx } from "@/db/client";
import { commitChunks, type CommitChunkMetadata } from "@/db/schema";

export type CommitChunkInput = {
  projectId: string;
  commitSha: string;
  branch?: string;
  commitMessage: string;
  author?: string | null;
  metadata?: CommitChunkMetadata;
  committedAt: Date;
};

export function contentHashOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function upsertCommitChunks({
  inputs,
  tx,
}: {
  inputs: CommitChunkInput[];
  tx?: Tx;
}) {
  if (inputs.length === 0) return;
  const client = tx || db;
  await client
    .insert(commitChunks)
    .values(
      inputs.map((i) => ({
        projectId: i.projectId,
        commitSha: i.commitSha,
        branch: i.branch ?? "main",
        commitMessage: i.commitMessage,
        author: i.author ?? null,
        contentHash: contentHashOf(i.commitMessage),
        metadata: i.metadata ?? {},
        committedAt: i.committedAt,
      })),
    )
    .onConflictDoUpdate({
      target: [commitChunks.projectId, commitChunks.commitSha, commitChunks.branch],
      set: {
        commitMessage: sql`excluded.commit_message`,
        author: sql`excluded.author`,
        contentHash: sql`excluded.content_hash`,
        metadata: sql`excluded.metadata`,
        committedAt: sql`excluded.committed_at`,
        updatedAt: sql`now()`,
      },
    });
}

export async function countChunksForProject({
  projectId,
  branch,
  embeddedOnly,
  tx,
}: {
  projectId: string;
  branch?: string;
  embeddedOnly?: boolean;
  tx?: DbOrTx;
}): Promise<number> {
  const client = tx || db;
  const conditions = [eq(commitChunks.projectId, projectId)];
  if (branch) conditions.push(eq(commitChunks.branch, branch));
  if (embeddedOnly) conditions.push(isNotNull(commitChunks.embedding));
  const [row] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(commitChunks)
    .where(and(...conditions));
  return row?.count ?? 0;
}

export async function getLatestCommitDate({
  projectId,
  branch,
  tx,
}: {
  projectId: string;
  branch?: string;
  tx?: DbOrTx;
}): Promise<Date | null> {
  const client = tx || db;
  const conditions = [eq(commitChunks.projectId, projectId)];
  if (branch) conditions.push(eq(commitChunks.branch, branch));
  const [row] = await client
    .select({ committedAt: commitChunks.committedAt })
    .from(commitChunks)
    .where(and(...conditions))
    .orderBy(desc(commitChunks.committedAt))
    .limit(1);
  return row?.committedAt ?? null;
}

export async function getChunksByShas({
  projectId,
  shas,
  branch,
  tx,
}: {
  projectId: string;
  shas: string[];
  branch?: string;
  tx?: DbOrTx;
}): Promise<Map<string, { commitSha: string; metadata: CommitChunkMetadata; contentHash: string | null }>> {
  if (shas.length === 0) return new Map();
  const client = tx || db;
  const conditions = [
    eq(commitChunks.projectId, projectId),
    inArray(commitChunks.commitSha, shas),
  ];
  if (branch) conditions.push(eq(commitChunks.branch, branch));
  const rows = await client
    .select({
      commitSha: commitChunks.commitSha,
      metadata: commitChunks.metadata,
      contentHash: commitChunks.contentHash,
    })
    .from(commitChunks)
    .where(and(...conditions));
  return new Map(rows.map((r) => [r.commitSha, { ...r, metadata: r.metadata ?? {} }]));
}

export async function listCommitsForProject({
  projectId,
  tx,
  startDate,
  endDate,
  branch,
}: {
  projectId: string;
  tx?: DbOrTx;
  startDate?: Date;
  endDate?: Date;
  branch?: string;
}) {
  const client = tx || db;
  const conditions = [eq(commitChunks.projectId, projectId)];
  if (startDate) conditions.push(gte(commitChunks.committedAt, startDate));
  if (endDate) conditions.push(lte(commitChunks.committedAt, endDate));
  if (branch) conditions.push(eq(commitChunks.branch, branch));
  return client
    .select()
    .from(commitChunks)
    .where(and(...conditions))
    .orderBy(desc(commitChunks.committedAt));
}

export type CommitSearchResult = {
  id: string;
  commitSha: string;
  commitMessage: string;
  author: string | null;
  committedAt: Date;
  metadata: CommitChunkMetadata;
  distance: number | null;
};

/**
 * Vector search over the HNSW index. Orders by cosine distance ascending (most
 * similar first); NULL embeddings are excluded by the HNSW index definition.
 */
export async function semanticSearchCommits({
  projectId,
  embedding,
  limit,
  branch,
  startDate,
  endDate,
  tx,
}: {
  projectId: string;
  embedding: number[];
  limit: number;
  branch?: string;
  startDate?: Date;
  endDate?: Date;
  tx?: DbOrTx;
}): Promise<CommitSearchResult[]> {
  const client = tx || db;
  const conditions = [
    eq(commitChunks.projectId, projectId),
    isNotNull(commitChunks.embedding),
  ];
  if (branch) conditions.push(eq(commitChunks.branch, branch));
  if (startDate) conditions.push(gte(commitChunks.committedAt, startDate));
  if (endDate) conditions.push(lte(commitChunks.committedAt, endDate));

  const rows = await client
    .select({
      id: commitChunks.id,
      commitSha: commitChunks.commitSha,
      commitMessage: commitChunks.commitMessage,
      author: commitChunks.author,
      committedAt: commitChunks.committedAt,
      metadata: commitChunks.metadata,
      distance: cosineDistance(commitChunks.embedding, embedding),
    })
    .from(commitChunks)
    .where(and(...conditions))
    .orderBy(asc(cosineDistance(commitChunks.embedding, embedding)))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ?? {},
    distance: r.distance as number,
  }));
}

/**
 * Keyword fallback when no embeddings exist for a project (embedding disabled
 * or not yet backfilled). Matches the commit message or any file path in scope.
 */
export async function keywordSearchCommits({
  projectId,
  query,
  limit,
  branch,
  startDate,
  endDate,
  tx,
}: {
  projectId: string;
  query: string;
  limit: number;
  branch?: string;
  startDate?: Date;
  endDate?: Date;
  tx?: DbOrTx;
}): Promise<CommitSearchResult[]> {
  const client = tx || db;
  const pattern = `%${query.replace(/[%_]/g, "")}%`;
  const conditions = [
    eq(commitChunks.projectId, projectId),
    or(
      ilike(commitChunks.commitMessage, pattern),
      sql`${commitChunks.metadata}::text ILIKE ${pattern}`,
    ),
  ];
  if (branch) conditions.push(eq(commitChunks.branch, branch));
  if (startDate) conditions.push(gte(commitChunks.committedAt, startDate));
  if (endDate) conditions.push(lte(commitChunks.committedAt, endDate));

  const rows = await client
    .select({
      id: commitChunks.id,
      commitSha: commitChunks.commitSha,
      commitMessage: commitChunks.commitMessage,
      author: commitChunks.author,
      committedAt: commitChunks.committedAt,
      metadata: commitChunks.metadata,
    })
    .from(commitChunks)
    .where(and(...conditions))
    .orderBy(desc(commitChunks.committedAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ?? {},
    distance: null,
  }));
}
