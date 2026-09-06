import { Type } from "@sinclair/typebox";

export const ModelsQuery = Type.Object({
  provider: Type.Optional(Type.String()),
  modality: Type.Optional(Type.Union([Type.Literal("chat"), Type.Literal("embeddings")])),
});

export const ModelsResponse = Type.Object({
  models: Type.Array(
    Type.Object({
      id: Type.String(),
      name: Type.String(),
      free: Type.Boolean(),
      description: Type.String(),
      provider: Type.String(),
    }),
  ),
});
