"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { queryKeys } from "./keys";

export function useModels(provider?: string, modality?: "chat" | "embeddings") {
  const query = { provider, modality };

  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.models.list(provider, modality),
    queryFn: () =>
      apiClient.GET("/api/v1/models", { params: { query } }).then((r) => {
        if (r.error) throw r.error;
        return r.data;
      }),
  });

  return {
    models: data?.models ?? [],
    isLoading,
    error: error ?? null,
  };
}
