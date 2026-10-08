"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/fields";
import { PageHeader } from "@/components/shell/page-header";
import { toast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabase/client";
import { MIN_PASSWORD, authErrorMessage } from "@/app/(auth)/_components/auth-helpers";
import { FormError, PasswordInput } from "@/app/(auth)/_components/auth-ui";

export default function NuevaContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (password !== repeat) return setError("Las contraseñas no coinciden.");
    setError(null);
    setBusy(true);
    try {
      const { error: authError } = await getSupabase().auth.updateUser({ password });
      if (authError) throw authError;
    } catch (err) {
      setBusy(false);
      return setError(authErrorMessage(err));
    }
    toast({ title: "Contraseña actualizada", description: "Úsala la próxima vez que entres." });
    router.replace("/inicio");
  }

  const mismatch = repeat.length > 0 && repeat !== password;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader title="Nueva contraseña" subtitle="Elige una que no uses en otros sitios." back="/ajustes" />
      <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-4">
        <Field label="Contraseña nueva" htmlFor="new-password" hint={`Mínimo ${MIN_PASSWORD} caracteres.`}>
          <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" autoFocus invalid={password.length > 0 && password.length < MIN_PASSWORD} />
        </Field>
        <Field label="Repítela" htmlFor="repeat-password" error={mismatch ? "No coincide con la de arriba." : null}>
          <PasswordInput id="repeat-password" value={repeat} onChange={setRepeat} autoComplete="new-password" invalid={mismatch} />
        </Field>
        {error && <FormError>{error}</FormError>}
        <Button type="submit" disabled={busy}>
          {busy ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </div>
  );
}
