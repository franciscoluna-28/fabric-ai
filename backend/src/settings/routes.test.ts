import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "@/app";
import * as settingsServices from "@/settings/services";

vi.mock("@/settings/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/settings/services")>();
  return {
    ...actual,
    getAISettings: vi.fn(),
    updateAISettings: vi.fn(),
  };
});

const DEFAULT_SETTINGS = {
  reportProvider: "openrouter",
  reportModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
  embeddingProvider: "openrouter",
  embeddingModel: "openai/text-embedding-3-small",
};

describe("AI settings routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.mocked(settingsServices.getAISettings).mockReset();
    vi.mocked(settingsServices.updateAISettings).mockReset();
  });

  it("GET /api/v1/settings/ai returns global AI settings", async () => {
    vi.mocked(settingsServices.getAISettings).mockResolvedValue(DEFAULT_SETTINGS);

    const res = await app.inject({ method: "GET", url: "/api/v1/settings/ai" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(DEFAULT_SETTINGS);
  });

  it("PUT /api/v1/settings/ai updates and returns settings", async () => {
    const updated = {
      ...DEFAULT_SETTINGS,
      reportModel: "openai/gpt-4o",
      embeddingModel: "openai/text-embedding-3-large",
    };
    vi.mocked(settingsServices.updateAISettings).mockResolvedValue(updated);

    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/settings/ai",
      payload: {
        reportProvider: "openai",
        reportModel: "openai/gpt-4o",
        embeddingProvider: "openrouter",
        embeddingModel: "openai/text-embedding-3-large",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(updated);
    expect(settingsServices.updateAISettings).toHaveBeenCalledWith({
      reportProvider: "openai",
      reportModel: "openai/gpt-4o",
      embeddingProvider: "openrouter",
      embeddingModel: "openai/text-embedding-3-large",
    });
  });

  it("PUT /api/v1/settings/ai returns 400 for invalid provider", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/settings/ai",
      payload: {
        reportProvider: "nope",
        reportModel: "some/model",
        embeddingProvider: "openrouter",
        embeddingModel: "openai/text-embedding-3-small",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(settingsServices.updateAISettings).not.toHaveBeenCalled();
  });

  it("PUT /api/v1/settings/ai returns 400 for missing model", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/settings/ai",
      payload: {
        reportProvider: "openrouter",
        reportModel: "",
        embeddingProvider: "openrouter",
        embeddingModel: "openai/text-embedding-3-small",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /api/v1/settings/ai returns 500 when the store fails", async () => {
    vi.mocked(settingsServices.getAISettings).mockRejectedValue(new Error("db down"));

    const res = await app.inject({ method: "GET", url: "/api/v1/settings/ai" });
    expect(res.statusCode).toBe(500);
  });
});
