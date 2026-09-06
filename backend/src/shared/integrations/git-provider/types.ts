export interface Repository {
  id: string;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  description: string | null;
  default_branch: string;
  updated_at: string;
  stargazers_count?: number;
  forks_count?: number;
}

export interface RepositoryFilters {
  type?: string;
  sort?: string;
  direction?: string;
  perPage?: number;
}

export interface ConnectionStatus {
  login: string;
  rateLimitRemaining: number;
}
