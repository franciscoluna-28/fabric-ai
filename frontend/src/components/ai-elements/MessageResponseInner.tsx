"use client";

import { memo, type ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/src/shared/lib/utils";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";

const streamdownPlugins = { cjk, code, math, mermaid } as any;

const MessageResponseInner = memo(
  ({ className, ...props }: ComponentProps<typeof Streamdown>) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      plugins={streamdownPlugins}
      {...props}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    nextProps.isAnimating === prevProps.isAnimating,
);

MessageResponseInner.displayName = "MessageResponseInner";

export default MessageResponseInner;