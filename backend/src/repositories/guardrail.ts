export type CommitValidationStatus = "confirmed" | "flagged" | "skipped";

export type CommitGuardResult = {
  status: CommitValidationStatus;
  notes: string[];
};

const JUNK_PATTERN =
  /^(wip|work in progress|no message|lorem( ipsum)?|asdf+?|qwerty|placeholder|todo|lol|stuff|misc|minor|update|updates?|fix stuff|small fix|fixing stuff|changed? stuff|cleanup|refactor|test[s]?)$/i;

const FILES_CLAIM_PATTERN =
  /(?:changed|modified|added|updated|deleted|touched)\s+(\d+)\s*files?|(\d+)\s*files?\s+(?:changed|modified|added|updated|deleted|touched)/i;

/**
 * Strips conventional-commit prefixes (`fix:`, `feat(scope):`), ticket refs
 * (`[ABC-123]`, `ABC-123:`), and stray separators so junk detection measures
 * the actual description rather than scaffolding.
 */
function stripMessageDecoration(subject: string): string {
  let result = subject;
  let changed = true;
  while (changed) {
    changed = false;
    const next = result
      .replace(/^[a-z]+(\([^)]*\))?(!)?:\s*/i, "")
      .replace(/^\[[^\]]*\]\s*/, "")
      .replace(/^[A-Z][A-Z0-9]+-\d+\s*/, "")
      .replace(/^[:,\-\s]+/, "")
      .trim();
    if (next !== result) {
      result = next;
      changed = true;
    }
  }
  return result;
}

function claimsFileCount(subject: string): number | null {
  const match = subject.match(FILES_CLAIM_PATTERN);
  if (!match) return null;
  return parseInt(match[1] ?? match[2] ?? "", 10) || null;
}

/**
 * Classifies a commit against the changes actually present in its diff.
 * The diff stats are ground truth (read from git objects); the message can lie.
 *
 * - `skipped`: no files changed (empty or merge no-op) — exclude from reports.
 * - `flagged`: the message is uninformative or contradicts the diff — keep the
 *   commit but make the report rely on the real scope, not the message.
 * - `confirmed`: message and diff are consistent enough to trust.
 */
export function classifyCommit(opts: {
  message: string;
  filesChanged: number;
}): CommitGuardResult {
  if (opts.filesChanged === 0) {
    return { status: "skipped", notes: ["no files changed"] };
  }

  const subject = (opts.message.split("\n")[0] ?? "").trim();
  const body = stripMessageDecoration(subject);
  const notes: string[] = [];

  if (body.length < 3) {
    notes.push(`message too short to describe the change: "${subject}"`);
  } else if (JUNK_PATTERN.test(body)) {
    notes.push(`message looks uninformative: "${subject}"`);
  }

  const claimed = claimsFileCount(subject);
  if (claimed !== null && claimed !== opts.filesChanged) {
    notes.push(
      `message claims ${claimed} file(s) changed but the diff shows ${opts.filesChanged}`,
    );
  }

  if (notes.length > 0) {
    return { status: "flagged", notes };
  }
  return { status: "confirmed", notes: [] };
}
