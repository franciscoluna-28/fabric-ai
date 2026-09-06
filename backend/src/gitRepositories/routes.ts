import { FastifyRequest, FastifyReply } from "fastify";
import { getGitProvider } from "@/shared/integrations/git-provider";
import { ensureArchive } from "@/repositories/archive-service";
import { listCommitsInRange } from "@/repositories/git-reader";
import type { Static } from "@sinclair/typebox";
import {
  RepoOwnerParams,
  CommitsQuery,
  CommitsCountQuery,
  RepositoriesQuery,
} from "@/gitRepositories/schemas";

function parseDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

export async function listRepositories(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { type, sort, direction, per_page } = req.query as Static<typeof RepositoriesQuery>;

  try {
    const repositories = await getGitProvider().listRepositories({
      type: type || "all",
      sort: sort || "updated",
      direction: direction || "desc",
      perPage: per_page,
    });
    return reply.send(repositories);
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return reply.status(500).send({ error: "Failed to fetch repositories" });
  }
}

export async function listBranches(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { owner, repo } = req.params as Static<typeof RepoOwnerParams>;

  try {
    const provider = getGitProvider();
    const [branches, defaultBranch] = await Promise.all([
      provider.listBranches(owner, repo),
      provider.getDefaultBranch(owner, repo),
    ]);
    return reply.send({ branches, defaultBranch });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return reply.status(500).send({ error: "Failed to fetch branches" });
  }
}

/**
 * Archive-backed commit preview: reads commits directly from the local clone
 * of the branch (downloading it first if needed) — no per-item GitHub calls.
 */
export async function listCommits(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { owner, repo } = req.params as Static<typeof RepoOwnerParams>;
  const { limit, startDate, endDate, branch } = req.query as Static<typeof CommitsQuery>;
  const ref = branch || (await getGitProvider().getDefaultBranch(owner, repo));

  try {
    const archive = await ensureArchive({ owner, repo, branch: ref });
    const commits = await listCommitsInRange({
      dir: archive.dir,
      ref,
      since: parseDate(startDate),
      until: parseDate(endDate),
    });
    return reply.send({
      commits: commits.slice(0, limit).map((c) => ({
        sha: c.sha,
        message: c.message,
        author: c.author,
        date: c.date,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching commits:", error);
    if (error?.status === 404 || error?.status === 422 || error?.code === "NotFoundError") {
      return reply.status(400).send({
        error: "Branch or repository not found on GitHub. Check the branch name and repository access.",
      });
    }
    if (error?.code === "BranchNotFound") {
      return reply.status(400).send({
        error: `Branch "${ref}" not found in this repository. Check the branch name.`,
      });
    }
    return reply.status(500).send({ error: "Failed to fetch commits" });
  }
}

export async function countCommits(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { owner, repo } = req.params as Static<typeof RepoOwnerParams>;
  const { startDate, endDate, branch } = req.query as Static<typeof CommitsCountQuery>;
  const ref = branch || (await getGitProvider().getDefaultBranch(owner, repo));

  try {
    const archive = await ensureArchive({ owner, repo, branch: ref });
    const commits = await listCommitsInRange({
      dir: archive.dir,
      ref,
      since: parseDate(startDate),
      until: parseDate(endDate),
    });
    return reply.send({ count: commits.length });
  } catch (error: any) {
    console.error("Error fetching commit count:", error);
    if (error?.code === "BranchNotFound") {
      return reply.status(400).send({
        error: `Branch "${ref}" not found in this repository. Check the branch name.`,
      });
    }
    return reply.status(500).send({ error: "Failed to fetch commit count" });
  }
}
