import type { ChatCitation } from "@/db/schema";

const SYSTEM_PROMPT = `You are Scrapecat, an engineering intelligence assistant. You answer questions about a repository's engineering history — what changed, who changed it, and when.

Rules:
- Answer ONLY from the retrieved commits provided in the context. Never invent facts, dates, or commits.
- Group related commits into feature-level summaries. Use descriptive headings such as "Features", "Bug fixes", "Refactors", "Infrastructure", "Documentation".
- Focus on the major changes: features, breaking changes, PR merges, and large refactors. Minor fixes and chores can be grouped under a single line or omitted.
- Do NOT list commits individually. Only reference specific SHAs if the user explicitly asks for details.
- If the retrieved commits do not contain the answer, say so directly instead of guessing.
- If the question is out of context, fallback to "I'm sorry, I cannot help with this question as it is out of my scope."
- Be concise and factual. Use markdown bullets when a list helps.
- When the user asks for a report or a broader summary, wrap your response in a :::report block. Inside the block, use markdown headings and bullets. The report block will be rendered as a special card. Example:
  :::report
  ## What shipped
  - Feature A (description)
  - Bug fix B
  :::`;

export const MAX_FILES_SHOWN = 6;

export function buildSystemPrompt(repository?: string | null): string {
  return repository
    ? `${SYSTEM_PROMPT}\n\nYou are answering about the repository: ${repository}.`
    : SYSTEM_PROMPT;
}

export function formatCitationForPrompt(c: ChatCitation): string {
  const files = c.filesChanged.slice(0, MAX_FILES_SHOWN);
  const lines = [
    `- SHA: ${c.commitSha}`,
    `  Message: ${c.commitMessage}`,
    `  Author: ${c.author ?? "unknown"}`,
    `  Date: ${c.committedAt}`,
  ];
  if (files.length > 0) {
    const extra = c.filesChanged.length > MAX_FILES_SHOWN
      ? `, +${c.filesChanged.length - MAX_FILES_SHOWN} more`
      : "";
    lines.push(`  Files: ${files.join(", ")}${extra}`);
  }
  if (c.commitUrl) lines.push(`  URL: ${c.commitUrl}`);
  return lines.join("\n");
}

export function buildUserMessage(
  query: string,
  citations: ChatCitation[],
  scope?: { branch?: string | null; startDate?: Date; endDate?: Date },
): string {
  const context = citations.map(formatCitationForPrompt).join("\n");
  const filters = [
    scope?.branch ? `Branch: ${scope.branch}` : "Branch: all branches",
    scope?.startDate ? `From: ${scope.startDate.toISOString()}` : null,
    scope?.endDate ? `To: ${scope.endDate.toISOString()}` : null,
  ].filter(Boolean).join("\n");
  return [
    "Summarize the retrieved commits below at a feature level. Group related changes under descriptive headings. Focus on the most impactful changes — features, bug fixes, refactors, and infrastructure. Do not list commits individually.",
    "If no commits were retrieved, explicitly say that no indexed commits matched the requested branch/date scope. Do not infer that nothing changed outside that scope.",
    "",
    "Retrieval scope:",
    filters,
    "",
    "Retrieved commits:",
    context || "(no relevant commits retrieved)",
    "",
    `Question: ${query}`,
  ].join("\n");
}