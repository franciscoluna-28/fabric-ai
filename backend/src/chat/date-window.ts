import { startOfDayUtc, endOfDayUtc } from "@/shared/utils";

export type DateWindow = {
  startDate?: Date;
  endDate?: Date;
};

export type ParsedQueryWindow = DateWindow & {
  /** The query with temporal clauses stripped, for keyword matching. */
  filteredQuery: string;
};

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const UNIT_MS: Record<string, number> = {
  day: 86_400_000, days: 86_400_000,
  week: 604_800_000, weeks: 604_800_000,
  month: 2_592_000_000, months: 2_592_000_000,
  year: 31_536_000_000, years: 31_536_000_000,
  "día": 86_400_000, "días": 86_400_000,
  semana: 604_800_000, semanas: 604_800_000,
  mes: 2_592_000_000, meses: 2_592_000_000,
  año: 31_536_000_000, años: 31_536_000_000,
};

const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;
const escape = (s: string) => s.replace(REGEX_ESCAPE, "\\$&");

const DAY_MS = 86_400_000;

function monthNumber(name: string): number | undefined {
  return MONTHS[name.toLowerCase()];
}

function startOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

function startOfWeek(now: Date): Date {
  const day = now.getUTCDay() || 7;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

function stripPhrase(query: string, phrase: string): string {
  if (!phrase) return query;
  return query.replace(new RegExp(escape(phrase), "i"), " ").replace(/\s+/g, " ").trim();
}

type Token =
  | { kind: "day"; date: Date }
  | { kind: "month"; month: number; year: number }
  | { kind: "year"; year: number };

function parseDateToken(raw: string): Token | null {
  const text = raw.trim();
  let m: RegExpMatchArray | null;

  m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { kind: "day", date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) };

  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { kind: "day", date: new Date(Date.UTC(+m[3], +m[1] - 1, +m[2])) };

  m = text.match(new RegExp(`^(${MONTH_PATTERN})(?:\\s+(\\d{4}))?$`, "i"));
  if (m) {
    const month = monthNumber(m[1]);
    if (month) {
      return {
        kind: "month",
        month,
        year: m[2] ? +m[2] : new Date().getUTCFullYear(),
      };
    }
  }

  m = text.match(/^(\d{4})$/);
  if (m) return { kind: "year", year: +m[1] };

  return null;
}

function tokenWindow(token: Token): DateWindow {
  if (token.kind === "day") {
    const iso = token.date.toISOString().slice(0, 10);
    return { startDate: startOfDayUtc(iso), endDate: endOfDayUtc(iso) };
  }
  if (token.kind === "month") {
    return {
      startDate: startOfMonth(token.year, token.month),
      endDate: endOfMonth(token.year, token.month),
    };
  }
  return {
    startDate: new Date(Date.UTC(token.year, 0, 1)),
    endDate: new Date(Date.UTC(token.year, 11, 31, 23, 59, 59, 999)),
  };
}

function matchRelativeWindow(query: string, now: Date): DateWindow | null {
  const last = query.match(
    new RegExp(
      `\\b(?:last|past|previous|últimos?|pasados?)\\s+(\\d{1,3})\\s+(days?|weeks?|months?|years?|días?|semanas?|meses?|años?)\\b`,
      "i",
    ),
  );
  if (last) {
    const n = +last[1];
    const unit = last[2].toLowerCase();
    const ms = UNIT_MS[unit];
    return ms ? { startDate: new Date(now.getTime() - n * ms), endDate: now } : null;
  }

  const thisPeriod = query.match(
    new RegExp(`\\b(?:this|esta|este)\\s+(week|month|year|semana|mes|año)\\b`, "i"),
  );
  if (thisPeriod) {
    const p = thisPeriod[1].toLowerCase();
    let start: Date;
    if (p === "week" || p === "semana") start = startOfWeek(now);
    else if (p === "month" || p === "mes") start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    else start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return { startDate: start, endDate: now };
  }

  const lastPeriod = query.match(
    new RegExp(`\\b(?:last|previous)\\s+(week|month|year)\\b`, "i"),
  );
  if (lastPeriod) {
    const p = lastPeriod[1].toLowerCase();
    if (p === "week") {
      const weekStart = startOfWeek(now);
      return { startDate: new Date(weekStart.getTime() - 7 * DAY_MS), endDate: new Date(weekStart.getTime() - 1) };
    }
    if (p === "month") {
      return {
        startDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
        endDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999)),
      };
    }
    return {
      startDate: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)),
      endDate: new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31, 23, 59, 59, 999)),
    };
  }

  return null;
}

