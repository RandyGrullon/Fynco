"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PinPad } from "./pin-pad";
import { useHasPin, useProfile } from "@/hooks/queries";
import { verifyPin } from "@/lib/data/profile";
import { getSupabase } from "@/lib/supabase/client";
import { useUser } from "@/components/providers/session-provider";
import { LogoMark } from "@/components/brand";

const IDLE_MS = 5 * 60_000;
const key = (uid: string) => `fynco:unlocked:${uid}`;

/** Marca esta sesión del navegador como desbloqueada (p. ej. al activar el bloqueo). */
export function markUnlocked(uid: string) {
  try {
    sessionStorage.setItem(key(uid), String(Date.now()));
  } catch {}
}

/**
 * Bloqueo de la app con PIN. Mientras está bloqueada NO se renderiza el contenido.
 * Protege contra acceso casual al dispositivo; los intentos se limitan en el servidor.
 */
export function AppLock({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const { data: profile, isLoading, isError: profileError, refetch } = useProfile();
  const { data: hasPin, isLoading: pinLoading, isError: pinError } = useHasPin();
  // Si el bloqueo está activo y no pudimos confirmar el PIN, se asume que existe (falla cerrado).
  const enabled = Boolean(profile?.app_lock_enabled && (hasPin ?? pinError));
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  const markActive = useCallback(() => markUnlocked(user.id), [user.id]);

  // ¿Sigue viva la sesión desbloqueada?
  useEffect(() => {
    if (!enabled) return;
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(key(user.id)) ?? 0);
    } catch {}
    setUnlocked(Date.now() - last < IDLE_MS);
  }, [enabled, user.id]);

  // Re-bloquear tras inactividad o al volver de segundo plano.
  useEffect(() => {
    if (!enabled || !unlocked) return;
    const onActivity = () => markActive();
    const onVisible = () => {
      if (document.visibilityState === "hidden") return markActive();
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(key(user.id)) ?? 0);
      } catch {}
      if (Date.now() - last >= IDLE_MS) setUnlocked(false);
    };
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(onVisible, 30_000);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [enabled, unlocked, markActive, user.id]);

  if (isLoading || pinLoading) return <Splash />;
  if (profileError && !profile) return <LoadError onRetry={() => refetch()} />;
  if (!enabled || unlocked) return <>{children}</>;
  if (unlocked === null) return <Splash />;
  return (
    <LockScreen
      name={profile?.display_name ?? ""}
      onUnlock={() => {
        markActive();
        setUnlocked(true);
      }}
    />
  );
}

function LockScreen({ name, onUnlock }: { name: string; onUnlock: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  async function check(pin: string) {
    setBusy(true);
    try {
      const r = await verifyPin(pin);
      if (r.ok) return onUnlock();
      setError(
        r.reason === "locked"
          ? `Demasiados intentos. Espera hasta las ${new Date(r.locked_until ?? Date.now()).toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit" })}.`
          : `PIN incorrecto${r.attempts_left ? `. Te quedan ${r.attempts_left} intentos` : ""}.`,
      );
    } catch {
      setError("No se pudo verificar. Revisa tu conexión.");
    } finally {
      setBusy(false);
      setAttempt((a) => a + 1);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-extrabold">Hola{name ? `, ${name.split(" ")[0]}` : ""}</h1>
        <p className="text-sm text-muted-foreground">Escribe tu PIN para entrar</p>
      </div>
      <PinPad onComplete={check} disabled={busy} error={error} resetKey={attempt} />
      <Button variant="link" onClick={() => getSupabase().auth.signOut()}>
        Entrar con otra cuenta
      </Button>
    </main>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-extrabold">No pudimos cargar tu cuenta</h1>
      <p className="max-w-xs text-sm text-muted-foreground">Revisa tu conexión e intenta de nuevo.</p>
      <Button onClick={onRetry}>Reintentar</Button>
    </main>
  );
}

export function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Cargando">
      <LogoMark size={48} className="animate-pulse" />
    </div>
  );
}
