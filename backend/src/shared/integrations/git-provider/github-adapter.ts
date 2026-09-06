import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
import type { GitProvider } from "@/shared/integrations/git-provider/provider";
import type {
  Repository,
  RepositoryFilters,
  ConnectionStatus,
} from "@/shared/integrations/git-provider/types";

const MyOctokit = Octokit.plugin(throttling, retry);

function createOctokit(token: string) {
  return new MyOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter: number, options: any, _client: any, retryCount: number) => {
        console.warn(`Rate limit hit for ${options.method} ${options.url}`);
        if (retryCount < 3) {
          console.info(`Retrying after ${retryAfter} seconds`);
          return true;
        }
        return false;
      },
      onSecondaryRateLimit: (_retryAfter: number, options: any, _client: any) => {
        console.warn(`Secondary rate limit for ${options.method} ${options.url}`);
      },
    },
    retry: { doNotRetry: [400, 401, 403, 404, 410, 422, 451] },
  });
}

function toRepository(raw: any): Repository {
  return {
    id: String(raw.id),
    name: raw.name,
    full_name: raw.full_name,
    owner: { login: raw.owner?.login ?? "" },
    private: raw.private,
    description: raw.description ?? null,
    default_branch: raw.default_branch,
    updated_at: raw.updated_at,
    stargazers_count: raw.stargazers_count,
    forks_count: raw.forks_count,
  };
}

export class GithubAdapter implements GitProvider {
  private octokit: InstanceType<typeof MyOctokit>;

  constructor(token: string) {
    this.octokit = createOctokit(token);
  }

  async listRepositories(filters?: RepositoryFilters): Promise<Repository[]> {
    const { data } = await this.octokit.request("GET /user/repos", {
      type: filters?.type || "public" as any,
      sort: filters?.sort || "updated" as any,
      direction: filters?.direction || "desc" as any,
      per_page: filters?.perPage || 10,
    });
    return data.map(toRepository);
  }

  /**
   * Lists every branch of a repository, walking pages with a simple loop.
   * Discovery only — commits are read from the local archive, never the API.
   */
  async listBranches(owner: string, repo: string): Promise<string[]> {
    const branches: string[] = [];
    for (let page = 1; ; page++) {
      const { data } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/branches",
        { owner, repo, per_page: 100, page },
      );
      branches.push(...data.map((branch: any) => branch.name));
      if (data.length < 100) break;
    }
    return branches;
  }

  /**
   * Resolves the repository's default branch (e.g. `main`, `master`, `canary`).
   * Repos don't always have `main` — defaulting to a hardcoded branch name is a
   * bug (next.js's default is `canary`).
   */
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const { data } = await this.octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
    });
    return data.default_branch;
  }

  async verifyConnection(): Promise<ConnectionStatus> {
    const response = await this.octokit.request("GET /user", {
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
    });
    const rateLimitRemaining = parseInt(
      response.headers["x-ratelimit-remaining"] as string,
      10,
    );
    return {
      login: response.data.login,
      rateLimitRemaining: isNaN(rateLimitRemaining) ? 5000 : rateLimitRemaining,
    };
  }
}
