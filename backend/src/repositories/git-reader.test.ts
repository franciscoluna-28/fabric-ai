import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { listCommitsInRange } from "@/repositories/git-reader";
import { initRepo, addFile, commit } from "@/repositories/git-fixtures";

let dir: string;

async function makeCommit(opts: {
  message: string;
  files: { name: string; content: string }[];
  offsetSeconds: number;
}) {
  for (const f of opts.files) {
    await addFile(dir, f.name, f.content);
  }
  return commit(dir, opts.message, {
    authorDate: new Date(Date.now() - opts.offsetSeconds * 1000),
  });
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "gitreader-"));
  await initRepo(dir);
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("listCommitsInRange", () => {
  it("returns commits newest-first with parent linkage", async () => {
    await makeCommit({ message: "c1", files: [{ name: "a.txt", content: "hello\n" }], offsetSeconds: 600 });
    await makeCommit({ message: "c2", files: [{ name: "a.txt", content: "hello\nworld\n" }], offsetSeconds: 300 });
    await makeCommit({ message: "c3", files: [{ name: "b.txt", content: "b\n" }], offsetSeconds: 0 });

    const commits = await listCommitsInRange({ dir, ref: "master" });
    expect(commits.map((c) => c.message)).toEqual(["c3", "c2", "c1"]);
    expect(commits[0].parentSha).toBeTruthy();
    expect(commits[0].date).toBeTruthy();
    expect(commits[0].author).toBe("tester");
  });

  it("filters by since/until bounds", async () => {
    await makeCommit({ message: "old", files: [{ name: "a.txt", content: "a\n" }], offsetSeconds: 100 });
    await makeCommit({ message: "mid", files: [{ name: "a.txt", content: "a\nb\n" }], offsetSeconds: 50 });
    await makeCommit({ message: "new", files: [{ name: "a.txt", content: "a\nb\nc\n" }], offsetSeconds: 10 });

    const since = new Date(Date.now() - 60_000);
    const until = new Date(Date.now() - 30_000);
    const commits = await listCommitsInRange({ dir, ref: "master", since, until });
    expect(commits.map((c) => c.message)).toEqual(["mid"]);
  });
});
