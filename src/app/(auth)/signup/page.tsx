"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "@/components/forms/fields";
import { getSupabase } from "@/lib/supabase/client";
import { MIN_PASSWORD, authErrorMessage, isEmail, safeNext } from "../_components/auth-helpers";
import { FormError, GoogleButton, OrDivider, PasswordInput, textLinkClass } from "../_components/auth-ui";

export default function SignupPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <SignupForm />
    </Suspense>
  );
}

function callbackUrl(next: string | null) {
  return `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Escribe tu nombre.");
    if (!isEmail(email)) return setError("Escribe un correo válido.");
    if (password.length < MIN_PASSWORD) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (!accepted) return setError("Para crear tu cuenta, acepta los Términos y la Política de privacidad.");
    setError(null);
    setBusy(true);
    try {
      const { data, error: authError } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: callbackUrl(next) },
      });
      if (authError) {
        setBusy(false);
        return setError(authErrorMessage(authError));
      }
      if (data.session) {
        router.replace(next ?? "/inicio");
        router.refresh();
        return;
      }
      setBusy(false);
      setSentTo(email.trim());
    } catch (err) {
      setBusy(false);
      setError(authErrorMessage(err));
    }
  }

  if (sentTo) return <CheckEmail email={sentTo} next={next} onBack={() => setSentTo(null)} />;

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Crea tu cuenta</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Organiza tu dinero y divide gastos con tu gente.</p>
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nombre" htmlFor="signup-name">
          <Input id="signup-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Cómo te ven tus amigos" />
        </Field>
        <Field label="Correo" htmlFor="signup-email">
          <Input
            id="signup-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
          />
        </Field>
        <Field label="Contraseña" htmlFor="signup-password" hint={`Mínimo ${MIN_PASSWORD} caracteres.`}>
          <PasswordInput
            id="signup-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            invalid={password.length > 0 && password.length < MIN_PASSWORD}
          />
        </Field>

        <div className="flex items-start gap-3 py-1">
          <Checkbox id="signup-terms" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5 h-5 w-5 rounded-md" />
          <label htmlFor="signup-terms" className="text-sm leading-snug text-muted-foreground">
            Acepto los{" "}
            <Link href="/legal/terminos" target="_blank" className="font-semibold text-primary underline-offset-4 hover:underline">
              Términos
            </Link>{" "}
            y la{" "}
            <Link href="/legal/privacidad" target="_blank" className="font-semibold text-primary underline-offset-4 hover:underline">
              Política de privacidad
            </Link>
            .
          </label>
        </div>

        {error && <FormError>{error}</FormError>}
        <Button type="submit" disabled={busy}>
          {busy ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>

      <OrDivider />
      <GoogleButton next={next} onError={setError} disabled={busy || !accepted} />
      {!accepted && <p className="-mt-3 text-center text-xs text-muted-foreground">Acepta los términos para continuar con Google.</p>}

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href={loginHref} className={textLinkClass}>
          Entra
        </Link>
      </p>
    </div>
  );
}

function CheckEmail({ email, next, onBack }: { email: string; next: string | null; onBack: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setError(null);
    try {
      const { error: authError } = await getSupabase().auth.resend({ type: "signup", email, options: { emailRedirectTo: callbackUrl(next) } });
      if (authError) throw authError;
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(authErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center" aria-live="polite">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary">
        <MailCheck className="h-7 w-7" />
      </span>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Revisa tu correo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Te enviamos un enlace a <span className="font-semibold text-foreground">{email}</span> para confirmar tu cuenta. Ábrelo desde este dispositivo y listo.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">¿No te llegó? Revisa la carpeta de spam o pide otro.</p>
      {error && <FormError className="w-full">{error}</FormError>}
      <div className="flex w-full flex-col gap-2.5">
        <Button variant="secondary" onClick={resend} disabled={state !== "idle"}>
          {state === "sending" ? "Enviando…" : state === "sent" ? "Enlace reenviado" : "Reenviar enlace"}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Usar otro correo
        </Button>
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Cargando">
      <Skeleton className="mx-auto h-8 w-44" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}
