import { FastifyRequest, FastifyReply } from "fastify";
import type { Static } from "@sinclair/typebox";
import { ModelsQuery } from "@/models/schemas";

const OPENROUTER_FALLBACK = [
  { id: "google/gemma-4-31b-it", name: "GPT-5.6 Luna", free: false, description: "" },
  { id: "google/gemma-4-31b-it", name: "Google: Gemma 4 31B", free: false, description: "" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra", free: true, description: "" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super", free: true, description: "" },
  { id: "inclusionai/ling-3.0-flash:free", name: "Ling 3.0 Flash", free: true, description: "" },
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS-20B", free: true, description: "" },
  { id: "cohere/north-mini-code:free", name: "North Mini Code", free: true, description: "" },
];

const DEEPSEEK_FALLBACK = [
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", free: false, description: "" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", free: false, description: "" },
  { id: "deepseek-chat", name: "DeepSeek Chat", free: false, description: "" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner", free: false, description: "" },
];

const OPENAI_FALLBACK = [
  { id: "gpt-4o", name: "GPT-4o", free: false, description: "" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", free: false, description: "" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", free: false, description: "" },
  { id: "o3-mini", name: "o3-mini", free: false, description: "" },
];

const PROVIDER_FALLBACKS: Record<string, typeof DEEPSEEK_FALLBACK> = {
  deepseek: DEEPSEEK_FALLBACK,
  openai: OPENAI_FALLBACK,
};

// MVP embedding models constrained to the vector(512) column. OpenRouter's
// embedding list does not expose output dimensions, so this allowlist is the
// source of truth. Both models are Matryoshka-reducible and support a 512-dim
// output via the `dimensions` param. text-embedding-ada-002 is excluded: it is
// locked at 1536 dims and rejects `dimensions`.
const EMBEDDING_MODEL_ALLOWLIST = new Set([
  "openai/text-embedding-3-small",
  "openai/text-embedding-3-large",
]);

function isFree(pricing: any): boolean {
  return !pricing || (pricing?.prompt == 0 && pricing?.completion == 0);
}

async function fetchOpenRouterEmbeddingModels() {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models?output_modalities=embeddings", {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data || [])
      .filter((m: any) => EMBEDDING_MODEL_ALLOWLIST.has(m.id))
      .map((m: any) => ({
        id: m.id,
        name: m.name,
        free: isFree(m.pricing),
        description: m.description || "",
        provider: "openrouter",
      }));
  } catch {
    return [];
  }
}

export async function listModels(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { provider, modality = "chat" } = req.query as Static<typeof ModelsQuery>;

  if (modality === "embeddings") {
    const models = await fetchOpenRouterEmbeddingModels();
    return reply.send({ models });
  }

  if (provider && provider !== "openrouter") {
    const list = PROVIDER_FALLBACKS[provider];
    if (!list) return reply.status(400).send({ error: `Unknown provider: ${provider}` });
    return reply.send({ models: list.map((m) => ({ ...m, provider })) });
  }

  let openrouterModels = OPENROUTER_FALLBACK;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      openrouterModels = (data?.data || [])
        .filter((m: any) => isFree(m.pricing))
        .map((m: any) => ({
          id: m.id,
          name: m.name,
          free: isFree(m.pricing),
          description: m.description || "",
        }));
    }
  } catch {}

  // The MVP default model must always be pickable even though the live fetch
  // only returns free models.
  const MVP_DEFAULT = "google/gemma-4-31b-it";
  if (!openrouterModels.some((m) => m.id === MVP_DEFAULT)) {
    openrouterModels = [
      { id: MVP_DEFAULT, name: "Google: Gemma 4 31B", free: false, description: "" },
      ...openrouterModels,
    ];
  }

  if (provider === "openrouter") {
    return reply.send({ models: openrouterModels.map((m) => ({ ...m, provider: "openrouter" })) });
  }

  const all = [
    ...openrouterModels.map((m) => ({ ...m, provider: "openrouter" as const })),
    ...DEEPSEEK_FALLBACK.map((m) => ({ ...m, provider: "deepseek" as const })),
    ...OPENAI_FALLBACK.map((m) => ({ ...m, provider: "openai" as const })),
  ];

  return reply.send({ models: all });
}
