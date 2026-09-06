import { env } from "@/config/env";
import { isProviderSupported } from "@/shared/integrations/providers/registry";
import * as settingsStore from "@/settings/stores/settings-store";
import type { AISettingsInput } from "@/settings/schemas";

export const GLOBAL_SETTINGS_ID = "global";

export type AISettings = {
  reportProvider: string;
  reportModel: string;
  embeddingProvider: string;
  embeddingModel: string;
};

export function defaultAISettings(): AISettings {
  return {
    reportProvider: "openrouter",
    reportModel: env.AI_MODEL,
    embeddingProvider: "openrouter",
    embeddingModel: env.EMBEDDING_MODEL,
  };
}

export async function getAISettings(): Promise<AISettings> {
  const row = await settingsStore.getSettings(GLOBAL_SETTINGS_ID);
  if (!row) return defaultAISettings();
  return {
    reportProvider: row.reportProvider,
    reportModel: row.reportModel,
    embeddingProvider: row.embeddingProvider,
    embeddingModel: row.embeddingModel,
  };
}

export async function updateAISettings(input: AISettingsInput): Promise<AISettings> {
  if (!isProviderSupported(input.reportProvider)) {
    throw new Error(`Unsupported provider: ${input.reportProvider}`);
  }

  await settingsStore.upsertSettings({
    id: GLOBAL_SETTINGS_ID,
    reportProvider: input.reportProvider,
    reportModel: input.reportModel,
    embeddingProvider: input.embeddingProvider,
    embeddingModel: input.embeddingModel,
  });

  return getAISettings();
}
