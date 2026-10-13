"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { AmountField, DateField, Field } from "@/components/forms/fields";
import { Money } from "@/components/money";
import { useAccountMutations, useAccounts } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { todayISO } from "@/lib/dates";
import { formatMoney, parseMoney } from "@/lib/money";

/** "Llevo consumido tanto": deja la deuda de la tarjeta en lo que dice el banco. No toca ninguna otra cuenta. */
export function CardBalancePanel({ open, onOpenChange, cardId }: { open: boolean; onOpenChange: (o: boolean) => void; cardId: string }) {
  const { data: accounts = [] } = useAccounts();
  const m = useAccountMutations();
  const card = accounts.find((a) => a.id === cardId);
  const current = card ? -card.balance : 0;
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const target = value.trim() ? parseMoney(value) : null;
  const diff = target === null ? 0 : target - current;
  const cur = card?.currency ?? "DOP";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!card) return;
    if (target === null || target < 0) return setError("Escribe cuánto debes hoy en la tarjeta (0 si no debes nada).");
    setError(null);
    let how: "expense" | "opening" | "none";
    try {
      how = await m.setCardDebt.mutateAsync({ card: card.id, debt: target, occurred_on: date });
    } catch {
      return;
    }
    toast({
      title: how === "none" ? "Ya estaba al día" : "Deuda actualizada",
      description: how === "expense" ? `Se registraron ${formatMoney(diff, cur)} de consumos sin detallar.` : `${card.name}: debes ${formatMoney(target, cur)}.`,
    });
    onOpenChange(false);
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title="Actualizar deuda" description={card ? `${card.name} · en Fynco debes ${formatMoney(Math.max(0, current), cur)}` : undefined}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <AmountField label="¿Cuánto llevas consumido hoy?" value={value} onChange={setValue} currency={cur} autoFocus error={error} />
          <p className="-mt-2 text-center text-xs text-muted-foreground">
            {target === null ? (
              "Lo que dice la app o el estado del banco. Ninguna cuenta se toca."
            ) : diff > 0 ? (
              <>
                Se registran <Money amount={diff} currency={cur} className="font-semibold text-foreground" /> como consumos sin detallar (cuentan como gasto).
              </>
            ) : diff < 0 ? (
              "Se corrige la deuda sin contarlo como ingreso. Si bajó porque pagaste, mejor usa Pagar tarjeta."
            ) : (
              "Ya está al día."
            )}
          </p>
          {diff > 0 && (
            <Field label="Fecha" htmlFor="debt-date">
              <DateField id="debt-date" value={date} onChange={setDate} />
            </Field>
          )}
          <PanelFooter>
            <Button type="submit" className="flex-1" disabled={m.setCardDebt.isPending || target === null}>
              {m.setCardDebt.isPending && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </PanelFooter>
        </form>
      </PanelContent>
    </Panel>
  );
}
