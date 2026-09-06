import { env } from "@/config/env";
import { GithubAdapter } from "@/shared/integrations/git-provider/github-adapter";

export type { GitProvider } from "@/shared/integrations/git-provider/provider";
export type {
  Repository,
  RepositoryFilters,
  ConnectionStatus,
} from "@/shared/integrations/git-provider/types";

let provider: ReturnType<typeof createProvider> | null = null;

function createProvider() {
  if (env.GIT_PROVIDER === "github" || !env.GIT_PROVIDER) {
    return new GithubAdapter(env.GITHUB_TOKEN);
  }
  return new GithubAdapter(env.GITHUB_TOKEN);
}

export function getGitProvider() {
  if (!provider) {
    provider = createProvider();
  }
  return provider;
}
