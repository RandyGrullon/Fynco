"use client";

import { BottomNav, SideNav } from "./nav";
import { PullToRefresh } from "./pull-to-refresh";
import { IOSInstallBanner } from "@/components/ios-install-banner";
import { SessionProvider, type SessionUser } from "@/components/providers/session-provider";

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <SessionProvider user={user}>
      <PullToRefresh />
      {/* Tapa lo que pasa por debajo de la barra de estado (hora, batería) al hacer scroll. */}
      <div aria-hidden="true" className="h-safe-top pointer-events-none fixed inset-x-0 top-0 z-30 bg-background" />
      <div className="flex min-h-dvh">
        <SideNav />
        <main className="pt-safe min-w-0 flex-1 pb-28 md:pb-12">
          <div className="mx-auto w-full max-w-3xl px-4 md:px-8">{children}</div>
        </main>
      </div>
      <BottomNav />
      <IOSInstallBanner />
    </SessionProvider>
  );
}
