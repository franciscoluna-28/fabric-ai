"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const LazyStreamdown = dynamic(
  () => import("./MessageResponseInner"),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>
    ),
  },
);

export type MessageResponseProps = ComponentProps<typeof LazyStreamdown>;

export const MessageResponse = LazyStreamdown;