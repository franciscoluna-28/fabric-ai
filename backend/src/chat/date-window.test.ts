import { describe, expect, it } from "vitest";
import { parseQueryWindow } from "@/chat/date-window";

const NOW = new Date("2026-08-30T12:00:00.000Z");

describe("parseQueryWindow", () => {
  it("filters from a month forward in Spanish", () => {
    const result = parseQueryWindow("muéstrame solo lo de junio para acá", NOW);

    expect(result.startDate).toEqual(new Date("2026-06-01T00:00:00.000Z"));
    expect(result.endDate).toBeUndefined();
    expect(result.filteredQuery).toContain("muéstrame solo lo");
  });

  it("filters a month forward in English", () => {
    const result = parseQueryWindow("what changed since June 2024?", NOW);

    expect(result.startDate).toEqual(new Date("2024-06-01T00:00:00.000Z"));
    expect(result.endDate).toBeUndefined();
    expect(result.filteredQuery).toBe("what changed ?");
  });

  it("filters an inclusive date range", () => {
    const result = parseQueryWindow(
      "show releases between 2024-06-01 and 2024-06-30",
      NOW,
    );

    expect(result.startDate).toEqual(new Date("2024-06-01T00:00:00.000Z"));
    expect(result.endDate).toEqual(new Date("2024-06-30T23:59:59.999Z"));
  });

  it("filters relative periods", () => {
    const result = parseQueryWindow("what shipped in the last 30 days", NOW);

    expect(result.startDate).toEqual(new Date("2026-07-31T12:00:00.000Z"));
    expect(result.endDate).toEqual(NOW);
  });

  it("does not invent a date filter for ordinary questions", () => {
    const result = parseQueryWindow("what changed in the chat system?", NOW);

    expect(result.startDate).toBeUndefined();
    expect(result.endDate).toBeUndefined();
    expect(result.filteredQuery).toBe("what changed in the chat system?");
  });
});
