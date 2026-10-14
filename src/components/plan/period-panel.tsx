"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountSelect, AmountField, DateField, Field } from "@/components/forms/fields";
import { useAccounts, usePlanMutations, useProfile } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { todayISO } from "@/lib/dates";
import { CURRENCIES, CURRENCY_CODES, centsToInput, parseMoney } from "@/lib/money";
import type { PlanPeriod } from "@/lib/types";

/** Un periodo con presupuesto propio (un viaje). Mientras dura, no corre el de casa. */
export function PlanPeriodPanel({ open, onOpenChange, period }: { open: boolean; onOpenChange: (o: boolean) => void; period?: PlanPeriod }) {
  const { data: accounts = [] } = useAccounts();
  const { data: profile } = useProfile();
  const m = usePlanMutations();
  const [name, setName] = useState(period?.name ?? "Viaje");
  const [start, setStart] = useState(period?.start_on ?? todayISO());
  const [end, setEnd] = useState(period?.end_on ?? todayISO());
  const [currency, setCurrency] = useState(period?.currency ?? profile?.default_currency ?? "DOP");
  const [budget, setBudget] = useState(period ? centsToInput(period.budget) : "");
  const [cash, setCash] = useState(period?.cash_amount ? centsToInput(period.cash_amount) : "");
  const [accountId, setAccountId] = useState<string | null>(period?.account_id ?? null);
  const [note, setNote] = useState(period?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const options = accounts.filter((a) => !a.archived_at && ["credit", "checking", "savings", "cash"].includes(a.type));
  const busy = m.savePeriod.isPending || m.removePeriod.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const b = parseMoney(budget);
    const c = cash.trim() ? parseMoney(cash) : null;
    if (!name.trim()) return setError("Ponle un nombre.");
    if (end < start) return setError("La fecha final no puede ser antes del inicio.");
    if (b === null || b < 0) return setError("Escribe el presupuesto.");
    if (cash.trim() && (c === null || c > b)) return setError("El efectivo no puede ser más que el presupuesto.");
    setError(null);
    try {
      await m.savePeriod.mutateAsync({
        id: period?.id ?? null,
        input: { name: name.trim(), start_on: start, end_on: end, budget: b, currency, cash_amount: c, account_id: accountId, note: note.trim() || null },
      });
    } catch {
      return;
    }
    toast({ title: period ? "Periodo actualizado" : "Periodo agregado", description: name.trim() });
    onOpenChange(false);
  }

  async function remove() {
    if (!period) return;
    try {
      await m.removePeriod.mutateAsync(period.id);
    } catch {
      return;
    }
    toast({ title: "Periodo eliminado", description: period.name });
    onOpenChange(false);
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title={period ? "Editar periodo" : "Nuevo periodo"} description="Un viaje u otro tiempo con su propio presupuesto.">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Nombre" htmlFor="per-name">
            <Input id="per-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Desde" htmlFor="per-start">
              <DateField id="per-start" value={start} onChange={setStart} />
            </Field>
            <Field label="Hasta" htmlFor="per-end">
              <DateField id="per-end" value={end} onChange={setEnd} />
            </Field>
          </div>
          <Field label="Moneda" htmlFor="per-cur">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="per-cur">
                <SelectValue>{`${currency} · ${CURRENCIES[currency]?.name ?? ""}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_CODES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c} · {CURRENCIES[c].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="rounded-2xl border border-secondary bg-card px-4">
            <AmountField label="Presupuesto" value={budget} onChange={setBudget} currency={currency} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="En efectivo (opcional)" htmlFor="per-cash">
              <Input id="per-cash" value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="0" className="tabular" />
            </Field>
            <Field label="Con tarjeta" htmlFor="per-acc">
              <AccountSelect id="per-acc" accounts={options} value={accountId} onChange={setAccountId} placeholder="La del día a día" />
            </Field>
          </div>
          <Field label="Nota (opcional)" htmlFor="per-note">
            <Input id="per-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
          {error && (
            <p className="text-sm font-semibold text-negative" role="alert">
              {error}
            </p>
          )}
          <PanelFooter>
            {period && (
              <Button type="button" variant="destructive-ghost" size="icon" onClick={remove} disabled={busy} aria-label="Eliminar periodo">
                <Trash2 />
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={busy}>
              {m.savePeriod.isPending && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </PanelFooter>
        </form>
      </PanelContent>
    </Panel>
  );
}
