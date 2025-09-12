"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ThemeProvider } from "@/contexts/theme-context";
import { useTranslations } from "next-intl";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <ThemeProvider defaultTheme="system" storageKey="fynco-theme">
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
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
            <p className="text-muted-foreground">{t("loading")}</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // If user is authenticated, don't render auth pages
  if (user) {
    return null;
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="fynco-theme">
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        {children}
      </div>
    </ThemeProvider>
  );
}
