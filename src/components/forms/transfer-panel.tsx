"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Trash2 } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountSelect, AmountField, DateField, Field } from "./fields";
import { useAccounts, useTransactionMutations } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { fetchTransferLegs } from "@/lib/data/transactions";
import { centsToInput, currencySymbol, formatMoney, parseMoney } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import type { Transaction } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tx?: Transaction;
  preset?: { from?: string; to?: string; amount?: number; description?: string };
}

export function TransferPanel({ open, onOpenChange, tx, preset }: Props) {
  const { data: accounts = [] } = useAccounts();
  const m = useTransactionMutations();
  const editing = Boolean(tx?.transfer_id);

  const [from, setFrom] = useState<string | null>(preset?.from ?? null);
  const [to, setTo] = useState<string | null>(preset?.to ?? null);
  const [amount, setAmount] = useState(preset?.amount ? centsToInput(preset.amount) : "");
  const [toAmount, setToAmount] = useState("");
  const [date, setDate] = useState(tx?.occurred_on ?? todayISO());
  const [description, setDescription] = useState(tx?.description ?? preset?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  // Al editar, cargamos las dos patas.
  useEffect(() => {
    if (!tx?.transfer_id) return;
    fetchTransferLegs(tx.transfer_id).then((legs) => {
      const out = legs.find((l) => l.amount < 0);
      const inn = legs.find((l) => l.amount > 0);
      if (out) {
        setFrom(out.account_id);
        setAmount(centsToInput(out.amount));
      }
      if (inn) {
        setTo(inn.account_id);
        setToAmount(centsToInput(inn.amount));
      }
    });
  }, [tx?.transfer_id]);

  useEffect(() => {
    if (from || editing || !accounts.length) return;
    const usable = accounts.filter((a) => !a.archived_at && a.id !== to);
    const pick = usable.find((a) => a.is_default) ?? usable[0];
    if (pick) setFrom(pick.id);
  }, [accounts, from, editing]);

  const fromAcc = accounts.find((a) => a.id === from);
  const toAcc = accounts.find((a) => a.id === to);
  const crossCurrency = Boolean(fromAcc && toAcc && fromAcc.currency !== toAcc.currency);
  const busy = m.transfer.isPending || m.updateTransfer.isPending || m.remove.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!cents || cents <= 0) return setError("Escribe un monto mayor que cero.");
    if (!from || !to) return setError("Elige las dos cuentas.");
    if (from === to) return setError("Las cuentas deben ser distintas.");
    const received = crossCurrency ? parseMoney(toAmount) : null;
    if (crossCurrency && (!received || received <= 0)) return setError(`Escribe cuánto llegó en ${toAcc?.currency}.`);
    setError(null);
    try {
      if (editing && tx?.transfer_id) {
        await m.updateTransfer.mutateAsync({ transferId: tx.transfer_id, input: { amount: cents, to_amount: received, occurred_on: date, description } });
      } else {
        await m.transfer.mutateAsync({ from, to, amount: cents, to_amount: received, occurred_on: date, description: description.trim() || `${fromAcc?.name} → ${toAcc?.name}` });
      }
    } catch {
      return;
    }
    toast({ title: editing ? "Transferencia actualizada" : "Transferencia hecha", description: formatMoney(cents, fromAcc?.currency) });
    onOpenChange(false);
  }

  async function remove() {
    if (!tx) return;
    try {
      await m.remove.mutateAsync(tx.id); // un trigger borra la otra pata
    } catch {
      return;
    }
    toast({ title: "Transferencia eliminada" });
    onOpenChange(false);
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title={editing ? "Editar transferencia" : "Transferir"} description="Mover dinero entre tus cuentas">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <AmountField value={amount} onChange={setAmount} currency={fromAcc?.currency ?? "DOP"} autoFocus={!editing} />
          <div className="flex flex-col gap-2">
            <Field label="Desde" htmlFor="tr-from">
              {editing ? (
                <Input id="tr-from" value={fromAcc?.name ?? ""} disabled />
              ) : (
                <AccountSelect id="tr-from" accounts={accounts} value={from} onChange={setFrom} exclude={to} />
              )}
            </Field>
            <div className="flex justify-center text-muted-foreground" aria-hidden="true">
              <ArrowDown className="h-5 w-5" />
            </div>
            <Field label="Hacia" htmlFor="tr-to">
              {editing ? (
                <Input id="tr-to" value={toAcc?.name ?? ""} disabled />
              ) : (
                <AccountSelect id="tr-to" accounts={accounts} value={to} onChange={setTo} exclude={from} />
              )}
            </Field>
          </div>
          {crossCurrency && (
            <Field label={`Llegó a ${toAcc?.name} (${currencySymbol(toAcc!.currency)})`} htmlFor="tr-received" hint="Las monedas son distintas: indica el monto que recibiste.">
              <Input id="tr-received" inputMode="decimal" value={toAmount} onChange={(e) => setToAmount(e.target.value)} placeholder="0.00" />
            </Field>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fecha" htmlFor="tr-date">
              <DateField id="tr-date" value={date} onChange={setDate} />
            </Field>
            <Field label="Concepto (opcional)" htmlFor="tr-desc">
              <Input id="tr-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="Ahorro, pago tarjeta…" />
            </Field>
          </div>
          {error && (
            <p className="text-sm font-semibold text-negative" role="alert">
              {error}
            </p>
          )}
          <PanelFooter>
            {editing && (
              <Button type="button" variant="destructive-ghost" size="icon" onClick={remove} disabled={busy} aria-label="Eliminar transferencia">
                <Trash2 />
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? "Guardando…" : editing ? "Guardar cambios" : "Transferir"}
            </Button>
          </PanelFooter>
        </form>
      </PanelContent>
    </Panel>
  );
}
