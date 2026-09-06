"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import type { GitHubProject } from "@/src/shared/types";

export function useProjects() {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.projects.list,
    queryFn: () =>
      apiClient.GET("/api/v1/projects").then((r) => {
        if (r.error) throw r.error;
        return r.data;
      }),
  });

  return {
    projects: (data?.projects ?? []) as GitHubProject[],
    isLoading,
    isFetching,
    error: error ?? null,
    hasError: !!error,
  };
}