import type { paths } from "@/src/shared/api/types";

export type GitHubRepository = {
  id: string;
  name: string;
  full_name: string;
  private: boolean;
  updated_at: string;
  owner: { login: string };
  default_branch?: string;
  stargazers_count?: number;
  forks_count?: number;
};

export type GitHubProject =
  paths["/api/v1/projects"]["get"]["responses"]["200"]["content"]["application/json"]["projects"][number];

export type ChatSession =
  paths["/api/v1/chat/sessions"]["get"]["responses"]["200"]["content"]["application/json"]["sessions"][number];

export type ChatMessage =
  paths["/api/v1/chat/sessions/{id}/messages"]["get"]["responses"]["200"]["content"]["application/json"]["messages"][number];
