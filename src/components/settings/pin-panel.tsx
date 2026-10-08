"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Panel, PanelContent } from "@/components/ui/panel";
import { PinPad } from "@/components/security/pin-pad";
import { keys } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { clearPin, setPin, verifyPin, type PinResult } from "@/lib/data/profile";
import { errorMessage } from "@/lib/errors";

export type PinMode = "create" | "change" | "remove";
type Step = "current" | "new" | "confirm";

/** Mensaje para un PinResult con ok=false (las RPC no lanzan error por PIN incorrecto). */
export function pinErrorText(r: PinResult): string {
  if (r.reason === "locked") {
    const until = r.locked_until ? new Date(r.locked_until).toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit" }) : null;
    return until ? `Demasiados intentos. Espera hasta las ${until}.` : "Demasiados intentos. Espera unos minutos.";
  }
  if (r.reason === "no_pin") return "No tienes un PIN configurado.";
  if (r.reason === "current_required") return "Escribe tu PIN actual.";
  const left = r.attempts_left ?? 0;
  if (left <= 0) return "PIN incorrecto.";
  return `PIN incorrecto. Te ${left === 1 ? "queda 1 intento" : `quedan ${left} intentos`}.`;
}

const TITLES: Record<PinMode, string> = { create: "Crear PIN", change: "Cambiar PIN", remove: "Quitar PIN" };

/** Crear, cambiar o quitar el PIN con el teclado numérico. */
export function PinPanel({ mode, open, onOpenChange }: { mode: PinMode; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const first: Step = mode === "create" ? "new" : "current";
  const [step, setStep] = useState<Step>(first);
  const [current, setCurrent] = useState("");
  const [fresh, setFresh] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Empieza de cero cada vez que se abre.
  useEffect(() => {
    if (!open) return;
    setStep(first);
    setCurrent("");
    setFresh("");
    setError(null);
    setResetKey((k) => k + 1);
  }, [open, first]);

  function go(next: Step, err: string | null = null) {
    setStep(next);
    setError(err);
    setResetKey((k) => k + 1);
  }

  async function finish(title: string, description?: string) {
    // clear_pin también apaga app_lock_enabled en el servidor.
    await Promise.all([qc.invalidateQueries({ queryKey: keys.pin }), qc.invalidateQueries({ queryKey: keys.profile })]);
    toast({ title, description });
    onOpenChange(false);
  }

  async function onComplete(pin: string) {
    if (busy) return;

    if (step === "new") {
      setFresh(pin);
      return go("confirm");
    }

    setBusy(true);
    try {
      if (step === "current") {
        const r = mode === "remove" ? await clearPin(pin) : await verifyPin(pin);
        if (!r.ok) return go("current", pinErrorText(r));
        if (mode === "remove") return await finish("Quitaste tu PIN", "El bloqueo de la app quedó desactivado.");
        setCurrent(pin);
        return go("new");
      }

      // step === "confirm"
      if (pin !== fresh) {
        setFresh("");
        return go("new", "Los PIN no coinciden. Escríbelo de nuevo.");
      }
      const r = await setPin(pin, mode === "change" ? current : undefined);
      if (!r.ok) {
        if (mode === "create") {
          // Ya había un PIN (p. ej. creado en otro dispositivo).
          await qc.invalidateQueries({ queryKey: keys.pin });
          return go("new", "Ya tienes un PIN. Usa «Cambiar PIN».");
        }
        setCurrent("");
        setFresh("");
        return go("current", pinErrorText(r));
      }
      await finish(mode === "create" ? "PIN creado" : "PIN cambiado", mode === "create" ? "Ya puedes activar el bloqueo de la app." : undefined);
    } catch (e) {
      go(step === "confirm" ? "new" : step, errorMessage(e, "No se pudo guardar el PIN. Intenta de nuevo."));
    } finally {
      setBusy(false);
    }
  }

  const prompt =
    step === "current"
      ? mode === "remove"
        ? "Escribe tu PIN actual para quitarlo"
        : "Escribe tu PIN actual"
      : step === "new"
        ? mode === "create"
          ? "Elige un PIN de 4 dígitos"
          : "Escribe tu PIN nuevo"
        : "Repítelo para confirmar";

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent
        title={TITLES[mode]}
        description={mode === "remove" ? "Al quitarlo también se desactiva el bloqueo de la app." : "Evita fechas de cumpleaños o 1234."}
      >
        <div className="flex flex-col items-center gap-6 pb-6 pt-2">
          <p className="text-[15px] font-semibold" aria-live="polite">
            {prompt}
          </p>
          <PinPad onComplete={onComplete} disabled={busy} error={error} resetKey={resetKey} />
        </div>
      </PanelContent>
    </Panel>
  );
}
