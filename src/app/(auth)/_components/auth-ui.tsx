"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { authErrorMessage } from "./auth-helpers";

/** Contraseña con botón para mostrarla u ocultarla. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  describedBy,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

export function FormError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm font-semibold text-negative", className)}>
      {children}
    </p>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground" role="separator" aria-label="o">
      <span className="h-px flex-1 bg-secondary" />o<span className="h-px flex-1 bg-secondary" />
    </div>
  );
}

/** "Continuar con Google": vuelve a /auth/callback, que crea la sesión y redirige a `next`. */
export function GoogleButton({ next, onError, disabled }: { next?: string | null; onError: (message: string) => void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? "/inicio")}`;
      const { error } = await getSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (error) {
        setBusy(false);
        onError(authErrorMessage(error));
      }
      // Sin error: el navegador ya va camino a Google.
    } catch (e) {
      setBusy(false);
      onError(authErrorMessage(e));
    }
  }

  return (
    <Button type="button" variant="secondary" className="w-full" onClick={go} disabled={disabled || busy}>
      <GoogleMark />
      {busy ? "Abriendo Google…" : "Continuar con Google"}
    </Button>
  );
}

// Marca "G" monocroma (simple-icons, CC0) para respetar el acento único.
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}

/** Enlace de texto con área táctil cómoda. */
export const textLinkClass =
  "inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md";