function findTemporalPhrase(query: string): { phrase: string; token: Token | null } | null {
  const dateToken = query.match(
    new RegExp(`(${MONTH_PATTERN})(?:\\s+(\\d{4}))?|(\\d{4})-\\d{1,2}-\\d{1,2}|\\d{1,2}\\/\\d{1,2}\\/\\d{4}`, "i"),
  );
  if (!dateToken) return null;
  const phrase = dateToken[0];
  const token = parseDateToken(phrase);
  return token ? { phrase, token } : null;
}

/**
 * Parses natural-language temporal constraints ("since june", "last 30 days",
 * "de junio para acá", "between 2024-01-01 and 2024-06-01") into a
 * `{ startDate, endDate }` window applied as metadata filtering on
 * `committed_at` before the vector search.
 */
export function parseQueryWindow(query: string, now: Date = new Date()): ParsedQueryWindow {
  // "from X to Y" / "between X and Y" => startDate = X.start, endDate = Y.end
  const range = query.match(
    new RegExp(
      `\\b(?:from|between|entre)\\s+([\\w./-]+)\\s+(?:to|and|y)\\s+([\\w./-]+)`,
      "i",
    ),
  );
  if (range) {
    const a = parseDateToken(range[1]);
    const b = parseDateToken(range[2]);
    if (a && b) {
      const wa = tokenWindow(a);
      const wb = tokenWindow(b);
      return {
        startDate: wa.startDate,
        endDate: wb.endDate,
        filteredQuery: stripPhrase(query, range[0]),
      };
    }
  }

  // Relative windows: "last 30 days", "this month", "last week"
  const relative = matchRelativeWindow(query, now);
  if (relative) {
    const phrase = query.match(/last|past|previous|this|últimos?|pasados?/i)?.[0] ?? "";
    let filteredQuery = query;
    if (phrase) {
      const idx = query.indexOf(phrase);
      if (idx >= 0) filteredQuery = query.slice(0, idx).trim();
    }
    return { ...relative, filteredQuery };
  }

  // "before X" / "until X" / "hasta X" => endDate (exclusive, last ms before X)
  const before = query.match(
    new RegExp(
      `\\b(?:before|until|up to|hasta|antes de)\\s+((?:${MONTH_PATTERN})(?:\\s+20\\d{2})?|20\\d{2}-\\d{1,2}-\\d{1,2}|\\d{1,2}\\/\\d{1,2}\\/20\\d{2}|20\\d{2})`,
      "i",
    ),
  );
  if (before) {
    const token = parseDateToken(before[1]);
    if (token) {
      const w = tokenWindow(token);
      return {
        startDate: undefined,
        endDate: w.startDate ? new Date(w.startDate.getTime() - 1) : w.endDate,
        filteredQuery: stripPhrase(query, before[0]),
      };
    }
  }

  // "after X" / "since X" / "from X" / "desde X" => startDate
  const after = query.match(
    new RegExp(
      `\\b(?:since|after|starting|from|desde|a partir de|después de|de)\\s+((?:${MONTH_PATTERN})(?:\\s+20\\d{2})?|20\\d{2}-\\d{1,2}-\\d{1,2}|\\d{1,2}\\/\\d{1,2}\\/20\\d{2}|20\\d{2})(?:\\s+para\\s+acá)?`,
      "i",
    ),
  );
  if (after) {
    const token = parseDateToken(after[1]);
    if (token) {
      const w = tokenWindow(token);
      return {
        startDate: w.startDate,
        endDate: undefined,
        filteredQuery: stripPhrase(query, after[0]),
      };
    }
  }

  // Bare date reference ("june 2024", "in june", "2024", "2024-06-01")
  const bare = findTemporalPhrase(query);
  if (bare?.token) {
    const w = tokenWindow(bare.token);
    return {
      startDate: w.startDate,
      endDate: w.endDate,
      filteredQuery: stripPhrase(query, bare.phrase),
    };
  }

  return { filteredQuery: query };
}
