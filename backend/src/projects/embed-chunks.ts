import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import { commitChunks } from "@/db/schema";
import { contentHashOf } from "@/projects/stores/commit-chunks-store";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { embedTexts } from "@/projects/embeddings";

export async function listPendingChunks(projectId: string) {
  return db
    .select({
      id: commitChunks.id,
      commitMessage: commitChunks.commitMessage,
      contentHash: commitChunks.contentHash,
    })
    .from(commitChunks)
    .where(
      and(
        eq(commitChunks.projectId, projectId),
        or(
          isNull(commitChunks.embeddingHash),
          ne(commitChunks.embeddingHash, commitChunks.contentHash),
        ),
      ),
    );
}

export async function embedNewChunks(projectId: string, opts?: { batchSize?: number }) {
  if (!env.EMBEDDING_ENABLED) return { embedded: 0 };

  const pending = await listPendingChunks(projectId);
  if (pending.length === 0) return { embedded: 0 };

  const batchSize = opts?.batchSize ?? env.EMBEDDING_BATCH_SIZE;
  let embedded = 0;
  const start = performance.now();

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const batchStart = performance.now();
    const vectors = await embedTexts(batch.map((r) => r.commitMessage));

    for (let j = 0; j < batch.length; j++) {
      const hash = batch[j].contentHash ?? contentHashOf(batch[j].commitMessage);
      await db
        .update(commitChunks)
        .set({
          embedding: vectors[j],
          contentHash: hash,
          embeddingHash: hash,
          updatedAt: new Date(),
        })
        .where(eq(commitChunks.id, batch[j].id));
    }
    embedded += batch.length;
    logger.info(
      {
        projectId,
        batchIndex: i / batchSize,
        batchSize: batch.length,
        durationMs: Math.round(performance.now() - batchStart),
      },
      "embedding batch complete",
    );
  }

  logger.info(
    {
      projectId,
      pending: pending.length,
      embedded,
      durationMs: Math.round(performance.now() - start),
    },
    "embedNewChunks complete",
  );

  return { embedded };
}
