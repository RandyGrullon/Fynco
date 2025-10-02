"use client";

import { ReactNode } from "react";
import { AppLockScreen } from "@/components/security/app-lock-screen";
import { useSecurity } from "@/contexts/security-context";

interface AppSecurityGateProps {
  children: ReactNode;
}

export function AppSecurityGate({ children }: AppSecurityGateProps) {
  const { isUnlocked, loading, settings } = useSecurity();

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
          <p className="text-muted-foreground">Preparando seguridad...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {settings.appLockEnabled && !isUnlocked ? <AppLockScreen /> : null}
    </>
  );
}
