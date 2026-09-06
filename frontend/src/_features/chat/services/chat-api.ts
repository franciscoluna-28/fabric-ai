"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, API_URL } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import type { ChatMessage, ChatSession } from "@/src/shared/types";

export async function prepareProjectBranch(projectId: string, branch: string) {
  const response = await apiClient.POST("/api/v1/projects/{id}/branches/prepare", {
    params: { path: { id: projectId } },
    body: { branch },
  });
  if (response.error) throw response.error;
  return response.data;
}

export function useChatSessions(projectId?: string) {
  const query = projectId ? { projectId } : undefined;
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.chat.sessions(projectId),
    queryFn: () =>
      apiClient
        .GET("/api/v1/chat/sessions", { params: { query } })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    enabled: !!projectId,
  });

  return {
    sessions: (data?.sessions ?? []) as ChatSession[],
    isLoading,
    isFetching,
    error: error ?? null,
  };
}

export function useChatMessages(sessionId?: string) {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.chat.messages(sessionId!),
    queryFn: () =>
      apiClient
        .GET("/api/v1/chat/sessions/{id}/messages", {
          params: { path: { id: sessionId! } },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    enabled: !!sessionId,
  });

  return {
    messages: (data?.messages ?? []) as ChatMessage[],
    isLoading,
    isFetching,
    error: error ?? null,
  };
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiClient
        .POST("/api/v1/chat/sessions", { body: { projectId } })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(session.projectId) });
    },
  });
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient
        .DELETE("/api/v1/chat/sessions/{id}", { params: { path: { id: sessionId } } })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    onSuccess: (_data, sessionId) => {
      queryClient.removeQueries({ queryKey: queryKeys.chat.messages(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
    },
  });
}

export type StreamChunk =
  | { type: "token"; content: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; error: string };

/**
 * Streams an assistant reply over SSE via fetch. Calls `onChunk` for each frame;
 * resolves with the final assistant message.
 */
export async function streamChatMessage(
  sessionId: string,
  content: string,
  branch: string | null,
  onChunk: (chunk: StreamChunk) => void,
): Promise<ChatMessage> {
  const res = await fetch(`${API_URL}/api/v1/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, ...(branch ? { branch } : {}) }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Chat request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneMessage: ChatMessage | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const parsed = JSON.parse(line.replace(/^data:\s*/, "")) as StreamChunk;
        if (parsed.type === "token") {
          onChunk(parsed);
        } else if (parsed.type === "done") {
          doneMessage = parsed.message;
          onChunk(parsed);
        } else if (parsed.type === "error") {
          onChunk(parsed);
          return Promise.reject(new Error(parsed.error));
        }
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }

  if (!doneMessage) {
    throw new Error("Stream ended without a completed reply");
  }
  return doneMessage;
}
