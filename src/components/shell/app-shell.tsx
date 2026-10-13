"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BottomNav, SideNav } from "./nav";
import { PullToRefresh } from "./pull-to-refresh";
import { SheetsProvider } from "./sheets";
import { AppLock } from "@/components/security/app-lock";
import { IOSInstallBanner } from "@/components/ios-install-banner";
import { SessionProvider, type SessionUser } from "@/components/providers/session-provider";
import { keys } from "@/hooks/queries";
import { runMyRecurring } from "@/lib/data/planning";
import { todayISO } from "@/lib/dates";

/** Genera los recurrentes vencidos al abrir la app (idempotente en el servidor). */
function RecurringRunner() {
  const qc = useQueryClient();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    runMyRecurring(todayISO())
      .then((n) => {
        if (n > 0) {
          qc.invalidateQueries({ queryKey: keys.accounts });
          qc.invalidateQueries({ queryKey: keys.transactionsAll });
          qc.invalidateQueries({ queryKey: keys.recurring });
          qc.invalidateQueries({ queryKey: keys.stats });
        }
      })
      .catch(() => {});
  }, [qc]);
  return null;
}

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <SessionProvider user={user}>
      <AppLock>
        <SheetsProvider>
          <RecurringRunner />
          <PullToRefresh />
          {/* Tapa lo que pasa por debajo de la barra de estado (hora, batería) al hacer scroll. */}
          <div aria-hidden="true" className="h-safe-top pointer-events-none fixed inset-x-0 top-0 z-30 bg-background" />
          <div className="flex min-h-dvh">
            <SideNav />
            <main className="pt-safe min-w-0 flex-1 pb-28 md:pb-12">
              <div className="mx-auto w-full max-w-3xl px-5 md:px-8">{children}</div>
            </main>
          </div>
          <BottomNav />
          <IOSInstallBanner />
        </SheetsProvider>
      </AppLock>
    </SessionProvider>
  );
}
