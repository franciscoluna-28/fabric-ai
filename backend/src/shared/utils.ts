export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function startOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function endOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

export function extractReportTitle(markdown: string, fallback: string): string {
  const line = markdown
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("# ") && !l.startsWith("## "));
  return line ? line.replace(/^#\s+/, "").trim() : fallback;
}
