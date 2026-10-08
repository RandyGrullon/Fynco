"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/fields";
import { toast } from "@/hooks/use-toast";
import { deleteMyAccount, verifyPin } from "@/lib/data/profile";
import { errorMessage } from "@/lib/errors";
import { pinErrorText } from "./pin-panel";

const WORD = "ELIMINAR";

/** Confirmación fuerte para borrar la cuenta: escribir ELIMINAR y, si hay PIN, verificarlo. */
export function DeleteAccountPanel({ open, onOpenChange, hasPin }: { open: boolean; onOpenChange: (o: boolean) => void; hasPin: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirm("");
    setPin("");
    setError(null);
  }, [open]);

  const wordOk = confirm.trim().toUpperCase() === WORD;
  const pinOk = !hasPin || /^\d{4,6}$/.test(pin);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!wordOk) return setError(`Escribe ${WORD} para confirmar.`);
    if (!pinOk) return setError("Escribe tu PIN.");
    setError(null);
    setBusy(true);
    try {
      if (hasPin) {
        const r = await verifyPin(pin);
        if (!r.ok) {
          setPin("");
          setBusy(false);
          return setError(pinErrorText(r));
        }
      }
      await deleteMyAccount();
    } catch (err) {
      setBusy(false);
      return setError(errorMessage(err, "No se pudo eliminar la cuenta. Intenta de nuevo."));
    }
    toast({ title: "Eliminamos tu cuenta", description: "Gracias por haber usado Fynco." });
    router.replace("/login");
  }

  return (
    <Panel open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <PanelContent title="Eliminar mi cuenta" description="Esto no se puede deshacer.">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-xl border border-negative/30 bg-negative/10 p-4 text-sm">
            <p className="font-semibold text-foreground">Se borrarán para siempre:</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground marker:text-negative">
              <li>Tu perfil, tu correo de acceso y tu PIN.</li>
              <li>Tus cuentas, movimientos, recurrentes y metas.</li>
            </ul>
            <p className="text-muted-foreground">
              En los grupos compartidos quedarás como invitado con tu nombre, para que los demás conserven su historial y sus saldos.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">Si quieres guardar tus datos, exporta tus movimientos en CSV antes de continuar.</p>

          <Field label={`Escribe ${WORD} para confirmar`} htmlFor="delete-confirm">
            <Input
              id="delete-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder={WORD}
            />
          </Field>
          {hasPin && (
            <Field label="Tu PIN" htmlFor="delete-pin">
              <Input
                id="delete-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="tracking-[0.4em]"
              />
            </Field>
          )}
          {error && (
            <p className="text-sm font-semibold text-negative" role="alert">
              {error}
            </p>
          )}
          <PanelFooter>
            <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" className="flex-1" disabled={busy || !wordOk || !pinOk}>
              {busy ? "Eliminando…" : "Eliminar cuenta"}
            </Button>
          </PanelFooter>
        </form>
      </PanelContent>
    </Panel>
  );
}
