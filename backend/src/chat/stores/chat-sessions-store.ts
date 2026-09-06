import { asc, desc, eq } from "drizzle-orm";
import { db, DbOrTx } from "@/db/client";
import { chatMessages, chatSessions, type ChatCitation } from "@/db/schema";

export async function createSession({
  projectId,
  title,
  tx,
}: {
  projectId: string;
  title: string;
  tx?: DbOrTx;
}) {
  const [row] = await (tx || db)
    .insert(chatSessions)
    .values({ projectId, title })
    .returning();
  return row;
}

export async function listSessions(opts?: { projectId?: string; tx?: DbOrTx }) {
  const client = opts?.tx || db;
  const base = client
    .select()
    .from(chatSessions)
    .orderBy(desc(chatSessions.updatedAt));
  if (opts?.projectId) {
    return base.where(eq(chatSessions.projectId, opts.projectId));
  }
  return base;
}

export async function getSession({ id, tx }: { id: string; tx?: DbOrTx }) {
  const [row] = await (tx || db)
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, id))
    .limit(1);
  return row ?? null;
}

export async function touchSession({ id, tx }: { id: string; tx?: DbOrTx }) {
  await (tx || db)
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, id));
}

export async function deleteSession({ id, tx }: { id: string; tx?: DbOrTx }) {
  await (tx || db).delete(chatSessions).where(eq(chatSessions.id, id));
}

export async function addMessage({
  sessionId,
  role,
  content,
  branch,
  citations,
  tx,
}: {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  branch?: string | null;
  citations?: ChatCitation[];
  tx?: DbOrTx;
}) {
  const [row] = await (tx || db)
    .insert(chatMessages)
    .values({
      sessionId,
      role,
      content,
      branch: branch ?? null,
      citations: citations ?? [],
    })
    .returning();
  return row;
}

export async function listMessages({ sessionId, tx }: { sessionId: string; tx?: DbOrTx }) {
  const client = tx || db;
  return client
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));
}
