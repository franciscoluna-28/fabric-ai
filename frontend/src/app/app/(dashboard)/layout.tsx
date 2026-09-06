"use client";

import { Suspense } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/src/components/ui/sidebar";
import { TooltipProvider } from "@/src/components/ui/tooltip";
import Image from "next/image";
import LogoImage from "@/public/logo.png";
import { ChatSidebarContent } from "@/src/_features/chat/components/ChatSidebarContent";

function SidebarLayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <a href="/app">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                      <Image src={LogoImage} alt="Scrapecat Logo" width={28} height={28} className="size-7" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Scrapecat</span>
                      <span className="truncate text-xs text-muted-foreground">Intelligence</span>
                    </div>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <ChatSidebarContent />
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex flex-col h-screen">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 bg-background/50">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SidebarLayoutInner>{children}</SidebarLayoutInner>
    </Suspense>
  );
}