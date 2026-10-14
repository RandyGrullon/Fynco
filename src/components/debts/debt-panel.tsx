"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AccountSelect, AmountField, DateField, Field, Segmented } from "@/components/forms/fields";
import { useAccounts, useDebtMutations, useProfile } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { shortDate, todayISO } from "@/lib/dates";
import { FREQUENCY_LABEL, debtTerms, defaultFirstDue, type DebtFrequency, type InterestPeriod } from "@/lib/debts";
import { CURRENCIES, CURRENCY_CODES, centsToInput, formatMoney, parseMoney } from "@/lib/money";
import type { DebtInput } from "@/lib/data/debts";
import type { PersonDebt } from "@/lib/types";

type Errors = Partial<Record<"person" | "principal" | "installments" | "rate" | "dates", string>>;

/** Nueva deuda o préstamo (o editar uno). Las cuotas y el interés se calculan solos. */
export function DebtPanel({
  open,
  onOpenChange,
  debt,
  direction: initialDirection,
  preset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  debt?: PersonDebt;
  direction?: PersonDebt["direction"];
  /** Valores iniciales (p. ej. desde un borrador del asistente). */
  preset?: Partial<DebtInput>;
}) {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: accounts = [] } = useAccounts();
  const m = useDebtMutations();
  const init = debt ?? preset;
  const today = todayISO();

  const [direction, setDirection] = useState<PersonDebt["direction"]>(init?.direction ?? initialDirection ?? "borrowed");
  const [person, setPerson] = useState(init?.person ?? "");
  const [principal, setPrincipal] = useState(init?.principal ? centsToInput(init.principal) : "");
  const [currency, setCurrency] = useState(init?.currency ?? profile?.default_currency ?? "DOP");
  const [startedOn, setStartedOn] = useState(init?.started_on ?? today);
  const [plan, setPlan] = useState<"single" | "installments">(init?.frequency && init.frequency !== "once" ? "installments" : "single");
  const [frequency, setFrequency] = useState<Exclude<DebtFrequency, "once">>(init?.frequency && init.frequency !== "once" ? init.frequency : "monthly");
  const [count, setCount] = useState(init?.installments && init.installments > 1 ? String(init.installments) : "3");
  const [firstDue, setFirstDue] = useState(init?.first_due_on ?? defaultFirstDue(init?.started_on ?? today, "monthly"));
  const [firstDueTouched, setFirstDueTouched] = useState(Boolean(init?.first_due_on));
  const [rate, setRate] = useState(init?.interest_rate ? String(init.interest_rate) : "");
  const [period, setPeriod] = useState<Exclude<InterestPeriod, "none">>(init?.interest_period && init.interest_period !== "none" ? init.interest_period : "monthly");
  const [useAccount, setUseAccount] = useState(Boolean(init?.account_id));
  const [accountChoice, setAccountChoice] = useState(init?.account_id ?? "");
  const [note, setNote] = useState(init?.note ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const borrowed = direction === "borrowed";
  const freq: DebtFrequency = plan === "single" ? "once" : frequency;
  const n = plan === "single" ? 1 : Math.floor(Number(count));
  const principalCents = principal.trim() ? parseMoney(principal) : null;
  const rateNum = rate.trim() ? Number(rate.replace(",", ".")) : 0;
  const options = accounts.filter((a) => !a.archived_at && a.currency === currency);
  const account = options.find((a) => a.id === accountChoice) ?? options.find((a) => a.is_default) ?? options[0];

  // La primera cuota sigue a la fecha del préstamo mientras no la cambien a mano.
  const dueValue = firstDueTouched ? firstDue : defaultFirstDue(startedOn, freq === "once" ? "monthly" : freq);

  const terms = useMemo(() => {
    if (!principalCents || principalCents <= 0 || !(n >= 1) || dueValue < startedOn || !(rateNum >= 0)) return null;
    return debtTerms({
      principal: principalCents,
      started_on: startedOn,
      interest_rate: rateNum,
      interest_period: rateNum > 0 ? period : "none",
      installments: n,
      frequency: freq,
      first_due_on: dueValue,
    });
  }, [principalCents, n, dueValue, startedOn, rateNum, period, freq]);

  const busy = m.save.isPending || m.remove.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!person.trim()) next.person = borrowed ? "¿Quién te prestó?" : "¿A quién le prestaste?";
    if (!principalCents || principalCents <= 0) next.principal = "Escribe el monto del préstamo.";
    if (plan === "installments" && !(n >= 2 && n <= 360)) next.installments = "Entre 2 y 360 cuotas.";
    if (!(rateNum >= 0 && rateNum <= 1000)) next.rate = "Un porcentaje entre 0 y 1000.";
    if (dueValue < startedOn) next.dates = "El pago no puede ser antes del préstamo.";
    setErrors(next);
    if (Object.keys(next).length || !principalCents) return;

    const input: DebtInput = {
      direction,
      person: person.trim(),
      principal: principalCents,
      currency,
      started_on: startedOn,
      interest_rate: rateNum,
      interest_period: rateNum > 0 ? period : "none",
      installments: n,
      frequency: freq,
      first_due_on: dueValue,
      account_id: useAccount ? (account?.id ?? null) : null,
      note: note.trim() || null,
    };
    let id: string;
    try {
      id = await m.save.mutateAsync({ id: debt?.id ?? null, input });
    } catch {
      return; // el aviso global ya mostró el error
    }
    toast({ title: debt ? "Deuda actualizada" : borrowed ? "Deuda agregada" : "Préstamo agregado", description: person.trim() });
    onOpenChange(false);
    if (!debt) router.push(`/deudas/${id}`);
  }

  async function remove() {
    if (!debt) return;
    try {
      await m.remove.mutateAsync(debt.id);
    } catch {
      return;
    }
    toast({ title: "Deuda eliminada", description: debt.person });
    setConfirmDelete(false);
    onOpenChange(false);
    router.replace("/deudas");
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title={debt ? "Editar deuda" : "Nueva deuda o préstamo"}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Segmented
            label="Tipo"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "borrowed", label: "Me prestaron" },
              { value: "lent", label: "Yo presté" },
            ]}
          />
          <Field label={borrowed ? "¿Quién te prestó?" : "¿A quién le prestaste?"} htmlFor="debt-person" error={errors.person}>
            <Input id="debt-person" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Nombre" maxLength={60} autoFocus={!debt} />
          </Field>

          <div className="rounded-2xl border border-secondary bg-card px-4">
            <AmountField label="Monto prestado" value={principal} onChange={setPrincipal} currency={currency} error={errors.principal} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha del préstamo" htmlFor="debt-start">
              <DateField id="debt-start" value={startedOn} onChange={setStartedOn} />
            </Field>
            <Field label="Moneda" htmlFor="debt-currency">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="debt-currency">
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
          </div>

          <Segmented
            label="Forma de pago"
            value={plan}
            onChange={setPlan}
            options={[
              { value: "single", label: "Un solo pago" },
              { value: "installments", label: "En cuotas" },
            ]}
          />
          {plan === "installments" && (
            <div className="grid grid-cols-[110px_1fr] gap-4">
              <Field label="Cuotas" htmlFor="debt-count" error={errors.installments}>
                <Input id="debt-count" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className="tabular" />
              </Field>
              <Field label="Cada cuánto">
                <Segmented
                  label="Frecuencia"
                  value={frequency}
                  onChange={setFrequency}
                  options={[
                    { value: "weekly", label: "Semana" },
                    { value: "biweekly", label: "Quincena" },
                    { value: "monthly", label: "Mes" },
                  ]}
                />
              </Field>
            </div>
          )}
          <Field label={plan === "single" ? "Fecha límite de pago" : "Primera cuota"} htmlFor="debt-due" error={errors.dates}>
            <DateField
              id="debt-due"
              value={dueValue}
              onChange={(v) => {
                setFirstDue(v);
                setFirstDueTouched(true);
              }}
            />
          </Field>

          <div className="grid grid-cols-[110px_1fr] gap-4">
            <Field label="Interés %" htmlFor="debt-rate" error={errors.rate} hint="Opcional">
              <Input id="debt-rate" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, "").slice(0, 7))} inputMode="decimal" placeholder="0" className="tabular" />
            </Field>
            <Field label="El % es">
              <Segmented
                label="Período del interés"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "monthly", label: "Mensual" },
                  { value: "annual", label: "Anual" },
                  { value: "total", label: "Total" },
                ]}
              />
            </Field>
          </div>

          {terms && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm" aria-live="polite">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Interés{rateNum > 0 && period !== "total" ? ` (≈ ${terms.months.toFixed(terms.months % 1 ? 1 : 0)} ${terms.months === 1 ? "mes" : "meses"})` : ""}</span>
                <span className="tabular font-semibold">{formatMoney(terms.interest, currency)}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Total {borrowed ? "a pagar" : "a cobrar"}</span>
                <span className="tabular font-extrabold">{formatMoney(terms.total, currency)}</span>
              </div>
              <p className="mt-2 border-t border-secondary pt-2 text-xs text-muted-foreground">
                {terms.installments.length === 1
                  ? `Un pago de ${formatMoney(terms.total, currency)} el ${shortDate(terms.last_due_on)}.`
                  : `${terms.installments.length} cuotas ${FREQUENCY_LABEL[freq].toLowerCase()}es de ${formatMoney(terms.installments[0].amount, currency)}, del ${shortDate(terms.installments[0].due_on)} al ${shortDate(terms.last_due_on)}.`}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-2xl border border-secondary bg-card p-4">
            <div className="flex min-h-[44px] items-center justify-between gap-3">
              <label htmlFor="debt-use-account" className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-semibold">{borrowed ? "El dinero entró a una cuenta" : "El dinero salió de una cuenta"}</span>
                <span className="block text-xs text-muted-foreground">Así el préstamo y los pagos se reflejan en su saldo. Solo el interés cuenta como {borrowed ? "gasto" : "ingreso"}.</span>
              </label>
              <Switch id="debt-use-account" checked={useAccount} onCheckedChange={setUseAccount} />
            </div>
            {useAccount &&
              (options.length ? (
                <AccountSelect id="debt-account" accounts={options} value={account?.id} onChange={setAccountChoice} />
              ) : (
                <p className="text-xs text-muted-foreground">No tienes cuentas en {currency}.</p>
              ))}
          </div>

          <Field label="Nota (opcional)" htmlFor="debt-note">
            <Input id="debt-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Para qué fue, acuerdos…" />
          </Field>

          <PanelFooter>
            {debt && (
              <Button type="button" variant="destructive-ghost" size="icon" onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Eliminar deuda">
                <Trash2 />
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={busy}>
              {m.save.isPending && <Loader2 className="animate-spin" />}
              {debt ? "Guardar cambios" : borrowed ? "Agregar deuda" : "Agregar préstamo"}
            </Button>
          </PanelFooter>
        </form>
      </PanelContent>

      {debt && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar la deuda con {debt.person}?</AlertDialogTitle>
              <AlertDialogDescription>Se borran también sus pagos y lo que se registró en tus cuentas. Esto no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={m.remove.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={m.remove.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  void remove();
                }}
              >
                {m.remove.isPending ? "Eliminando…" : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Panel>
  );
}
