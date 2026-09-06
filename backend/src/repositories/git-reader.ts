import { logger } from "@/shared/logger";
import { runGit } from "@/repositories/git";

export type LocalCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  tree: string;
  parentSha: string | null;
};

// One record per commit: `sha US author US email US authorTs US tree US parents US body`,
// terminated by NUL (`-z`). `\x1f` is the field separator; the message is the
// last field so any `\x1f` inside it survives the split.
const FORMAT = "%H%x1f%an%x1f%ae%x1f%at%x1f%T%x1f%P%x1f%B";

/**
 * Lists commits reachable from `ref` whose author date falls within
 * `[since, until]`, newest-first.
 *
 * Reads with the native git binary. `--since` bounds the walk by committer
 * date — a safe superset of the author-date window (committer date is
 * essentially always >= author date) — then the exact author-date bounds are
 * applied in JS. `parentSha` is the first parent (null for root commits).
 */
export async function listCommitsInRange(opts: {
  dir: string;
  ref: string;
  since?: Date;
  until?: Date;
}): Promise<LocalCommit[]> {
  const start = performance.now();
  const sinceMs = opts.since?.getTime();

  const args = ["--no-pager", "log"];
  if (sinceMs !== undefined) {
    args.push(`--since=@${Math.floor(sinceMs / 1000)}`);
  }
  args.push("-z", `--pretty=format:${FORMAT}`, opts.ref);

  const stdout = await runGit({ cwd: opts.dir, args, label: "git log" });

  const untilMs = opts.until?.getTime();
  const commits: LocalCommit[] = [];
  for (const record of stdout.split("\0")) {
    const [sha, author, email, at, tree, parents, ...msgParts] = record.split("\x1f");
    if (!sha) continue;
    const atMs = Number(at) * 1000;
    if (Number.isNaN(atMs)) continue;
    if (sinceMs !== undefined && atMs < sinceMs) continue;
    if (untilMs !== undefined && atMs > untilMs) continue;
    commits.push({
      sha,
      message: (msgParts.join("\x1f") ?? "").trim(),
      author: author || email,
      date: new Date(atMs).toISOString(),
      tree,
      parentSha: parents?.split(" ")[0] || null,
    });
  }

  logger.info(
    {
      dir: opts.dir,
      ref: opts.ref,
      since: opts.since?.toISOString(),
      until: opts.until?.toISOString(),
      commitsFound: commits.length,
      durationMs: Math.round(performance.now() - start),
    },
    "listCommitsInRange complete",
  );

  return commits;
}
