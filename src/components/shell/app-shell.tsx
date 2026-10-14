"use client";

import { BottomNav, SideNav } from "./nav";
import { PullToRefresh } from "./pull-to-refresh";
import { IOSInstallBanner } from "@/components/ios-install-banner";
import { SessionProvider, type SessionUser } from "@/components/providers/session-provider";

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <SessionProvider user={user}>
      <PullToRefresh />
      {/* La pantalla no se mueve: arriba la barra de estado, abajo la navegación y en medio lo único que se desplaza. */}
      <div className="flex h-full">
        <SideNav />
        <div className="pt-safe flex min-w-0 flex-1 flex-col">
          <main className="app-main min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            <div className="mx-auto w-full max-w-3xl px-4 md:px-8">{children}</div>
          </main>
          <BottomNav />
        </div>
      </div>
      <IOSInstallBanner />
    </SessionProvider>
  );
}
