import { describe, it, expect } from "vitest";
import { classifyCommit } from "@/repositories/guardrail";

describe("classifyCommit", () => {
  it("skips commits with no file changes", () => {
    const result = classifyCommit({ message: "merge branch", filesChanged: 0 });
    expect(result.status).toBe("skipped");
    expect(result.notes).toContain("no files changed");
  });

  it("confirms a descriptive message consistent with the diff", () => {
    const result = classifyCommit({ message: "feat: add login flow", filesChanged: 3 });
    expect(result.status).toBe("confirmed");
    expect(result.notes).toEqual([]);
  });

  it("flags a junk conventional message like fix: lol", () => {
    const result = classifyCommit({ message: "fix: lol", filesChanged: 12 });
    expect(result.status).toBe("flagged");
    expect(result.notes.some((n) => n.includes("uninformative"))).toBe(true);
  });

  it("flags very short messages", () => {
    const result = classifyCommit({ message: "x", filesChanged: 1 });
    expect(result.status).toBe("flagged");
    expect(result.notes.some((n) => n.includes("too short"))).toBe(true);
  });

  it("flags a message that claims more files than the diff shows", () => {
    const result = classifyCommit({ message: "changed 12 files", filesChanged: 2 });
    expect(result.status).toBe("flagged");
    expect(result.notes.some((n) => n.includes("claims 12 file(s) changed"))).toBe(true);
  });

  it("strips conventional prefixes and ticket refs before judging", () => {
    expect(classifyCommit({ message: "ABC-123: fix: wip", filesChanged: 5 }).status).toBe(
      "flagged",
    );
    expect(classifyCommit({ message: "[JIRA-9] chore(deps): bump lodash", filesChanged: 1 }).status).toBe(
      "confirmed",
    );
  });
});
