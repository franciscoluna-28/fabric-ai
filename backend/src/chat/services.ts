import { env } from "@/config/env";
import type { ChatCitation } from "@/db/schema";
import { resolveApiKey } from "@/credentials/services";
import { getProviderConfig } from "@/shared/integrations/providers/registry";
import { getAISettings } from "@/settings/services";
import { ProviderKeyError } from "@/reports/use-cases";
import { callAI } from "@/reports/ai";
import * as chatSessionsStore from "@/chat/stores/chat-sessions-store";
import { retrieveCommits } from "@/chat/retrieval";
import { parseQueryWindow } from "@/chat/date-window";
import { buildSystemPrompt, buildUserMessage } from "@/chat/prompts";
import type { ChatMessageDTO } from "@/chat/schemas";
import * as projectsStore from "@/projects/stores/projects-store";
import { prepareProjectBranch } from "@/projects/services";

const HISTORY_LIMIT = 20;

function toMessageDTO(row: Awaited<ReturnType<typeof chatSessionsStore.addMessage>>): ChatMessageDTO {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    branch: row.branch ?? null,
    citations: (row.citations ?? []) as ChatCitation[],
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function createChatSession(projectId: string) {
  const project = await projectsStore.getProjectById({ id: projectId });
  if (!project) {
    throw new Error("Project not found");
  }
  const row = await chatSessionsStore.createSession({
    projectId,
    title: "New chat",
  });
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function listChatSessions(projectId?: string) {
  const rows = await chatSessionsStore.listSessions({ projectId });
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  }));
}

export async function getChatMessages(sessionId: string) {
  const session = await chatSessionsStore.getSession({ id: sessionId });
  if (!session) return null;
  const rows = await chatSessionsStore.listMessages({ sessionId });
  return rows.map(toMessageDTO);
}

export async function deleteChatSession(id: string) {
  const session = await chatSessionsStore.getSession({ id });
  if (!session) return false;
  await chatSessionsStore.deleteSession({ id });
  return true;
}

async function resolveProviderAndKey() {
  const settings = await getAISettings();
  const provider = settings.reportProvider;
  const model = settings.reportModel;
  const providerConfig = getProviderConfig(provider);
  if (!providerConfig) throw new ProviderKeyError(provider);
  const storedKey = await resolveApiKey(provider);
  const apiKey =
    storedKey ||
    (env as unknown as Record<string, string>)[providerConfig.envKey] ||
    "";
  if (!apiKey) throw new ProviderKeyError(provider);
  return { provider, model, apiKey };
}

/**
 * Sends a chat message: persists the user message, retrieves the most relevant
 * commits, streams the assistant reply via `onToken`, then persists the reply
 * with its citations. Returns the final assistant message.
 */
export async function streamChatMessage(opts: {
  sessionId: string;
  content: string;
  branch?: string | null;
  onToken: (chunk: string) => void;
}): Promise<ChatMessageDTO> {
  const { sessionId, content, branch, onToken } = opts;

  const session = await chatSessionsStore.getSession({ id: sessionId });
  if (!session) throw new SessionNotFoundError();

  const project = await projectsStore.getProjectById({ id: session.projectId });

  await chatSessionsStore.addMessage({ sessionId, role: "user", content });

  // Ensure the branch is ingested before retrieval
  if (branch) {
    await prepareProjectBranch(session.projectId, branch).catch(() => {});
  }

  const { startDate: dateWindowStart, endDate: dateWindowEnd, filteredQuery } = parseQueryWindow(content);
  const citations = await retrieveCommits({
    projectId: session.projectId,
    query: filteredQuery,
    branch: branch || undefined,
    startDate: dateWindowStart,
    endDate: dateWindowEnd,
  });

  const history = await chatSessionsStore.listMessages({ sessionId });
  const prior = history.slice(-HISTORY_LIMIT).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  // The last history entry is the user message we just added — it is replaced
  // below by the context-augmented version.
  const priorTurns = prior.slice(0, -1);

  const { provider, model, apiKey } = await resolveProviderAndKey();

  const messages: { role: "user" | "assistant" | "system"; content: string }[] = [
    { role: "system", content: buildSystemPrompt(project?.repositoryName) },
    ...priorTurns,
    {
      role: "user",
      content: buildUserMessage(content, citations, {
        branch: branch ?? null,
        startDate: dateWindowStart,
        endDate: dateWindowEnd,
      }),
    },
  ];

  const result = await callAI({
    provider,
    model,
    apiKey,
    maxTokens: 8192,
    messages,
    onChunk: (chunk) => onToken(chunk),
  });

  const reply = await chatSessionsStore.addMessage({
    sessionId,
    role: "assistant",
    content: result.content,
    branch: branch ?? null,
    citations,
  });
  await chatSessionsStore.touchSession({ id: sessionId });

  return toMessageDTO(reply);
}

export class SessionNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super("Chat session not found");
  }
}
