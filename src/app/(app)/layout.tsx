"use client";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppProviders } from "@/contexts/app-providers";
import { FinancialChatBot } from "@/components/financial-chat-bot";
import { RouteGuard } from "@/components/security/route-guard";
import { AuthMonitor } from "@/components/security/auth-monitor";
import { SecurityProvider } from "@/contexts/security-context";
import { AppSecurityGate } from "@/components/security/app-security-gate";
import { useRequireAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      console.warn("AppLayout - No user detected, redirecting to login");
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="h-12 w-12 animate-spin text-primary"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-muted-foreground">Cargando tu sesión...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Return a more explicit message while redirecting
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="h-12 w-12 animate-spin text-primary"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-muted-foreground">
            Sesión no válida. Redirigiendo al login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppProviders>
      <AuthMonitor />
      <SecurityProvider user={user}>
        <RouteGuard>
          <AppSecurityGate>
            <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
              <div className="hidden border-r bg-muted/40 md:block">
                <AppSidebar />
              </div>
              <div className="flex flex-col">
                <AppHeader />
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
                  {children}
                </main>
              </div>
              {/* Financial Chat Bot - Only show when user is authenticated */}
              <FinancialChatBot />
            </div>
          </AppSecurityGate>
        </RouteGuard>
      </SecurityProvider>
    </AppProviders>
  );
}
