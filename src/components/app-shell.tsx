import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppLogo } from "@/components/app-logo";
import { SCHOOL_SHORT_NAME } from "@/lib/meeting-constants";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/85 px-3 backdrop-blur">
            <SidebarTrigger />
            <AppLogo className="size-6" />
            <span className="font-display text-sm font-bold tracking-tight">tarbie+</span>
            <span className="ml-auto flex items-center gap-1.5">
              <img
                src="/school-logo.jpg"
                alt={SCHOOL_SHORT_NAME}
                className="size-6 rounded-full object-cover"
              />
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                {SCHOOL_SHORT_NAME}
              </span>
            </span>
          </header>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
