import { execFile } from "node:child_process";
import { env } from "@/config/env";

const MAX_OUTPUT_BYTES = 100 * 1024 * 1024;

/**
 * Runs a native `git` command. Git executes in its own C process, so the
 * heavy work costs ~0 Node.js RAM and never blocks the event loop.
 *
 * `cwd` is optional — clone/fetch may need to run before the target dir
 * exists. Errors carry git's stderr (never the full argv, which could contain
 * the auth header token).
 */
export async function runGit(opts: {
  cwd?: string;
  args: string[];
  timeoutMs?: number;
  label?: string;
  env?: Record<string, string>;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      opts.args,
      {
        cwd: opts.cwd,
        maxBuffer: MAX_OUTPUT_BYTES,
        timeout: opts.timeoutMs,
        env: opts.env ? { ...process.env, ...opts.env } : undefined,
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = (stderr || "").trim();
          const err = new Error(`${opts.label ?? "git"} failed${detail ? `: ${detail}` : ""}`);
          if (/not found in upstream origin|couldn't find remote ref/i.test(stderr || "")) {
            (err as any).code = "BranchNotFound";
          }
          reject(err);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/**
 * Auth flags for GitHub HTTPS. The token travels via an extra HTTP header
 * (the GitHub Actions convention) so it never appears in the URL.
 */
export function authArgs(): string[] {
  if (!env.GITHUB_TOKEN) return [];
  const basic = Buffer.from(`x-access-token:${env.GITHUB_TOKEN}`).toString("base64");
  return ["-c", `http.extraheader=AUTHORIZATION: basic ${basic}`];
}
