import { FastifyRequest, FastifyReply } from "fastify";
import type { Static } from "@sinclair/typebox";
import {
  CreateSessionBody,
  ChatSessionsQuery,
  ChatSessionIdParams,
  SendMessageBody,
} from "@/chat/schemas";
import {
  createChatSession,
  listChatSessions,
  getChatMessages,
  deleteChatSession,
  streamChatMessage,
  SessionNotFoundError,
} from "@/chat/services";
import * as chatSessionsStore from "@/chat/stores/chat-sessions-store";
import { applyCorsToRawResponse } from "@/shared/cors-raw";

export async function createSession(req: FastifyRequest, reply: FastifyReply) {
  const { projectId } = req.body as Static<typeof CreateSessionBody>;
  try {
    const session = await createChatSession(projectId);
    return reply.status(201).send(session);
  } catch (error) {
    const message = (error as Error)?.message ?? "Failed to create chat session";
    const status = message === "Project not found" ? 404 : 500;
    return reply.status(status).send({ error: message });
  }
}

export async function listSessions(req: FastifyRequest, reply: FastifyReply) {
  const { projectId } = req.query as Static<typeof ChatSessionsQuery>;
  try {
    const sessions = await listChatSessions(projectId);
    return reply.send({ sessions });
  } catch {
    return reply.status(500).send({ error: "Failed to list chat sessions" });
  }
}

export async function getMessages(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as Static<typeof ChatSessionIdParams>;
  try {
    const messages = await getChatMessages(id);
    if (!messages) {
      return reply.status(404).send({ error: "Chat session not found" });
    }
    return reply.send({ messages });
  } catch {
    return reply.status(500).send({ error: "Failed to list chat messages" });
  }
}

export async function removeSession(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as Static<typeof ChatSessionIdParams>;
  try {
    const deleted = await deleteChatSession(id);
    if (!deleted) {
      return reply.status(404).send({ error: "Chat session not found" });
    }
    return reply.send({ deleted: true });
  } catch {
    return reply.status(500).send({ error: "Failed to delete chat session" });
  }
}

function sendFrame(res: import("node:http").ServerResponse, data: unknown) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * SSE stream of an assistant reply. Frames:
 *  - { type: "token", content }   per delta
 *  - { type: "done", message }    final assistant message incl. citations
 *  - { type: "error", error }     on failure after the stream started
 */
export async function streamMessage(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as Static<typeof ChatSessionIdParams>;
  const { content, branch } = req.body as Static<typeof SendMessageBody>;

  const session = await chatSessionsStore.getSession({ id });
  if (!session) {
    return reply.status(404).send({ error: "Chat session not found" });
  }

  reply.hijack();
  const res = reply.raw;
  applyCorsToRawResponse(req.raw, res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    res.end();
  };
  req.raw.on("close", close);

  try {
    const message = await streamChatMessage({
      sessionId: id,
      content,
      branch,
      onToken: (chunk) => {
        if (closed) return;
        sendFrame(res, { type: "token", content: chunk });
      },
    });
    if (!closed) {
      sendFrame(res, { type: "done", message });
    }
  } catch (error) {
    const message =
      error instanceof SessionNotFoundError
        ? "Chat session not found"
        : (error as Error)?.message ?? "Failed to generate reply";
    if (!closed) {
      sendFrame(res, { type: "error", error: message });
    }
  } finally {
    close();
  }
}
