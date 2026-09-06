import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";

const mockGetSession = vi.fn();
const mockCreateSession = vi.fn();
const mockListSessions = vi.fn();
const mockGetMessages = vi.fn();
const mockDeleteSession = vi.fn();
const mockStreamMessage = vi.fn();

vi.mock("@/chat/stores/chat-sessions-store", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@/chat/services", () => ({
  createChatSession: (...args: unknown[]) => mockCreateSession(...args),
  listChatSessions: (...args: unknown[]) => mockListSessions(...args),
  getChatMessages: (...args: unknown[]) => mockGetMessages(...args),
  deleteChatSession: (...args: unknown[]) => mockDeleteSession(...args),
  streamChatMessage: (...args: unknown[]) => mockStreamMessage(...args),
  SessionNotFoundError: class extends Error {},
}));

import { buildApp } from "@/app";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const session = {
  id: SESSION_ID,
  projectId: PROJECT_ID,
  title: "New chat",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const assistantMessage = {
  id: "33333333-3333-4333-8333-333333333333",
  role: "assistant",
  content: "Hello world",
  branch: null,
  citations: [
    {
      commitSha: "abc123",
      commitMessage: "add rag chat",
      author: "dev",
      committedAt: "2024-01-01T00:00:00.000Z",
      filesChanged: ["src/chat/routes.ts"],
      commitUrl: "https://github.com/o/r/commit/abc123",
    },
  ],
  createdAt: "2024-01-01T00:00:00.000Z",
};

describe("chat routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockGetSession.mockReset();
    mockCreateSession.mockReset();
    mockListSessions.mockReset();
    mockGetMessages.mockReset();
    mockDeleteSession.mockReset();
    mockStreamMessage.mockReset();
    mockGetSession.mockResolvedValue({ id: SESSION_ID, projectId: PROJECT_ID });
  });

  it("creates a chat session", async () => {
    mockCreateSession.mockResolvedValue(session);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/sessions",
      payload: { projectId: PROJECT_ID },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(session);
  });

  it("returns 404 when the project does not exist", async () => {
    mockCreateSession.mockRejectedValue(new Error("Project not found"));

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/sessions",
      payload: { projectId: PROJECT_ID },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Project not found");
  });

  it("rejects invalid create input", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/sessions",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("lists sessions filtered by project", async () => {
    mockListSessions.mockResolvedValue([session]);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/chat/sessions?projectId=${PROJECT_ID}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sessions: [session] });
    expect(mockListSessions).toHaveBeenCalledWith(PROJECT_ID);
  });

  it("returns messages for a session", async () => {
    mockGetMessages.mockResolvedValue([assistantMessage]);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/chat/sessions/${SESSION_ID}/messages`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ messages: [assistantMessage] });
  });

  it("returns 404 when the session is missing", async () => {
    mockGetMessages.mockResolvedValue(null);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/chat/sessions/${SESSION_ID}/messages`,
    });

    expect(res.statusCode).toBe(404);
  });

  it("deletes a session", async () => {
    mockDeleteSession.mockResolvedValue(true);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/chat/sessions/${SESSION_ID}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });
  });

  it("returns 404 when deleting a missing session", async () => {
    mockDeleteSession.mockResolvedValue(false);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/chat/sessions/${SESSION_ID}`,
    });

    expect(res.statusCode).toBe(404);
  });

  it("streams tokens and a done frame with citations", async () => {
    mockStreamMessage.mockImplementation(
      async ({ onToken }: { onToken: (c: string) => void }) => {
        onToken("Hello");
        onToken(" world");
        return assistantMessage;
      },
    );

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/chat/sessions/${SESSION_ID}/messages`,
      payload: { content: "what changed?" },
      headers: { origin: "http://localhost:3000" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.headers["access-control-allow-origin"]).toBeTruthy();
    const frames = res.body
      .split("\n\n")
      .filter(Boolean)
      .map((f) => JSON.parse(f.replace(/^data: /, "")));
    expect(frames).toEqual([
      { type: "token", content: "Hello" },
      { type: "token", content: " world" },
      { type: "done", message: assistantMessage },
    ]);
    expect(mockStreamMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID, content: "what changed?" }),
    );
  });

  it("rejects an empty message body", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/chat/sessions/${SESSION_ID}/messages`,
      payload: { content: "" },
    });

    expect(res.statusCode).toBe(400);
    expect(mockStreamMessage).not.toHaveBeenCalled();
  });
});
