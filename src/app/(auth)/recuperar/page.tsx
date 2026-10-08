"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/fields";
import { getSupabase } from "@/lib/supabase/client";
import { isEmail } from "../_components/auth-helpers";
import { FormError, textLinkClass } from "../_components/auth-ui";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) return setError("Escribe un correo válido.");
    setError(null);
    setBusy(true);
    try {
      const { error: authError } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/nueva-contrasena`,
      });
      // Respuesta neutra: no revelamos si el correo tiene cuenta. Solo avisamos si no hubo conexión.
      if (authError?.name === "AuthRetryableFetchError") return setError("Sin conexión. Revisa tu internet.");
      setSent(true);
    } catch {
      setError("Sin conexión. Revisa tu internet.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-5 text-center" aria-live="polite">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary">
          <MailCheck className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Revisa tu correo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Si hay una cuenta con <span className="font-semibold text-foreground">{email.trim()}</span>, te llegará un enlace para crear una contraseña nueva. Puede tardar unos minutos; revisa también la carpeta de spam.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2.5">
          <Button asChild>
            <Link href="/login">Volver a entrar</Link>
          </Button>
          <Button variant="ghost" onClick={() => setSent(false)}>
            Usar otro correo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Recupera tu contraseña</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.</p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Correo" htmlFor="reset-email">
          <Input
            id="reset-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            autoFocus
          />
        </Field>
        {error && <FormError>{error}</FormError>}
        <Button type="submit" disabled={busy}>
          {busy ? "Enviando…" : "Enviar enlace"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        ¿Te acordaste?{" "}
        <Link href="/login" className={textLinkClass}>
          Entra
        </Link>
      </p>
    </div>
  );
}
