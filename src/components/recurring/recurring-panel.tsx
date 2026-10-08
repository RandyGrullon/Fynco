"use client";

import { useEffect, useState } from "react";
import { addDays } from "date-fns";
import { Trash2 } from "lucide-react";
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
import { AccountSelect, AmountField, CategoryPicker, DateField, Field, Segmented } from "@/components/forms/fields";
import { useAccounts, useCategories, useRecurringMutations } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { centsToInput, formatMoney, parseMoney } from "@/lib/money";
import { parseDate, shortDate, toISODate, todayISO } from "@/lib/dates";
import type { RecurringInput } from "@/lib/data/planning";
import type { Recurrence, RecurringRule, WeekendPolicy } from "@/lib/types";

export const FREQUENCIES: { value: Recurrence; label: string }[] = [
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
];

export const FREQUENCY_LABEL = Object.fromEntries(FREQUENCIES.map((f) => [f.value, f.label])) as Record<Recurrence, string>;

const WEEKEND_POLICIES: { value: WeekendPolicy; label: string }[] = [
  { value: "keep", label: "Mantener fecha" },
  { value: "before", label: "Mover al viernes antes" },
  { value: "after", label: "Mover al lunes después" },
];

/** Veces por mes de cada frecuencia (aproximado). */
const PER_MONTH: Record<Recurrence, number> = {
  daily: 30.44,
  weekly: 4.345,
  biweekly: 2.1725,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

/** Equivalente mensual en centavos. */
export function monthlyEquivalent(amount: number, frequency: Recurrence) {
  return Math.round(amount * PER_MONTH[frequency]);
}

/** Igual que adjust_weekend() en la base de datos: la fecha real en que cae el movimiento. */
export function adjustWeekend(iso: string, policy: WeekendPolicy) {
  if (policy === "keep") return iso;
  const d = parseDate(iso);
  const dow = d.getDay(); // 0 domingo, 6 sábado
  if (dow !== 0 && dow !== 6) return iso;
  const shift = policy === "before" ? (dow === 6 ? -1 : -2) : dow === 6 ? 2 : 1;
  return toISODate(addDays(d, shift));
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rule?: RecurringRule;
  /** Valores iniciales para una regla nueva (p. ej. desde el asistente). */
  preset?: Partial<RecurringInput>;
}

type Errors = Partial<Record<"amount" | "description" | "account" | "end", string>>;

export function RecurringPanel({ open, onOpenChange, rule, preset }: Props) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const m = useRecurringMutations();
  const editing = Boolean(rule);
  const today = todayISO();

  const [kind, setKind] = useState<"expense" | "income">(rule?.kind ?? preset?.kind ?? "expense");
  const [amount, setAmount] = useState(rule ? centsToInput(rule.amount) : preset?.amount ? centsToInput(preset.amount) : "");
  const [description, setDescription] = useState(rule?.description ?? preset?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(rule?.category_id ?? preset?.category_id ?? null);
  const [accountId, setAccountId] = useState<string | null>(rule?.account_id ?? preset?.account_id ?? null);
  const [frequency, setFrequency] = useState<Recurrence>(rule?.frequency ?? preset?.frequency ?? "monthly");
  const [startOn, setStartOn] = useState(rule?.start_on ?? preset?.start_on ?? today);
  const [endOn, setEndOn] = useState(rule?.end_on ?? "");
  const [policy, setPolicy] = useState<WeekendPolicy>(rule?.weekend_policy ?? "keep");
  const [active, setActive] = useState(rule?.active ?? true);
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Cuenta por defecto en cuanto cargan.
  useEffect(() => {
    if (!accountId && accounts.length) setAccountId((accounts.find((a) => a.is_default && !a.archived_at) ?? accounts.find((a) => !a.archived_at))?.id ?? null);
  }, [accounts, accountId]);

  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency ?? "DOP";
  const busy = m.create.isPending || m.update.isPending || m.remove.isPending;

  // El trigger reinicia el calendario si cambian inicio o frecuencia; si el inicio es pasado, se registran los pendientes.
  // Solo una regla nueva con inicio en el pasado registra lo atrasado. Editar el calendario o
  // reanudar arranca en la próxima fecha desde hoy (lo hace un trigger en la base de datos).
  const backfillFrom = !rule && startOn < today ? startOn : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseMoney(amount);
    const category = categories.find((c) => c.id === categoryId);
    const desc = description.trim() || category?.name || "";
    const next: Errors = {};
    if (!cents || cents <= 0) next.amount = "Escribe un monto mayor que cero.";
    if (!desc) next.description = "Escribe una descripción o elige una categoría.";
    if (!accountId) next.account = "Elige una cuenta.";
    if (endOn && endOn < startOn) next.end = "La fecha final no puede ser antes del inicio.";
    setErrors(next);
    if (Object.keys(next).length || !cents || !accountId) return;

    const input: RecurringInput = {
      account_id: accountId,
      kind,
      amount: cents,
      description: desc,
      category_id: categoryId,
      frequency,
      start_on: startOn,
      end_on: endOn || null,
      weekend_policy: policy,
      ...(rule ? { active } : {}),
    };
    try {
      if (rule) await m.update.mutateAsync({ id: rule.id, patch: input });
      else await m.create.mutateAsync(input);
    } catch {
      return; // el error ya se mostró en un aviso
    }
    toast({
      title: rule ? "Cambios guardados" : kind === "income" ? "Ingreso fijo creado" : "Gasto fijo creado",
      description: `${desc} · ${formatMoney(cents, currency)} ${FREQUENCY_LABEL[frequency].toLowerCase()}`,
    });
    onOpenChange(false);
  }

  async function remove() {
    if (!rule) return;
    try {
      await m.remove.mutateAsync(rule.id);
    } catch {
      return;
    }
    toast({ title: "Recurrente eliminado", description: rule.description });
    setConfirmDelete(false);
    onOpenChange(false);
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title={editing ? "Editar recurrente" : kind === "income" ? "Nuevo ingreso fijo" : "Nuevo gasto fijo"}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Segmented
            label="Tipo"
            value={kind}
            onChange={(k) => {
              setKind(k);
              setCategoryId(null);
            }}
            options={[
              { value: "expense", label: "Gasto" },
              { value: "income", label: "Ingreso" },
            ]}
          />
          <AmountField value={amount} onChange={setAmount} currency={currency} autoFocus={!editing} tone={kind === "income" ? "positive" : "negative"} error={errors.amount} />
          <Field label="Descripción" htmlFor="rec-desc" error={errors.description}>
            <Input
              id="rec-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={kind === "income" ? "Salario, alquiler cobrado…" : "Netflix, luz, gimnasio…"}
              maxLength={120}
              aria-invalid={Boolean(errors.description)}
            />
          </Field>
          <Field label="Categoría">
            <CategoryPicker categories={categories} kind={kind} value={categoryId} onChange={setCategoryId} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={kind === "income" ? "Entra a" : "Sale de"} htmlFor="rec-account" error={errors.account}>
              <AccountSelect id="rec-account" accounts={accounts} value={accountId} onChange={setAccountId} />
            </Field>
            <Field label="Frecuencia" htmlFor="rec-freq">
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Recurrence)}>
                <SelectTrigger id="rec-freq">
                  <SelectValue>{FREQUENCIES.find((f) => f.value === frequency)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Empieza" htmlFor="rec-start">
              <DateField id="rec-start" value={startOn} onChange={(v) => v && setStartOn(v)} />
            </Field>
            <Field label="Termina (opcional)" htmlFor="rec-end" error={errors.end}>
              <Input id="rec-end" type="date" value={endOn} min={startOn} onChange={(e) => setEndOn(e.target.value)} aria-invalid={Boolean(errors.end)} />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {editing
              ? "Si cambias la fecha de inicio o la frecuencia (o la reanudas), sigue desde la próxima fecha a partir de hoy; no se registra nada del pasado."
              : "El primer movimiento se registra en la fecha de inicio. Si no pones fecha final, se repite sin límite."}
          </p>
          {backfillFrom && (
            <p className="rounded-xl border border-secondary bg-card px-3.5 py-2.5 text-xs text-muted-foreground" role="status">
              Al guardar, Fynco registrará los movimientos que falten desde el <span className="font-semibold text-foreground">{shortDate(backfillFrom)}</span> hasta hoy.
            </p>
          )}
          <Field label="Si cae en fin de semana" htmlFor="rec-weekend">
            <Select value={policy} onValueChange={(v) => setPolicy(v as WeekendPolicy)}>
              <SelectTrigger id="rec-weekend">
                <SelectValue>{WEEKEND_POLICIES.find((p) => p.value === policy)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WEEKEND_POLICIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {editing && (
            <div className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-secondary bg-card px-4 py-3">
              <label htmlFor="rec-active" className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-semibold">Activo</span>
                <span className="block text-xs text-muted-foreground">Pausado, no registra movimientos nuevos.</span>
              </label>
              <Switch id="rec-active" checked={active} onCheckedChange={setActive} />
            </div>
          )}
          <PanelFooter>
            {editing && (
              <Button type="button" variant="destructive-ghost" size="icon" onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Eliminar recurrente">
                <Trash2 />
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? "Guardando…" : editing ? "Guardar cambios" : "Guardar"}
            </Button>
          </PanelFooter>
        </form>
      </PanelContent>

      {rule && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar «{rule.description}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Dejará de registrarse. Los movimientos que ya se registraron se quedan en tu historial. Si solo quieres detenerlo un tiempo, páusalo.
              </AlertDialogDescription>
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
