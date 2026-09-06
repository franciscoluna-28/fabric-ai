import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEmbedTexts = vi.fn();
const mockCountChunks = vi.fn();
const mockSemanticSearch = vi.fn();
const mockKeywordSearch = vi.fn();

vi.mock("@/projects/embeddings", () => ({
  embedTexts: (...args: unknown[]) => mockEmbedTexts(...args),
}));

vi.mock("@/projects/stores/commit-chunks-store", () => ({
  countChunksForProject: (...args: unknown[]) => mockCountChunks(...args),
  semanticSearchCommits: (...args: unknown[]) => mockSemanticSearch(...args),
  keywordSearchCommits: (...args: unknown[]) => mockKeywordSearch(...args),
}));

import { retrieveCommits } from "@/chat/retrieval";

const row = {
  id: "1",
  commitSha: "abc123",
  commitMessage: "add rag chat",
  author: "dev",
  committedAt: new Date("2024-01-01T00:00:00.000Z"),
  metadata: {
    filesChanged: ["src/chat/routes.ts"],
    commitUrl: "https://github.com/o/r/commit/abc123",
  },
  distance: 0.1,
};

describe("retrieveCommits", () => {
  beforeEach(() => {
    mockEmbedTexts.mockReset();
    mockCountChunks.mockReset();
    mockSemanticSearch.mockReset();
    mockKeywordSearch.mockReset();
  });

  it("uses semantic search when embeddings exist", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([row]);

    const result = await retrieveCommits({ projectId: "p1", query: "what changed" });

    expect(mockEmbedTexts).toHaveBeenCalledWith(["what changed"]);
    expect(mockSemanticSearch).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", limit: 120 }),
    );
    expect(mockKeywordSearch).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        commitSha: "abc123",
        commitMessage: "add rag chat",
        author: "dev",
        committedAt: "2024-01-01T00:00:00.000Z",
        filesChanged: ["src/chat/routes.ts"],
        commitUrl: "https://github.com/o/r/commit/abc123",
      },
    ]);
  });

  it("falls back to keyword search when no embeddings exist", async () => {
    mockCountChunks.mockResolvedValue(0);
    mockKeywordSearch.mockResolvedValue([row]);

    const result = await retrieveCommits({ projectId: "p1", query: "chat" });

    expect(mockEmbedTexts).not.toHaveBeenCalled();
    expect(mockKeywordSearch).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", query: "chat" }),
    );
    expect(result).toHaveLength(1);
  });

  it("falls back to keyword search when embedding fails", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockRejectedValue(new Error("no key"));
    mockSemanticSearch.mockResolvedValue([]);
    mockKeywordSearch.mockResolvedValue([row]);

    const result = await retrieveCommits({ projectId: "p1", query: "chat" });

    expect(mockKeywordSearch).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("returns empty when nothing matches", async () => {
    mockCountChunks.mockResolvedValue(0);
    mockKeywordSearch.mockResolvedValue([]);

    const result = await retrieveCommits({ projectId: "p1", query: "nope" });

    expect(result).toEqual([]);
  });
});
