"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { AmountField, Field } from "@/components/forms/fields";
import { Money } from "@/components/money";
import { useAccountMutations, useAccounts, useGoalMutations, useHasPin, useProfile } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { CURRENCIES, CURRENCY_CODES, centsToInput, currencySymbol, formatMoney, parseMoney } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import type { GoalInput } from "@/lib/data/planning";
import type { Goal } from "@/lib/types";

const NEW_ACCOUNT = "__nueva__";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Si viene, el panel edita esa meta. */
  goal?: Goal;
}

type Errors = Partial<Record<"name" | "target" | "deadline", string>>;

export function GoalPanel({ open, onOpenChange, goal }: Props) {
  const { data: accounts = [] } = useAccounts();
  const { data: profile } = useProfile();
  const { data: hasPin = false } = useHasPin();
  const gm = useGoalMutations();
  const am = useAccountMutations();
  const editing = Boolean(goal);

  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? centsToInput(goal.target_amount) : "");
  const [currency, setCurrency] = useState(goal?.currency ?? profile?.default_currency ?? "DOP");
  const [accountChoice, setAccountChoice] = useState<string>(goal?.account_id ?? NEW_ACCOUNT);
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [isPrivate, setIsPrivate] = useState(goal?.is_private ?? false);
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Si la meta falla después de crear la cuenta, el reintento reutiliza esa cuenta.
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);

  // Solo cuentas en la moneda de la meta (el progreso es su saldo). La ya vinculada siempre aparece.
  const options = accounts.filter((a) => a.id === goal?.account_id || (!a.archived_at && a.currency === currency && a.id !== createdAccountId));
  const busy = gm.create.isPending || gm.update.isPending || gm.remove.isPending || am.create.isPending;
  const trimmedName = name.trim();

  function changeCurrency(c: string) {
    if (c !== currency) setCreatedAccountId(null);
    setCurrency(c);
    const acc = accounts.find((a) => a.id === accountChoice);
    if (acc && acc.currency !== c) setAccountChoice(NEW_ACCOUNT);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseMoney(target);
    const next: Errors = {};
    if (!trimmedName) next.name = "Ponle un nombre a tu meta.";
    if (!cents || cents <= 0) next.target = "Escribe una meta mayor que cero.";
    if (deadline && deadline < todayISO() && deadline !== goal?.deadline) next.deadline = "Elige una fecha de hoy en adelante.";
    setErrors(next);
    if (Object.keys(next).length || !cents) return;

    try {
      let accountId: string | null = accountChoice === NEW_ACCOUNT ? createdAccountId : accountChoice;
      if (!accountId) {
        const acc = await am.create.mutateAsync({ name: `Meta: ${trimmedName}`.slice(0, 60), type: "savings", currency, opening_balance: 0 });
        accountId = acc.id;
        setCreatedAccountId(acc.id);
      }
      const input: GoalInput = {
        name: trimmedName,
        target_amount: cents,
        currency,
        account_id: accountId,
        deadline: deadline || null,
        is_private: isPrivate,
      };
      if (goal) await gm.update.mutateAsync({ id: goal.id, patch: input });
      else await gm.create.mutateAsync(input);
    } catch {
      return; // el error ya se mostró en un aviso
    }
    toast({ title: goal ? "Meta actualizada" : "Meta creada", description: `${trimmedName} · ${isPrivate ? `${currencySymbol(currency)} ••••` : formatMoney(cents, currency)}` });
    onOpenChange(false);
  }

  async function toggleArchive() {
    if (!goal) return;
    const reactivate = goal.status !== "active";
    try {
      await gm.update.mutateAsync({ id: goal.id, patch: { status: reactivate ? "active" : "archived" } });
    } catch {
      return;
    }
    toast({ title: reactivate ? "Meta reactivada" : "Meta archivada", description: goal.name });
    onOpenChange(false);
  }

  async function remove() {
    if (!goal) return;
    try {
      await gm.remove.mutateAsync(goal.id);
    } catch {
      return;
    }
    toast({ title: "Meta eliminada", description: goal.name });
    setConfirmDelete(false);
    onOpenChange(false);
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title={editing ? "Editar meta" : "Nueva meta"}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Nombre" htmlFor="goal-name" error={errors.name}>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Viaje a Samaná, fondo de emergencia…"
              maxLength={60}
              autoFocus={!editing}
              aria-invalid={Boolean(errors.name)}
            />
          </Field>

          <AmountField label="¿Cuánto quieres juntar?" value={target} onChange={setTarget} currency={currency} tone="positive" error={errors.target} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Moneda" htmlFor="goal-currency">
              <Select value={currency} onValueChange={changeCurrency}>
                <SelectTrigger id="goal-currency">
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
            <Field label="Fecha límite (opcional)" htmlFor="goal-deadline" error={errors.deadline}>
              <Input
                id="goal-deadline"
                type="date"
                value={deadline}
                min={todayISO()}
                onChange={(e) => setDeadline(e.target.value)}
                aria-invalid={Boolean(errors.deadline)}
              />
            </Field>
          </div>

          <Field
            label="¿Dónde guardas el dinero?"
            htmlFor="goal-account"
            hint={
              accountChoice === NEW_ACCOUNT
                ? `Crearemos la cuenta de ahorro «Meta: ${trimmedName || "…"}» en ${currency}. Aporta con transferencias.`
                : "El progreso de la meta es el saldo de esta cuenta."
            }
          >
            <Select value={accountChoice} onValueChange={setAccountChoice}>
              <SelectTrigger id="goal-account">
                <SelectValue>
                  {(() => {
                    const a = options.find((x) => x.id === accountChoice);
                    return a ? `${a.name}${a.last4 ? ` ···${a.last4}` : ""}` : "Crear una cuenta de ahorro para esta meta";
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_ACCOUNT}>Crear una cuenta de ahorro para esta meta</SelectItem>
                {options.length > 0 && <SelectSeparator />}
                {options.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex w-full items-center justify-between gap-4">
                      <span>
                        {a.name}
                        {a.last4 ? ` ···${a.last4}` : ""}
                      </span>
                      <Money amount={a.balance} currency={a.currency} className="text-xs text-muted-foreground" />
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-secondary bg-card px-4 py-3">
            <label htmlFor="goal-private" className="min-w-0 flex-1 cursor-pointer">
              <span className="block text-sm font-semibold">Meta privada</span>
              <span className="block text-xs text-muted-foreground">
                {hasPin ? (
                  "Los montos se ocultan hasta que escribas tu PIN."
                ) : (
                  <>
                    Crea un PIN en{" "}
                    <Link href="/ajustes" className="font-semibold text-primary underline-offset-4 hover:underline">
                      Ajustes
                    </Link>{" "}
                    para ocultar sus montos.
                  </>
                )}
              </span>
            </label>
            {/* Sin PIN no se puede activar; si ya era privada, sí se puede desactivar. */}
            <Switch id="goal-private" checked={isPrivate} onCheckedChange={setIsPrivate} disabled={!hasPin && !isPrivate} />
          </div>

          <PanelFooter>
            {goal && (
              <>
                <Button type="button" variant="destructive-ghost" size="icon" onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Eliminar meta">
                  <Trash2 />
                </Button>
                <Button type="button" variant="secondary" onClick={toggleArchive} disabled={busy}>
                  {goal.status === "active" ? <Archive /> : <ArchiveRestore />}
                  {goal.status === "active" ? "Archivar" : "Reactivar"}
                </Button>
              </>
            )}
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? "Guardando…" : editing ? "Guardar cambios" : "Crear meta"}
            </Button>
          </PanelFooter>
        </form>
      </PanelContent>

      {goal && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar la meta «{goal.name}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Solo se borra la meta. La cuenta vinculada y su dinero se quedan como están. Si ya no la quieres ver, puedes archivarla.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={gm.remove.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={gm.remove.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  void remove();
                }}
              >
                {gm.remove.isPending ? "Eliminando…" : "Eliminar meta"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Panel>
  );
}
