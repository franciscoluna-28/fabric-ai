export const queryKeys = {
  models: {
    all: ["models"] as const,
    list: (provider?: string, modality?: "chat" | "embeddings") =>
      ["models", "list", { provider, modality }] as const,
  },
  settings: {
    all: ["settings"] as const,
    ai: ["settings", "ai"] as const,
  },
  projects: {
    all: ["projects"] as const,
    list: ["projects", "list"] as const,
  },
  repositories: {
    all: ["repositories"] as const,
    list: (filters: {
      type: string;
      sort: string;
      direction: string;
      per_page: number;
    }) => ["repositories", "list", filters] as const,
  },
  commits: {
    all: ["commits"] as const,
    list: (
      owner: string,
      repo: string,
      params?: { startDate?: string; endDate?: string; branch?: string },
    ) => ["commits", "list", owner, repo, params] as const,
    count: (
      owner: string,
      repo: string,
      params?: { startDate?: string; endDate?: string; branch?: string },
    ) => ["commits", "count", owner, repo, params] as const,
  },
  branches: {
    all: ["branches"] as const,
    list: (owner: string, repo: string) => ["branches", "list", owner, repo] as const,
  },
  credentials: {
    all: ["credentials"] as const,
  },
  chat: {
    all: ["chat"] as const,
    sessions: (projectId?: string) => ["chat", "sessions", { projectId }] as const,
    messages: (sessionId: string) => ["chat", "messages", sessionId] as const,
  },
};
