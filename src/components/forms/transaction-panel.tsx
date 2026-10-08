"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AccountSelect, AmountField, CategoryPicker, DateField, Field, Segmented } from "./fields";
import { useAccounts, useCategories, useTransactionMutations } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { centsToInput, formatMoney, parseMoney } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { db } from "@/lib/data/base";
import type { TransactionInput } from "@/lib/data/transactions";
import type { Transaction } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind?: "expense" | "income";
  tx?: Transaction;
  preset?: Partial<TransactionInput>;
}

export function TransactionPanel({ open, onOpenChange, kind: initialKind = "expense", tx, preset }: Props) {
  if (tx && (tx.kind === "shared" || tx.kind === "settlement")) {
    return <LinkedTransactionPanel open={open} onOpenChange={onOpenChange} tx={tx} />;
  }
  return <TransactionForm open={open} onOpenChange={onOpenChange} initialKind={initialKind} tx={tx} preset={preset} />;
}

function TransactionForm({ open, onOpenChange, initialKind, tx, preset }: Omit<Props, "kind"> & { initialKind: "expense" | "income" }) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const m = useTransactionMutations();
  const editing = Boolean(tx);

  const [kind, setKind] = useState<"expense" | "income">(tx ? (tx.kind === "income" ? "income" : "expense") : (preset?.kind ?? initialKind));
  const [amount, setAmount] = useState(tx ? centsToInput(tx.amount) : preset?.amount ? centsToInput(preset.amount) : "");
  const [description, setDescription] = useState(tx?.description ?? preset?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(tx?.category_id ?? preset?.category_id ?? null);
  const [accountId, setAccountId] = useState<string | null>(tx?.account_id ?? preset?.account_id ?? null);
  const [date, setDate] = useState(tx?.occurred_on ?? preset?.occurred_on ?? todayISO());
  const [note, setNote] = useState(tx?.note ?? preset?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  // Cuenta por defecto en cuanto cargan.
  useEffect(() => {
    if (!accountId && accounts.length) setAccountId((accounts.find((a) => a.is_default && !a.archived_at) ?? accounts.find((a) => !a.archived_at))?.id ?? null);
  }, [accounts, accountId]);

  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency ?? "DOP";
  const busy = m.create.isPending || m.update.isPending || m.remove.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!cents || cents <= 0) return setError("Escribe un monto mayor que cero.");
    if (!accountId) return setError("Elige una cuenta.");
    setError(null);
    const category = categories.find((c) => c.id === categoryId);
    const input: TransactionInput = {
      account_id: accountId,
      kind,
      amount: cents,
      occurred_on: date,
      description: description.trim() || category?.name || (kind === "income" ? "Ingreso" : "Gasto"),
      category_id: categoryId,
      note: note.trim() || null,
      source: preset?.source ?? "manual",
    };
    try {
      if (tx) await m.update.mutateAsync({ id: tx.id, input });
      else await m.create.mutateAsync(input);
    } catch {
      return; // el error ya se mostró en un aviso
    }
    toast({ title: tx ? "Movimiento actualizado" : kind === "income" ? "Ingreso registrado" : "Gasto registrado", description: formatMoney(cents, currency) });
    onOpenChange(false);
  }

  async function remove() {
    if (!tx) return;
    try {
      await m.remove.mutateAsync(tx.id);
    } catch {
      return;
    }
    toast({ title: "Movimiento eliminado" });
    onOpenChange(false);
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title={editing ? "Editar movimiento" : kind === "income" ? "Nuevo ingreso" : "Nuevo gasto"}>
        <form onSubmit={submit} className="flex flex-col gap-4">
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
          <AmountField value={amount} onChange={setAmount} currency={currency} autoFocus={!editing} tone={kind === "income" ? "positive" : "negative"} />
          <Field label="Descripción" htmlFor="tx-desc">
            <Input id="tx-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === "income" ? "Salario, venta…" : "Supermercado, almuerzo…"} maxLength={120} />
          </Field>
          <Field label="Categoría">
            <CategoryPicker categories={categories} kind={kind} value={categoryId} onChange={setCategoryId} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={kind === "income" ? "Entra a" : "Sale de"} htmlFor="tx-account">
              <AccountSelect id="tx-account" accounts={accounts} value={accountId} onChange={setAccountId} />
            </Field>
            <Field label="Fecha" htmlFor="tx-date">
              <DateField id="tx-date" value={date} onChange={setDate} />
            </Field>
          </div>
          <Field label="Nota (opcional)" htmlFor="tx-note">
            <Textarea id="tx-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
          </Field>
          {error && (
            <p className="text-sm font-semibold text-negative" role="alert">
              {error}
            </p>
          )}
          <PanelFooter>
            {editing && (
              <Button type="button" variant="destructive-ghost" size="icon" onClick={remove} disabled={busy} aria-label="Eliminar movimiento">
                <Trash2 />
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? "Guardando…" : editing ? "Guardar cambios" : "Guardar"}
            </Button>
          </PanelFooter>
        </form>
      </PanelContent>
    </Panel>
  );
}

/** Movimientos que nacen de un gasto compartido o un pago: se editan desde el grupo. */
function LinkedTransactionPanel({ open, onOpenChange, tx }: { open: boolean; onOpenChange: (o: boolean) => void; tx: Transaction }) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const { data: accounts = [] } = useAccounts();
  const account = accounts.find((a) => a.id === tx.account_id);

  useEffect(() => {
    const table = tx.shared_expense_id ? "shared_expenses" : "settlements";
    const id = tx.shared_expense_id ?? tx.settlement_id;
    if (!id) return;
    db()
      .from(table)
      .select("group_id")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return setGroupId("none");
        setGroupId((data as { group_id: string }).group_id);
      });
  }, [tx.shared_expense_id, tx.settlement_id]);

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title={tx.description || "Movimiento"} description={tx.kind === "shared" ? "Pagaste un gasto compartido" : "Pago de una deuda compartida"}>
        <div className="flex flex-col gap-3 pb-3">
          <div className="rounded-xl border border-secondary bg-card p-4">
            <p className="text-sm text-muted-foreground">{tx.amount < 0 ? "Salió de" : "Entró a"} {account?.name ?? "tu cuenta"}</p>
            <p className="tabular mt-1 text-2xl font-extrabold">{formatMoney(tx.amount, account?.currency ?? "DOP")}</p>
          </div>
          {tx.kind === "shared" && (
            <p className="text-sm text-muted-foreground">
              En tus estadísticas cuenta solo tu parte del gasto; el resto es dinero que te deben.
            </p>
          )}
          {groupId === "none" ? (
            <p className="text-sm text-muted-foreground">Ya no tienes acceso a ese grupo, así que no se puede editar desde aquí.</p>
          ) : groupId ? (
            <Button asChild>
              <Link href={`/compartido/${groupId}`} onClick={() => onOpenChange(false)}>
                Abrir el grupo para editarlo
              </Link>
            </Button>
          ) : (
            <Button disabled>Cargando grupo…</Button>
          )}
        </div>
      </PanelContent>
    </Panel>
  );
}
