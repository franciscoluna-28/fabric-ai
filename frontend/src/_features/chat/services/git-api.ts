"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";

export type RepoCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  url?: string;
};

export function useRepositories(filters: {
  type: string;
  sort: string;
  direction: string;
  per_page: number;
}) {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.repositories.list(filters),
    queryFn: () =>
      apiClient
        .GET("/api/v1/repositories", {
          params: {
            query: {
              type: filters.type,
              sort: filters.sort,
              direction: filters.direction,
              per_page: filters.per_page,
            },
          },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
  });

  return {
    repositories: data ?? [],
    isLoading,
    isValidating: isFetching,
    isFetching,
    error: error ?? null,
    hasError: !!error,
  };
}

export function useBranches(owner: string, repo: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.branches.list(owner, repo),
    queryFn: () =>
      apiClient
        .GET("/api/v1/repositories/{owner}/{repo}/branches", {
          params: { path: { owner, repo } },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    enabled: !!owner && !!repo,
  });

  return {
    branches: data?.branches ?? [],
    defaultBranch: data?.defaultBranch ?? null,
    isLoading,
    error: error ?? null,
  };
}