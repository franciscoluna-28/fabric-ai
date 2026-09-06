export const PROVIDER_REGISTRY = {
  openrouter: {
    sdk: "openrouter",
    defaultModel: "openai/gpt-5.6-luna",
    envKey: "OPENROUTER_API_KEY",
    verifyUrl: "https://openrouter.ai/api/v1/auth/key",
  },
  deepseek: {
    sdk: "openai-compatible",
    defaultModel: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    envKey: "DEEPSEEK_API_KEY",
    verifyUrl: "https://api.deepseek.com/v1/models",
  },
  openai: {
    sdk: "openai-compatible",
    defaultModel: "gpt-4o",
    baseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    verifyUrl: "https://api.openai.com/v1/models",
  },
} as const;

export type ProviderName = keyof typeof PROVIDER_REGISTRY;
export type ProviderConfig = (typeof PROVIDER_REGISTRY)[ProviderName];

export function getProviderConfig(provider: string): ProviderConfig | undefined {
  return PROVIDER_REGISTRY[provider as ProviderName];
}

export function isProviderSupported(provider: string): provider is ProviderName {
  return provider in PROVIDER_REGISTRY;
}
