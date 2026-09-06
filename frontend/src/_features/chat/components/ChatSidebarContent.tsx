"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/src/components/ui/sidebar";
import {
  useChatSessions,
  useDeleteChatSession,
} from "@/src/_features/chat/services/chat-api";
import { AddRepositoryDialog } from "@/src/_features/chat/components/AddRepositoryDialog";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import { cn } from "@/src/shared/lib/utils";
import {
  ChevronRight,
  Key,
  Settings,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";

const NAV_ITEMS = [
  { id: "credentials", label: "API Keys", icon: Key, route: "/app/api-keys" },
  { id: "settings", label: "Settings", icon: Settings, route: "/app/settings" },
] as const;

export function ChatSidebarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { projects, isLoading: projectsLoading } = useProjects();

  const projectId = searchParams.get("project");
  const sessionId = searchParams.get("session");

  const { sessions, isLoading: sessionsLoading } = useChatSessions(projectId ?? undefined);
  const deleteSession = useDeleteChatSession();

  const [expanded, setExpanded] = useState(true);

  const navigate = (params: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) p.set(k, v);
    }
    const url = p.toString() ? `/app?${p.toString()}` : "/app";
    router.push(url);
  };

  const handleSessionClick = (sid: string) => {
    navigate({ project: projectId, session: sid, branch: null });
  };

  const handleDeleteSession = async (sid: string) => {
    await deleteSession.mutateAsync(sid);
  };

  const isActive = (route: string) => pathname.startsWith(route);

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {projectsLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground text-center">
            No projects synced yet
          </p>
          <AddRepositoryDialog onProjectSelected={(id) => navigate({ project: id })}>
            <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              Connect repository
            </span>
          </AddRepositoryDialog>
        </div>
      ) : (
        <>
          <div className="flex py-1">
            <AddRepositoryDialog onProjectSelected={(id) => navigate({ project: id })}>
             <Button variant="outline" className="w-full">
                <Plus className="size-3" />
                Connect repository
              </Button>
            </AddRepositoryDialog>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Projects</p>
          <SidebarMenu className="gap-0">
            {projects.map((p) => {
              const isActiveProject = p.id === projectId;
              const projectSessions = isActiveProject ? sessions : [];

              return (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton
                    isActive={isActiveProject}
                    tooltip={p.repositoryName}
                    onClick={() => {
                      if (isActiveProject) {
                        setExpanded(!expanded);
                      } else {
                        navigate({ project: p.id, session: null, branch: null });
                        setExpanded(true);
                      }
                    }}
                  >
                    <ChevronRight
                      className={cn(
                        "size-3 shrink-0 transition-transform",
                        isActiveProject && expanded && "rotate-90",
                      )}
                    />
                    <span className="truncate">{p.repositoryName}</span>
                  </SidebarMenuButton>
                  {isActiveProject && expanded && (
                    <SidebarMenuSub>
                      {sessionsLoading ? (
                        <SidebarMenuSubItem>
                          <span className="text-xs text-muted-foreground px-2">Loading...</span>
                        </SidebarMenuSubItem>
                      ) : projectSessions.length === 0 ? (
                        <SidebarMenuSubItem>
                          <span className="text-xs text-muted-foreground px-2">No chats yet</span>
                        </SidebarMenuSubItem>
                      ) : (
                        projectSessions.map((s) => (
                          <SidebarMenuSubItem key={s.id}>
                            <SidebarMenuSubButton
                              isActive={s.id === sessionId}
                              onClick={() => handleSessionClick(s.id)}
                              className="group"
                            >
                              <span className="flex-1 truncate text-xs">
                                {s.title === "New chat"
                                  ? new Date(s.updatedAt).toLocaleDateString("en-US")
                                  : s.title}
                              </span>
                              <button
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 ml-auto"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSession(s.id);
                                }}
                                aria-label="Delete chat"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))
                      )}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>

          <p className="text-xs font-medium text-muted-foreground mt-2">Navigation</p>
          <SidebarMenu className="gap-0">
            {NAV_ITEMS.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={isActive(item.route)}
                  onClick={() => router.push(item.route)}
                  tooltip={item.label}
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </>
      )}
    </div>
  );
}