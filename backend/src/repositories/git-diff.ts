import { runGit } from "@/repositories/git";

export type FileChangeStatus = "added" | "deleted" | "modified";

export type FileChange = {
  filepath: string;
  status: FileChangeStatus;
};

export type CommitChangedStats = {
  filesChanged: number;
  files: FileChange[];
};

const STATUS_MAP: Record<string, FileChangeStatus> = {
  A: "added",
  D: "deleted",
};

/**
 * Lists the files changed by `commitSha` by asking the native git binary to
 * diff its tree against its parent's. The heavy work happens in git's own C
 * process, so it uses ~0 Node.js RAM and never blocks the event loop — the fix
 * for the pure-JS tree walk that starved the loop on large monorepos.
 *
 * - Non-root commits: two-arg `diff-tree <parent> <sha>` so merge commits diff
 *   against their first parent (the one-arg form silently skips merges).
 * - Root commits: `--root` diffs against the empty tree (every file added).
 */
export async function getCommitChangedFiles(opts: {
  dir: string;
  parentSha: string | null;
  commitSha: string;
}): Promise<CommitChangedStats> {
  const { dir, parentSha, commitSha } = opts;

  const args = [
    "--no-pager",
    "-c",
    "core.quotepath=false",
    "diff-tree",
    "--no-commit-id",
    "--name-status",
    "-z",
    "-r",
  ];
  if (parentSha) {
    args.push(parentSha, commitSha);
  } else {
    args.push("--root", commitSha);
  }

  const stdout = await runGit({ cwd: dir, args, label: "git diff-tree" });

  // `-z` emits `status\0path\0status\0path\0...` records.
  const tokens = stdout.split("\0");
  const files: FileChange[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const status = tokens[i];
    const filepath = tokens[i + 1];
    if (!status || !filepath) continue;
    files.push({ filepath, status: STATUS_MAP[status] ?? "modified" });
  }

  return { filesChanged: files.length, files };
}
