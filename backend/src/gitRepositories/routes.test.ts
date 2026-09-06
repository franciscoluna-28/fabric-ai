import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const mockProvider = {
  listRepositories: vi.fn(),
  listBranches: vi.fn(),
  getDefaultBranch: vi.fn(async () => "main"),
};

vi.mock("@/shared/integrations/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

const mockEnsureArchive = vi.fn();
const mockListCommitsInRange = vi.fn();

vi.mock("@/repositories/archive-service", () => ({
  ensureArchive: (...args: unknown[]) => mockEnsureArchive(...args),
}));

vi.mock("@/repositories/git-reader", () => ({
  listCommitsInRange: (...args: unknown[]) => mockListCommitsInRange(...args),
}));

import { buildApp } from "@/app";

describe("GET /api/v1/repositories", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns repositories list", async () => {
    const repos: any = [{ name: "repo1", owner: "user1", fullName: "user1/repo1" }];
    mockProvider.listRepositories.mockResolvedValue(repos);

    const res = await app.inject({ method: "GET", url: "/api/v1/repositories" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(repos);
  });

  it("passes query parameters", async () => {
    mockProvider.listRepositories.mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories?type=public&sort=full_name&direction=asc&per_page=5",
    });

    expect(mockProvider.listRepositories).toHaveBeenCalledWith({
      type: "public",
      sort: "full_name",
      direction: "asc",
      perPage: 5,
    });
  });

  it("returns 500 on error", async () => {
    mockProvider.listRepositories.mockRejectedValue(new Error("API error"));

    const res = await app.inject({ method: "GET", url: "/api/v1/repositories" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch repositories" });
  });
});

describe("GET /api/v1/repositories/:owner/:repo/branches", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns branches list", async () => {
    mockProvider.listBranches.mockResolvedValue(["main", "dev"]);
    mockProvider.getDefaultBranch.mockResolvedValue("main");

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/branches",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ branches: ["main", "dev"], defaultBranch: "main" });
  });

  it("calls listBranches with correct params", async () => {
    mockProvider.listBranches.mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/myuser/myrepo/branches",
    });

    expect(mockProvider.listBranches).toHaveBeenCalledWith("myuser", "myrepo");
  });

  it("returns 500 on error", async () => {
    mockProvider.listBranches.mockRejectedValue(new Error("API error"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/branches",
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch branches" });
  });
});

describe("GET /api/v1/repositories/:owner/:repo/commits", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns commits list from the local archive", async () => {
    mockEnsureArchive.mockResolvedValue({ dir: "/tmp/repo", tipSha: "abc" });
    mockListCommitsInRange.mockResolvedValue([
      { sha: "abc", message: "fix", author: "dev", date: "2024-01-15T00:00:00.000Z" },
    ]);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      commits: [{ sha: "abc", message: "fix", author: "dev", date: "2024-01-15T00:00:00.000Z" }],
    });
  });

  it("passes branch and date range to the archive-backed reader", async () => {
    mockEnsureArchive.mockResolvedValue({ dir: "/tmp/repo", tipSha: "abc" });
    mockListCommitsInRange.mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits?limit=50&branch=main&startDate=2024-01-01&endDate=2024-01-31",
    });

    expect(mockEnsureArchive).toHaveBeenCalledWith({ owner: "owner1", repo: "repo1", branch: "main" });
    expect(mockListCommitsInRange).toHaveBeenCalledWith({
      dir: "/tmp/repo",
      ref: "main",
      since: new Date("2024-01-01T00:00:00.000Z"),
      until: new Date("2024-01-31T00:00:00.000Z"),
    });
  });

  it("returns 500 on error", async () => {
    mockEnsureArchive.mockRejectedValue(new Error("clone failed"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits",
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch commits" });
  });

  it("returns 400 when the branch or repo is not found", async () => {
    mockEnsureArchive.mockRejectedValue(Object.assign(new Error("not found"), { code: "NotFoundError" }));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits?branch=nope",
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an invalid limit", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits?limit=not-a-number",
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/v1/repositories/:owner/:repo/commits/count", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns commit count from the local archive", async () => {
    mockEnsureArchive.mockResolvedValue({ dir: "/tmp/repo", tipSha: "abc" });
    mockListCommitsInRange.mockResolvedValue([{ sha: "a" }, { sha: "b" }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ count: 2 });
  });

  it("passes date range query parameters", async () => {
    mockEnsureArchive.mockResolvedValue({ dir: "/tmp/repo", tipSha: "abc" });
    mockListCommitsInRange.mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count?startDate=2024-01-01&endDate=2024-01-31&branch=main",
    });

    expect(mockEnsureArchive).toHaveBeenCalledWith({ owner: "owner1", repo: "repo1", branch: "main" });
    expect(mockListCommitsInRange).toHaveBeenCalledWith({
      dir: "/tmp/repo",
      ref: "main",
      since: new Date("2024-01-01T00:00:00.000Z"),
      until: new Date("2024-01-31T00:00:00.000Z"),
    });
  });

  it("returns 500 on error", async () => {
    mockEnsureArchive.mockRejectedValue(new Error("clone failed"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count",
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch commit count" });
  });
});
