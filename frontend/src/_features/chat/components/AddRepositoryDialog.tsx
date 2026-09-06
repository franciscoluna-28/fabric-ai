"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Input } from "@/src/components/ui/input";
import { Link2, GitBranch, Plus } from "lucide-react";
import { parseRepoUrl } from "@/src/shared/utils/repo-url";
import { useRepositories } from "@/src/_features/chat/services/git-api";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import { apiClient, API_URL } from "@/src/shared/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/src/shared/services/keys";
import { toast } from "sonner";
import type { GitHubRepository } from "@/src/shared/types";

type Props = {
  onProjectSelected: (projectId: string) => void;
  children?: React.ReactNode;
};

export function AddRepositoryDialog({ onProjectSelected, children }: Props) {
  const queryClient = useQueryClient();
  const { repositories, isFetching } = useRepositories({
    type: "all",
    sort: "updated",
    direction: "desc",
    per_page: 50,
  });
  const { projects } = useProjects();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const existingProjectIds = new Set(
    projects.flatMap((p) => [p.providerProjectId]),
  );

  const handleSelect = async (repo: GitHubRepository) => {
    setConnecting(true);
    try {
      const existing = projects.find(
        (p) =>
          p.providerProjectId === repo.id &&
          p.providerOwner === repo.owner.login,
      );
      if (existing) {
        onProjectSelected(existing.id);
        setOpen(false);
        toast.success(`Switched to ${repo.name}`);
        return;
      }

      const res = await fetch(`${API_URL}/api/v1/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gitProvider: "github",
          providerProjectId: repo.id,
          providerOwner: repo.owner.login,
          repositoryName: repo.name,
          defaultBranch: repo.default_branch ?? "main",
        }),
      });
      if (!res.ok) {
        toast.error("Failed to connect repository");
        return;
      }
      const data = await res.json();

      await queryClient.invalidateQueries({
        queryKey: queryKeys.projects.list,
      });

      onProjectSelected(data.id);
      setOpen(false);
      toast.success(`Connected to ${repo.name}`);
    } finally {
      setConnecting(false);
    }
  };

  const handlePasteConnect = async () => {
    const parsed = parseRepoUrl(value);
    if (!parsed) {
      setError(
        "Enter a valid GitHub URL or owner/repo, e.g. https://github.com/owner/repo",
      );
      return;
    }
    setError(null);
    setValue("");

    setConnecting(true);
    try {
      const existing = projects.find(
        (p) =>
          p.providerOwner === parsed.owner &&
          p.repositoryName === parsed.repo,
      );
      if (existing) {
        onProjectSelected(existing.id);
        setOpen(false);
        toast.success(`Switched to ${parsed.owner}/${parsed.repo}`);
        return;
      }

      const res = await fetch(`${API_URL}/api/v1/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gitProvider: "github",
          providerProjectId: `${parsed.owner}/${parsed.repo}`,
          providerOwner: parsed.owner,
          repositoryName: parsed.repo,
          defaultBranch: "main",
        }),
      });
      if (!res.ok) {
        toast.error("Failed to connect repository");
        return;
      }
      const data = await res.json();

      await queryClient.invalidateQueries({
        queryKey: queryKeys.projects.list,
      });

      onProjectSelected(data.id);
      setOpen(false);
      toast.success(`Connected to ${parsed.owner}/${parsed.repo}`);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Plus className="size-4" />
            Connect repository
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect a repository</DialogTitle>
          <DialogDescription>
            Pick from your GitHub repos or paste a URL.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Paste a GitHub URL or owner/repo"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePasteConnect();
              }}
            />
          </div>
          <Button onClick={handlePasteConnect} disabled={connecting}>
            Connect
          </Button>
        </div>
        {error && (
          <p className="text-xs text-red-500 -mt-2">{error}</p>
        )}

        <div className="text-xs text-muted-foreground">
          Or select from your repositories:
        </div>

        <ScrollArea className="h-64">
          <div className="space-y-1 pr-2">
            {isFetching ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Loading repositories...
              </p>
            ) : repositories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No repositories found. Check your GITHUB_TOKEN.
              </p>
            ) : (
              (repositories as GitHubRepository[]).map((repo) => {
                const isConnected = existingProjectIds.has(repo.id);
                return (
                  <button
                    key={repo.id}
                    onClick={() => handleSelect(repo)}
                    disabled={connecting}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">
                        {repo.owner.login}/{repo.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {repo.default_branch ?? "main"}
                        {isConnected && " · Already connected"}
                      </p>
                    </div>
                    {isConnected && (
                      <span className="text-xs text-muted-foreground">
                        Connected
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}