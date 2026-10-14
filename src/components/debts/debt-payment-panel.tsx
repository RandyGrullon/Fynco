"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AccountSelect, AmountField, DateField, Field, Segmented } from "@/components/forms/fields";
import { useAccounts, useDebtMutations, useDebts } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { shortDate, todayISO } from "@/lib/dates";
import { formatMoney, parseMoney } from "@/lib/money";
import { debtView } from "./debt-view";

/** Registrar un pago (o un cobro, si prestaste). Por defecto, la próxima cuota. */
export function DebtPaymentPanel({ open, onOpenChange, debtId }: { open: boolean; onOpenChange: (o: boolean) => void; debtId: string }) {
  const { data: debts = [] } = useDebts();
  const { data: accounts = [] } = useAccounts();
  const m = useDebtMutations();
  const today = todayISO();
  const debt = debts.find((d) => d.id === debtId);
  const view = debt ? debtView(debt, today) : null;
  const next = view?.status.next ?? null;
  const remaining = view?.status.remaining ?? 0;
  const borrowed = debt?.direction === "borrowed";

  const [mode, setMode] = useState<"next" | "all" | "other">(next && next.pending < remaining ? "next" : "all");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [useAccount, setUseAccount] = useState(Boolean(debt?.account_id));
  const [accountChoice, setAccountChoice] = useState(debt?.account_id ?? "");
  const [error, setError] = useState<string | null>(null);

  const options = accounts.filter((a) => !a.archived_at && a.currency === debt?.currency);
  const account = options.find((a) => a.id === accountChoice) ?? options.find((a) => a.is_default) ?? options[0];
  const cur = debt?.currency ?? "DOP";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!debt) return;
    const cents = mode === "next" ? (next?.pending ?? 0) : mode === "all" ? remaining : parseMoney(amount);
    if (!cents || cents <= 0) return setError("Escribe el monto.");
    setError(null);
    try {
      await m.pay.mutateAsync({ debt: debt.id, amount: cents, paid_on: date, account_id: useAccount ? (account?.id ?? null) : null });
    } catch {
      return;
    }
    toast({ title: borrowed ? "Pago registrado" : "Cobro registrado", description: `${formatMoney(cents, cur)} · ${debt.person}${cents >= remaining ? " · ¡saldada!" : ""}` });
    onOpenChange(false);
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title={borrowed ? "Registrar pago" : "Registrar cobro"} description={debt ? `${debt.person} · ${borrowed ? "te falta pagar" : "te falta cobrar"} ${formatMoney(remaining, cur)}` : undefined}>
        {!debt ? (
          <p className="pb-6 text-sm text-muted-foreground">No encontré esa deuda.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Segmented
              label="Cuánto"
              value={mode}
              onChange={setMode}
              options={[
                ...(next && next.pending < remaining ? [{ value: "next" as const, label: `Cuota ${next.n} (${formatMoney(next.pending, cur)})` }] : []),
                { value: "all" as const, label: `Todo (${formatMoney(remaining, cur)})` },
                { value: "other" as const, label: "Otro" },
              ]}
            />
            {mode === "next" && next && <p className="-mt-2 text-xs text-muted-foreground">Vence el {shortDate(next.due_on)}.</p>}
            {mode === "other" && <AmountField label="Monto" value={amount} onChange={setAmount} currency={cur} autoFocus />}

            <Field label={borrowed ? "Fecha del pago" : "Fecha del cobro"} htmlFor="debtpay-date">
              <DateField id="debtpay-date" value={date} onChange={setDate} />
            </Field>

            <div className="flex flex-col gap-3 rounded-2xl border border-secondary bg-card p-4">
              <div className="flex min-h-[44px] items-center justify-between gap-3">
                <label htmlFor="debtpay-use" className="min-w-0 flex-1 cursor-pointer">
                  <span className="block text-sm font-semibold">{borrowed ? "Salió de una cuenta" : "Entró a una cuenta"}</span>
                  <span className="block text-xs text-muted-foreground">Se refleja en el saldo; solo el interés cuenta como {borrowed ? "gasto" : "ingreso"}.</span>
                </label>
                <Switch id="debtpay-use" checked={useAccount} onCheckedChange={setUseAccount} />
              </div>
              {useAccount &&
                (options.length ? (
                  <AccountSelect id="debtpay-account" accounts={options} value={account?.id} onChange={setAccountChoice} />
                ) : (
                  <p className="text-xs text-muted-foreground">No tienes cuentas en {cur}.</p>
                ))}
            </div>

            {error && (
              <p className="text-sm font-semibold text-negative" role="alert">
                {error}
              </p>
            )}
            <PanelFooter>
              <Button type="submit" className="flex-1" disabled={m.pay.isPending || remaining === 0}>
                {m.pay.isPending && <Loader2 className="animate-spin" />}
                {borrowed ? "Registrar pago" : "Registrar cobro"}
              </Button>
            </PanelFooter>
          </form>
        )}
      </PanelContent>
    </Panel>
  );
}
