"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "@/components/forms/fields";
import { getSupabase } from "@/lib/supabase/client";
import { authErrorMessage, isEmail, linkErrorMessage, safeNext } from "../_components/auth-helpers";
import { FormError, GoogleButton, OrDivider, PasswordInput, textLinkClass } from "../_components/auth-ui";

export default function LoginPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => linkErrorMessage(params.get("error")));
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) return setError("Escribe un correo válido.");
    if (!password) return setError("Escribe tu contraseña.");
    setError(null);
    setBusy(true);
    try {
      const { error: authError } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setBusy(false);
        return setError(authErrorMessage(authError));
      }
      router.replace(next ?? "/inicio");
      router.refresh();
    } catch (err) {
      setBusy(false);
      setError(authErrorMessage(err));
    }
  }

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Entra a tu cuenta</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Tus cuentas, tus gastos compartidos y tu asistente.</p>
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Correo" htmlFor="login-email">
          <Input
            id="login-email"
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
        <Field label="Contraseña" htmlFor="login-password">
          <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
        <div className="-mt-2 flex justify-end">
          <Link href="/recuperar" className={`${textLinkClass} text-[13px]`}>
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        {error && <FormError>{error}</FormError>}
        <Button type="submit" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <OrDivider />
      <GoogleButton next={next} onError={setError} disabled={busy} />
      <p className="-mt-1 text-center text-xs text-muted-foreground">
        Al continuar con Google aceptas los{" "}
        <Link href="/legal/terminos" className={textLinkClass}>
          Términos
        </Link>{" "}
        y la{" "}
        <Link href="/legal/privacidad" className={textLinkClass}>
          Privacidad
        </Link>
        .
      </p>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href={signupHref} className={textLinkClass}>
          Crea una
        </Link>
      </p>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Cargando">
      <Skeleton className="mx-auto h-8 w-48" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}
