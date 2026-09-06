"use client";

import {
  Commit,
  CommitHeader,
  CommitActions,
  CommitAuthor,
  CommitHash,
  CommitInfo,
  CommitMetadata,
  CommitMessage,
  CommitSeparator,
  CommitTimestamp,
} from "@/src/components/ai-elements/commit";
import { Button } from "@/src/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { ChatMessage } from "@/src/shared/types";

type Props = {
  citation: ChatMessage["citations"][number];
};

export function CitationCard({ citation }: Props) {
  const shortSha = citation.commitSha.slice(0, 7);
  const message =
    citation.commitMessage.length > 100
      ? citation.commitMessage.slice(0, 100) + "…"
      : citation.commitMessage;

  return (
    <Commit>
      <CommitHeader>
        <CommitInfo>
          <CommitMessage>{message}</CommitMessage>
          <CommitMetadata>
            <CommitHash>{shortSha}</CommitHash>
            {citation.author && (
              <>
                <CommitSeparator />
                <CommitAuthor>{citation.author}</CommitAuthor>
              </>
            )}
            <CommitSeparator />
            <CommitTimestamp date={new Date(citation.committedAt)} />
          </CommitMetadata>
        </CommitInfo>
        <CommitActions>
          {citation.commitUrl && (
            <Button asChild size="icon-sm" variant="ghost">
              <a
                href={citation.commitUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open commit"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
        </CommitActions>
      </CommitHeader>
    </Commit>
  );
}