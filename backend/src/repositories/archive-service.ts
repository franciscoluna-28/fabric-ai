import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { timed } from "@/shared/timing";
import { runGit, authArgs } from "@/repositories/git";

export type RepoArchive = {
  owner: string;
  repo: string;
  branch: string;
  dir: string;
  tipSha: string;
};

const TRANSFER_TIMEOUT_MS = 10 * 60 * 1000;
const archiveLocks = new Map<string, Promise<RepoArchive>>();

function archiveDir(owner: string, repo: string, branch: string): string {
  // Always use an absolute path. The clone runs from the archive parent, so a
  // relative destination would be resolved twice on Windows.
  return path.resolve(env.REPO_ARCHIVE_DIR, owner, repo, branch);
}

function remoteUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}

async function isRepo(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function removeIncompleteArchive(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    throw new Error(
      `Unable to clean incomplete repository archive at ${dir}: ${(error as Error).message}`,
    );
  }
}

/**
 * Ensures a local clone of `owner/repo` at `branch` under
 * `REPO_ARCHIVE_DIR/{owner}/{repo}/{branch}/`. Clones on first access with the
 * native `git` binary, then fetches to keep the branch current (incremental —
 * only new objects are transferred). Returns the archive dir and the resolved
 * tip SHA.
 *
 * The clone is bare-ish (`--no-checkout` — only `.git`, no working tree, since
 * nothing reads file contents). A plain `git fetch origin` updates the
 * remote-tracking ref; the local branch ref is then fast-forwarded with
 * `git update-ref` so the rest of the pipeline can keep reading `ref: branch`.
 *
 * This is the batch-ingestion source of truth: once cloned, every commit and
 * diff for the branch is read from disk — no per-item API calls, no
 * pagination, no watermark.
 */
async function ensureArchiveUnlocked(opts: {
  owner: string;
  repo: string;
  branch: string;
}): Promise<RepoArchive> {
  const { owner, repo, branch } = opts;
  const dir = archiveDir(owner, repo, branch);
  const url = remoteUrl(owner, repo);

  await fs.mkdir(path.dirname(dir), { recursive: true });

  const existed = await isRepo(dir);
  if (!existed) {
    // A clone interrupted before .git was created can leave the destination
    // behind. Git refuses to clone into any existing non-empty directory.
    await removeIncompleteArchive(dir);
    await fs.mkdir(path.dirname(dir), { recursive: true });
  }
  await timed(`archive.${existed ? "fetch" : "clone"}`, { owner, repo, branch, url }, async () => {
    if (existed) {
      await runGit({
        cwd: dir,
        args: [...authArgs(), "fetch", "origin"],
        timeoutMs: TRANSFER_TIMEOUT_MS,
        label: "git fetch",
      });
      const tip = (await runGit({ cwd: dir, args: ["rev-parse", `origin/${branch}`] })).trim();
      await runGit({
        cwd: dir,
        args: ["update-ref", `refs/heads/${branch}`, tip],
        label: "git update-ref",
      });
    } else {
      const cloneDir = `${dir}.clone-${randomUUID()}`;
      await runGit({
        cwd: path.dirname(dir),
        args: [
          ...authArgs(),
          "clone",
          "--single-branch",
          "--branch",
          branch,
          "--no-checkout",
          url,
          cloneDir,
        ],
        timeoutMs: TRANSFER_TIMEOUT_MS,
        label: "git clone",
      });
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rename(cloneDir, dir);
    }
  });

  const tipSha = (await runGit({ cwd: dir, args: ["rev-parse", branch] })).trim();
  logger.info(
    { owner, repo, branch, dir, tipSha, action: existed ? "fetch" : "clone" },
    "archive ready",
  );
  return { owner, repo, branch, dir, tipSha };
}

export async function ensureArchive(opts: {
  owner: string;
  repo: string;
  branch: string;
}): Promise<RepoArchive> {
  const dir = archiveDir(opts.owner, opts.repo, opts.branch);
  const active = archiveLocks.get(dir);
  if (active) return active;

  const operation = ensureArchiveUnlocked(opts).finally(() => {
    if (archiveLocks.get(dir) === operation) archiveLocks.delete(dir);
  });
  archiveLocks.set(dir, operation);
  return operation;
}
