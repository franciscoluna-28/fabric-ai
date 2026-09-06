import fs from "node:fs/promises";
import path from "node:path";
import { runGit } from "@/repositories/git";

const COMMIT_ENV: Record<string, string> = {
  GIT_AUTHOR_NAME: "tester",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "tester",
  GIT_COMMITTER_EMAIL: "t@example.com",
};

export async function initRepo(dir: string): Promise<void> {
  await runGit({ cwd: dir, args: ["init", "-b", "master", "-q"] });
}

export async function addFile(
  dir: string,
  name: string,
  content: string | Buffer,
): Promise<void> {
  const p = path.join(dir, name);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content);
  await runGit({ cwd: dir, args: ["add", "--", name] });
}

export async function removeFile(dir: string, name: string): Promise<void> {
  await runGit({ cwd: dir, args: ["rm", "-q", "--", name] });
}

export async function commit(
  dir: string,
  message: string,
  opts?: { authorDate?: Date; allowEmpty?: boolean },
): Promise<string> {
  const args = ["commit"];
  if (opts?.allowEmpty) args.push("--allow-empty");
  args.push("-q", "-m", message);

  const env = { ...COMMIT_ENV };
  if (opts?.authorDate) {
    env.GIT_AUTHOR_DATE = `@${Math.floor(opts.authorDate.getTime() / 1000)}`;
  }

  await runGit({ cwd: dir, args, env, label: "git commit" });
  return (await runGit({ cwd: dir, args: ["rev-parse", "HEAD"] })).trim();
}
