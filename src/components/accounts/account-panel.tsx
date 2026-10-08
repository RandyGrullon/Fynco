"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
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
import { AmountField, Field } from "@/components/forms/fields";
import { keys, useAccountMutations, useProfile } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { CURRENCIES, CURRENCY_CODES, centsToInput, formatMoney, parseMoney } from "@/lib/money";
import type { AccountInput } from "@/lib/data/accounts";
import type { Account, AccountType } from "@/lib/types";

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Corriente" },
  { value: "savings", label: "Ahorros" },
  { value: "credit", label: "Tarjeta de crédito" },
  { value: "investment", label: "Inversión" },
  { value: "cash", label: "Efectivo" },
  { value: "other", label: "Otra" },
];

export const ACCOUNT_TYPE_LABEL = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t.value, t.label])) as Record<AccountType, string>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Si viene, el panel edita esa cuenta. */
  account?: Account;
  /** Se llama después de eliminar la cuenta (p. ej. para salir de su detalle). */
  onDeleted?: () => void;
}

type Errors = Partial<Record<"name" | "opening" | "last4", string>>;

export function AccountPanel({ open, onOpenChange, account, onDeleted }: Props) {
  const { data: profile } = useProfile();
  const m = useAccountMutations();
  const qc = useQueryClient();
  const editing = Boolean(account);

  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const [currency, setCurrency] = useState(account?.currency ?? profile?.default_currency ?? "DOP");
  const [opening, setOpening] = useState(account && account.opening_balance !== 0 ? centsToInput(account.opening_balance) : "");
  const [isDebt, setIsDebt] = useState(account ? account.opening_balance < 0 : false);
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [last4, setLast4] = useState(account?.last4 ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const busy = m.create.isPending || m.update.isPending || m.remove.isPending;
  const archived = Boolean(account?.archived_at);
  const openingCents = opening.trim() ? parseMoney(opening) : 0;

  function changeType(t: AccountType) {
    setType(t);
    // Al crear, una tarjeta casi siempre arranca debiendo.
    if (!editing) setIsDebt(t === "credit");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const digits = last4.trim();
    const next: Errors = {};
    if (!trimmed) next.name = "Ponle un nombre a la cuenta.";
    if (openingCents === null) next.opening = "El saldo inicial no es un número válido.";
    if (digits && !/^\d{4}$/.test(digits)) next.last4 = "Escribe exactamente 4 números.";
    setErrors(next);
    if (Object.keys(next).length || openingCents === null) return;

    const abs = Math.abs(openingCents);
    const input: AccountInput = {
      name: trimmed,
      type,
      currency,
      opening_balance: isDebt ? -abs : abs,
      institution: institution.trim() || null,
      last4: digits || null,
    };
    try {
      if (account) await m.update.mutateAsync({ id: account.id, patch: input });
      else await m.create.mutateAsync(input);
    } catch {
      return; // el error ya se mostró en un aviso
    }
    toast({ title: account ? "Cuenta actualizada" : "Cuenta creada", description: trimmed });
    onOpenChange(false);
  }

  async function toggleArchive() {
    if (!account) return;
    try {
      await m.update.mutateAsync({ id: account.id, patch: { archived_at: archived ? null : new Date().toISOString() } });
    } catch {
      return;
    }
    toast(
      archived
        ? { title: "Cuenta restaurada", description: account.name }
        : { title: "Cuenta archivada", description: "Ya no aparece al registrar movimientos. Su historial se conserva." },
    );
    onOpenChange(false);
  }

  async function remove() {
    if (!account) return;
    try {
      await m.remove.mutateAsync(account.id);
    } catch {
      return;
    }
    // Sus recurrentes se borran en cascada.
    void qc.invalidateQueries({ queryKey: keys.recurring });
    toast({ title: "Cuenta eliminada", description: account.name });
    setConfirmDelete(false);
    onOpenChange(false);
    onDeleted?.();
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title={editing ? "Editar cuenta" : "Nueva cuenta"}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Nombre" htmlFor="acc-name" error={errors.name}>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Popular nómina, Efectivo…"
              maxLength={60}
              autoFocus={!editing}
              aria-invalid={Boolean(errors.name)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipo" htmlFor="acc-type">
              <Select value={type} onValueChange={(v) => changeType(v as AccountType)}>
                <SelectTrigger id="acc-type">
                  <SelectValue>{ACCOUNT_TYPES.find((t) => t.value === type)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Moneda" htmlFor="acc-currency" hint={editing ? "Cambiarla no convierte los montos ya registrados." : undefined}>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="acc-currency">
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

          <div className="rounded-2xl border border-secondary bg-card px-4 pb-3">
            <AmountField
              label={isDebt ? "Deuda inicial" : "Saldo inicial"}
              value={opening}
              onChange={setOpening}
              currency={currency}
              tone={isDebt ? "negative" : undefined}
              error={errors.opening}
            />
            <p className="-mt-1 pb-3 text-center text-xs text-muted-foreground">
              {isDebt && openingCents ? (
                <>
                  Empieza en <span className="tabular font-semibold text-negative">{formatMoney(-Math.abs(openingCents), currency)}</span>
                </>
              ) : (
                "Lo que tenía la cuenta al empezar a usar Fynco."
              )}
            </p>
            <div className="flex min-h-[44px] items-center justify-between gap-3 border-t border-secondary pt-3">
              <label htmlFor="acc-debt" className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-semibold">Es deuda</span>
                <span className="block text-xs text-muted-foreground">El saldo inicial cuenta en negativo (tarjetas, préstamos).</span>
              </label>
              <Switch id="acc-debt" checked={isDebt} onCheckedChange={setIsDebt} />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-4">
            <Field label="Banco (opcional)" htmlFor="acc-inst">
              <Input id="acc-inst" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Banreservas, BHD…" maxLength={60} />
            </Field>
            <Field label="Últimos 4" htmlFor="acc-last4" error={errors.last4}>
              <Input
                id="acc-last4"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="1234"
                maxLength={4}
                className="tabular"
                aria-invalid={Boolean(errors.last4)}
              />
            </Field>
          </div>

          <PanelFooter>
            {account && (
              <>
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="icon"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  aria-label="Eliminar cuenta"
                >
                  <Trash2 />
                </Button>
                <Button type="button" variant="secondary" onClick={toggleArchive} disabled={busy}>
                  {archived ? <ArchiveRestore /> : <Archive />}
                  {archived ? "Restaurar" : "Archivar"}
                </Button>
              </>
            )}
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? "Guardando…" : editing ? "Guardar cambios" : "Crear cuenta"}
            </Button>
          </PanelFooter>
        </form>
      </PanelContent>

      {account && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar «{account.name}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borrarán también todos sus movimientos (incluidas las transferencias con otras cuentas) y sus pagos recurrentes. Esto no se puede
                deshacer. Si solo quieres dejar de verla, archívala.
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
                {m.remove.isPending ? "Eliminando…" : "Eliminar cuenta"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Panel>
  );
}
