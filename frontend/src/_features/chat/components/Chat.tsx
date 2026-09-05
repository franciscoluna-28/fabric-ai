"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveProjectStore } from "@/src/store/active-project";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/src/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/src/components/ai-elements/message";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputHeader,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
} from "@/src/components/ai-elements/prompt-input";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/src/components/ui/empty";
import { useProjects } from "@/src/_features/reports/services/projects-api";
import { useBranches } from "@/src/_features/reports/services/api";
import {
  useChatMessages,
  useCreateChatSession,
  streamChatMessage,
  prepareProjectBranch,
} from "@/src/_features/chat/services/chat-api";
import { CitationCard } from "@/src/_features/chat/components/CitationCard";
import { queryKeys } from "@/src/shared/services/keys";
import type { ChatMessage } from "@/src/shared/types";
import { cn } from "@/src/shared/lib/utils";
import { BookOpen, ArrowUp, GitBranch, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/src/components/ui/collapsible";
import { Suggestions, Suggestion } from "@/src/components/ai-elements/suggestion";

function splitArtifact(content: string): { before: string; artifact: string | null } {
  const m = content.match(/:::report\n([\s\S]*?)\n:::/);
  if (!m) return { before: content, artifact: null };
  const before = content.slice(0, m.index).trim();
  const artifact = m[1].trim();
  return { before, artifact };
}

function MessageView({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming?: boolean;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const citationCount = message.citations.length;
  const { before, artifact } = message.role === "assistant" ? splitArtifact(message.content) : { before: message.content, artifact: null };

  return (
    <Message from={message.role}>
      <MessageContent>
        {message.role === "assistant" ? (
          <>
            {before && (
              <MessageResponse>{before}</MessageResponse>
            )}
            {artifact && (
              <div className="rounded-lg border bg-card p-6 my-3 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 font-semibold">
                    Report
                  </span>
                </div>
                <MessageResponse className="m-6">{artifact}</MessageResponse>
              </div>
            )}
            {streaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/70 align-middle" />
            )}
          </>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </MessageContent>
      {message.role === "assistant" && (
        <MessageActions>
          <MessageAction
            tooltip="Copy"
            onClick={() => {
              const cleaned = message.content.replace(/:::report\n?|:::/g, "").trim();
              navigator.clipboard.writeText(cleaned);
              toast.success("Copied to clipboard");
            }}
          >
            <Copy className="size-3.5" />
          </MessageAction>
        </MessageActions>
      )}
      {message.role === "assistant" && citationCount > 0 && (
        <Collapsible
          defaultOpen={false}
          onOpenChange={setSourcesOpen}
          className="w-full pt-3 mt-2"
        >
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between rounded-md py-1.5 cursor-pointer transition-colors">
              <span className="text-[11px] font-medium text-muted-foreground">
                Sources Used · {message.branch ?? "all branches"} ({citationCount}{" "}
                {citationCount === 1 ? "commit retrieved" : "commits retrieved"})
              </span>
              <ChevronDown
                className={cn(
                  "size-3.5 text-muted-foreground transition-transform",
                  sourcesOpen && "rotate-180",
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 pt-2">
            {message.citations.map((c) => (
              <CitationCard key={c.commitSha} citation={c} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </Message>
  );
}

export function Chat() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { projects, isLoading: projectsLoading } = useProjects();

  const projectId = searchParams.get("project");
  const sessionId = searchParams.get("session");
  const branch = searchParams.get("branch");

  const activeProject = projects.find((p) => p.id === projectId)?.repositoryName ?? null;
  const activeProjectData = projects.find((p) => p.id === projectId) ?? null;
  const { setLastProjectId } = useActiveProjectStore();

  useEffect(() => {
    if (!projectsLoading && projects.length > 0 && !projectId) {
      const stored = useActiveProjectStore.getState().lastProjectId;
      const target = stored && projects.find((p) => p.id === stored) ? stored : projects[0].id;
      setLastProjectId(target);
      const p = new URLSearchParams(searchParams.toString());
      p.set("project", target);
      router.replace(`/app?${p.toString()}`);
    }
  }, [projectsLoading, projects, projectId, router, searchParams, setLastProjectId]);

  useEffect(() => {
    if (projectId) {
      setLastProjectId(projectId);
    }
  }, [projectId, setLastProjectId]);

  const { branches, defaultBranch, isLoading: branchesLoading } = useBranches(
    activeProjectData?.providerOwner ?? "",
    activeProjectData?.repositoryName ?? "",
  );

  const handleBranchChange = async (branchName: string) => {
    if (!projectId) return;
    await prepareProjectBranch(projectId, branchName);
    await queryClient.invalidateQueries({ queryKey: queryKeys.projects.list });
    toast.success(`Ready to chat on ${branchName}`);
    const p = new URLSearchParams(searchParams.toString());
    p.set("branch", branchName);
    router.push(`/app?${p.toString()}`);
  };

  useEffect(() => {
    if (defaultBranch && projectId && !branch) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("branch", defaultBranch);
      router.replace(`/app?${p.toString()}`);
    }
  }, [defaultBranch, projectId, branch, router, searchParams]);

  const { messages: storedMessages, isLoading: messagesLoading } = useChatMessages(sessionId ?? undefined);
  const createSession = useCreateChatSession();

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const streamingId = liveMessages.find((m) => m.id.startsWith("local-assistant"))?.id;

  const messages = useMemo(() => [...storedMessages, ...liveMessages], [storedMessages, liveMessages]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !projectId || isStreaming) return;
    setInput("");
    setIsStreaming(true);

    try {
      let sid = sessionId;
      if (!sid) {
        const created = await createSession.mutateAsync(projectId);
        sid = created.id;
        const p = new URLSearchParams(searchParams.toString());
        p.set("session", sid);
        router.push(`/app?${p.toString()}`, { scroll: false });
      }

      const userMsg: ChatMessage = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content: trimmed,
        branch,
        citations: [],
        createdAt: new Date().toISOString(),
      };
      const draft: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        branch,
        citations: [],
        createdAt: new Date().toISOString(),
      };
      setLiveMessages((m) => [...m, userMsg, draft]);

      await streamChatMessage(sid, trimmed, branch, (chunk) => {
        if (chunk.type === "token") {
          setLiveMessages((m) => {
            const copy = [...m];
            const idx = copy.findIndex((msg) => msg.id === draft.id);
            if (idx >= 0) copy[idx] = { ...copy[idx], content: copy[idx].content + chunk.content };
            return copy;
          });
        } else if (chunk.type === "done") {
          setLiveMessages((m) => {
            const copy = [...m];
            const idx = copy.findIndex((msg) => msg.id === draft.id);
            if (idx >= 0) copy[idx] = { ...chunk.message };
            return copy;
          });
        } else if (chunk.type === "error") {
          toast.error(chunk.error);
        }
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(sid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
      setLiveMessages([]);
    } catch {
      setLiveMessages((m) => m.filter((msg) => !msg.id.startsWith("local-assistant")));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (message: PromptInputMessage) => handleSend(message.text);

  const handleSuggestion = (suggestion: string) => {
    handleSend(suggestion);
  };

  return (
    <div className="w-full h-full flex flex-col mx-auto">
      {!projectId ? (
        <div className="flex-1 flex items-center justify-center">
          <Empty className="max-w-md border-0">
            <EmptyMedia>
              <BookOpen className="size-12 text-muted-foreground" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-lg font-semibold">Welcome</EmptyTitle>
              <EmptyDescription className="text-sm text-muted-foreground">
                Select or connect a repository from the sidebar to start asking questions about your code history.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto min-h-0 px-4">
            {messagesLoading && sessionId && storedMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-3/4 space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-2/3" />
                </div>
              </div>
            ) : messages.length === 0 ? (
              <ConversationEmptyState
                icon={<BookOpen className="size-12" />}
                title={`Ask about ${activeProject}`}
                description="For example, when was the RAG chat added, or what shipped this week."
              />
            ) : (
              <Conversation className="h-full">
                <ConversationContent className="max-w-[800px] mx-auto space-y-2">
                  {messages.map((m) => (
                    <MessageView key={m.id} message={m} streaming={m.id === streamingId} />
                  ))}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            )}
          </div>
          <div className="sticky bottom-0 z-10 bg-background px-3 pt-2 pb-3 max-w-[800px] mx-auto w-full">
            <PromptInput onSubmit={handleSubmit}>
              {branches.length > 0 && (
                <PromptInputHeader>
                    <PromptInputSelect
                    value={branch ?? defaultBranch ?? branches[0] ?? ""}
                    onValueChange={(v) => {
                      if (!v) return;
                      handleBranchChange(v);
                    }}
                  >
                    <PromptInputSelectTrigger>
                      <GitBranch className="size-3 shrink-0" />
                      <PromptInputSelectValue placeholder="Branch" />
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent>
                      {branches.map((b) => (
                        <PromptInputSelectItem key={b} value={b}>
                          {b}
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>
                </PromptInputHeader>
              )}
              <PromptInputBody>
                <PromptInputTextarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Ask about ${activeProject} commits...`}
                  disabled={isStreaming}
                  className="flex-1"
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputSubmit
                className="ml-auto"
                  status={isStreaming ? "streaming" : "ready"}
                  disabled={!input.trim() || isStreaming}
                >
                  <ArrowUp className="size-4" />
                </PromptInputSubmit>
              </PromptInputFooter>
            </PromptInput>
            <Suggestions className="mt-2">
              <Suggestion
                suggestion="Summarize this week as a report"
                onClick={handleSuggestion}
                variant="default"
              >
                Generate report
              </Suggestion>
              <Suggestion
                suggestion="What changed in the last 7 days?"
                onClick={handleSuggestion}
                variant="secondary"
              />
              <Suggestion
                suggestion="What feature is being built?"
                onClick={handleSuggestion}
                variant="secondary"
              />
            </Suggestions>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Answers are grounded in the project&apos;s ingested commits. Sources are shown as citations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}