"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";

export interface SessionUser {
  id: string;
  email: string | null;
}

const SessionContext = createContext<SessionUser | null>(null);

/** El usuario viene validado desde el servidor; aquí solo reaccionamos a cierres de sesión. */
export function SessionProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== user.id)) {
        qc.clear();
        try {
          sessionStorage.clear();
        } catch {}
        router.replace("/login");
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [qc, router, user.id]);

  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useUser(): SessionUser {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useUser debe usarse dentro de SessionProvider");
  return ctx;
}
