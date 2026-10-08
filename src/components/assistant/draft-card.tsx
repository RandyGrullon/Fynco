"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { MemberAvatar } from "@/components/visuals";
import { useSheets } from "@/components/shell/sheets";
import { RecurringPanel } from "@/components/recurring/recurring-panel";
import { useAccounts, useRecurringMutations, useSharedMutations, useTransactionMutations } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { dayLabel, shortDate } from "@/lib/dates";
import type { Draft, RecurringDraft, SettlementDraft, SharedExpenseDraft, TransactionDraft, TransferDraft } from "@/lib/assistant/types";
import type { Account } from "@/lib/types";
import type { UIDraft } from "./conversation";

const FREQUENCY_LABEL: Record<RecurringDraft["frequency"], string> = {
  daily: "Cada día",
  weekly: "Cada semana",
  biweekly: "Cada quincena",
  monthly: "Cada mes",
  quarterly: "Cada trimestre",
  yearly: "Cada año",
};

/** Confirmar o editar borradores. Se usa una vez en el chat y se pasa a cada tarjeta. */
export function useDraftActions() {
  const accountsQuery = useAccounts();
  const accounts = accountsQuery.data ?? [];
  /** Hasta que carguen las cuentas no se sabe con cuál pagar. */
  const ready = !accountsQuery.isPending;
  const tx = useTransactionMutations();
  const shared = useSharedMutations();
  const recurring = useRecurringMutations();
  const sheets = useSheets();
  const [editingRecurring, setEditingRecurring] = useState<RecurringDraft | null>(null);

  const active = accounts.filter((a) => !a.archived_at);
  const defaultAccount = active.find((a) => a.is_default) ?? active[0];
  const byId = (id: string | null) => (id ? active.find((a) => a.id === id) : undefined);

  /** Cuenta del borrador si sigue activa; si no, la predeterminada. */
  const accountForTransaction = (d: TransactionDraft | RecurringDraft): Account | undefined => byId(d.account_id) ?? defaultAccount;

  /** Para gastos compartidos que pagaste tú: la predeterminada en la moneda del grupo. */
  const accountForShared = (d: SharedExpenseDraft): Account | undefined =>
    d.payer_is_me ? (active.find((a) => a.is_default && a.currency === d.currency) ?? active.find((a) => a.currency === d.currency)) : undefined;

  async function confirm(item: UIDraft): Promise<boolean> {
    const d = item.draft;
    try {
      switch (d.type) {
        case "transaction": {
          const account = accountForTransaction(d);
          if (!account) {
            toast({ title: "Elige una cuenta", description: "Toca Editar para elegir de qué cuenta sale." });
            return false;
          }
          await tx.create.mutateAsync({ account_id: account.id, kind: d.kind, amount: d.amount, occurred_on: d.occurred_on, description: d.description, category_id: d.category_id, source: item.source });
          break;
        }
        case "shared_expense": {
          const account = accountForShared(d);
          await shared.saveExpense.mutateAsync({
            group_id: d.group_id,
            description: d.description,
            amount: d.amount,
            occurred_on: d.occurred_on,
            category_id: d.category_id,
            split_method: "equal",
            payers: [{ member_id: d.payer_member_id, amount: d.amount }],
            shares: d.shares.map((s) => ({ member_id: s.member_id, amount: s.amount })),
            account_id: d.payer_is_me ? (account?.id ?? null) : null,
          });
          break;
        }
        case "transfer": {
          if (d.currency !== d.to_currency && !d.to_amount) {
            toast({ title: "Falta cuánto llegó", description: "Las monedas son distintas: toca Editar para indicar el monto recibido." });
            return false;
          }
          await tx.transfer.mutateAsync({ from: d.from_account_id, to: d.to_account_id, amount: d.amount, to_amount: d.to_amount, occurred_on: d.occurred_on, description: d.description });
          break;
        }
        case "settlement": {
          const account = byId(d.account_id);
          await shared.settle.mutateAsync({ group_id: d.group_id, from_member: d.from_member_id, to_member: d.to_member_id, amount: d.amount, occurred_on: d.occurred_on, account_id: account?.id ?? null });
          break;
        }
        case "recurring": {
          const account = accountForTransaction(d);
          if (!account) {
            toast({ title: "Elige una cuenta", description: "Toca Editar para elegir la cuenta." });
            return false;
          }
          await recurring.create.mutateAsync({
            account_id: account.id,
            kind: d.kind,
            amount: d.amount,
            description: d.description,
            category_id: d.category_id,
            frequency: d.frequency,
            start_on: d.start_on,
            end_on: null,
            weekend_policy: "keep",
          });
          break;
        }
      }
      return true;
    } catch {
      return false; // el aviso global ya mostró el error
    }
  }

  function edit(item: UIDraft) {
    const d = item.draft;
    switch (d.type) {
      case "transaction":
        return sheets.open({
          type: "transaction",
          kind: d.kind,
          preset: { kind: d.kind, amount: d.amount, description: d.description, category_id: d.category_id, account_id: accountForTransaction(d)?.id, occurred_on: d.occurred_on, source: item.source },
        });
      case "shared_expense":
        return sheets.open({
          type: "expense",
          groupId: d.group_id,
          preset: {
            description: d.description,
            amount: d.amount,
            category_id: d.category_id,
            occurred_on: d.occurred_on,
            payer_member_id: d.payer_member_id,
            member_ids: d.shares.filter((s) => s.amount > 0).map((s) => s.member_id),
          },
        });
      case "transfer":
        return sheets.open({ type: "transfer", preset: { from: d.from_account_id, to: d.to_account_id, amount: d.amount, description: d.description } });
      case "settlement":
        return sheets.open({ type: "settle", groupId: d.group_id, from: d.from_member_id, to: d.to_member_id, amount: d.amount });
      case "recurring":
        return setEditingRecurring(d);
    }
  }

  /** Panel de recurrente para "Editar" (no está en los paneles globales). */
  const recurringEditor = editingRecurring ? (
    <RecurringPanel
      open
      onOpenChange={(o) => !o && setEditingRecurring(null)}
      preset={{
        kind: editingRecurring.kind,
        amount: editingRecurring.amount,
        description: editingRecurring.description,
        category_id: editingRecurring.category_id,
        account_id: accountForTransaction(editingRecurring)?.id,
        frequency: editingRecurring.frequency,
        start_on: editingRecurring.start_on,
      }}
    />
  ) : null;

  return { ready, confirm, edit, accountForTransaction, accountForShared, byId, recurringEditor };
}

export type DraftActions = ReturnType<typeof useDraftActions>;

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold">{children}</dd>
    </div>
  );
}

function labelFor(d: Draft) {
  switch (d.type) {
    case "transaction":
      return d.kind === "income" ? "Ingreso" : "Gasto";
    case "shared_expense":
      return `Gasto compartido · ${d.group_name}`;
    case "transfer":
      return d.goal_name ? `Meta · ${d.goal_name}` : "Transferencia";
    case "settlement":
      return `Saldar · ${d.group_name}`;
    case "recurring":
      return d.kind === "income" ? "Ingreso recurrente" : "Gasto recurrente";
  }
}

function titleFor(d: Draft) {
  if (d.type === "settlement") return d.i_pay ? `Le pagaste a ${d.to_name}` : `${d.from_name} te pagó`;
  return d.description;
}

export function DraftCard({ item, actions, onSaved }: { item: UIDraft; actions: DraftActions; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const d = item.draft;
  const saved = item.status === "saved";

  async function confirm() {
    if (busy || saved) return;
    setBusy(true);
    const ok = await actions.confirm(item);
    setBusy(false);
    if (ok) onSaved();
  }

  const positive = (d.type === "transaction" || d.type === "recurring") && d.kind === "income";
  const neutral = d.type === "transfer" || d.type === "settlement";
  const label = labelFor(d);
  const when = d.type === "recurring" ? `Desde ${shortDate(d.start_on)}` : dayLabel(d.occurred_on);

  return (
    <section aria-label={saved ? `${label} guardado` : `${label} sin guardar`} className="rounded-2xl border border-secondary bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={saved ? "truncate rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary" : "truncate rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-foreground"}>{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-bold">{titleFor(d)}</p>
        <Money
          amount={neutral || positive ? d.amount : -d.amount}
          currency={d.currency}
          sign={positive ? "always" : neutral ? "never" : "negative"}
          className={positive ? "text-lg font-extrabold text-positive" : "text-lg font-extrabold"}
        />
      </div>

      {d.type === "transaction" && (
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <Detail label="Categoría">{d.category_name ?? "Sin categoría"}</Detail>
          <Detail label={d.kind === "income" ? "Entra a" : "Sale de"}>{actions.accountForTransaction(d)?.name ?? d.account_name ?? "Elige una cuenta"}</Detail>
        </dl>
      )}
      {d.type === "shared_expense" && <SharedDetails d={d} account={actions.accountForShared(d)} />}
      {d.type === "transfer" && <TransferDetails d={d} />}
      {d.type === "settlement" && <SettlementDetails d={d} account={actions.byId(d.account_id)} />}
      {d.type === "recurring" && (
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <Detail label="Frecuencia">{FREQUENCY_LABEL[d.frequency]}</Detail>
          <Detail label={d.kind === "income" ? "Entra a" : "Sale de"}>{actions.accountForTransaction(d)?.name ?? d.account_name ?? "Elige una cuenta"}</Detail>
          <Detail label="Categoría">{d.category_name ?? "Sin categoría"}</Detail>
        </dl>
      )}

      {saved ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-bold text-primary" role="status">
          <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" /> Guardado
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" className="h-11" onClick={confirm} disabled={busy || !actions.ready}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            Confirmar
          </Button>
          <Button type="button" variant="secondary" className="h-11" onClick={() => actions.edit(item)} disabled={busy}>
            <Pencil aria-hidden="true" /> Editar
          </Button>
        </div>
      )}
    </section>
  );
}

function SharedDetails({ d, account }: { d: SharedExpenseDraft; account: Account | undefined }) {
  return (
    <>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Detail label="Pagó">{d.payer_name}</Detail>
        <Detail label="Categoría">{d.category_name ?? "Sin categoría"}</Detail>
        {d.payer_is_me && <Detail label="Sale de">{account?.name ?? `Sin cuenta en ${d.currency}`}</Detail>}
        <Detail label="Reparto">Partes iguales</Detail>
      </dl>
      <ul className="mt-3 flex flex-col gap-2 border-t border-secondary pt-3" aria-label="Reparto por persona">
        {d.shares.map((s) => (
          <li key={s.member_id} className="flex items-center gap-2.5">
            <MemberAvatar name={s.name} seed={s.member_id} isMe={s.is_me} size={28} />
            <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
            <Money amount={s.amount} currency={d.currency} className="text-sm font-semibold" />
          </li>
        ))}
      </ul>
    </>
  );
}

function TransferDetails({ d }: { d: TransferDraft }) {
  const cross = d.currency !== d.to_currency;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="truncate">{d.from_account_name}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="hacia" />
        <span className="truncate">{d.to_account_name}</span>
      </p>
      {cross && (
        <p className="text-xs text-muted-foreground">
          Llega: {d.to_amount ? <Money amount={d.to_amount} currency={d.to_currency} className="font-semibold text-foreground" /> : "falta indicarlo (toca Editar)"}
        </p>
      )}
    </div>
  );
}

function SettlementDetails({ d, account }: { d: SettlementDraft; account: Account | undefined }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3">
      <Detail label="Paga">{d.from_name}</Detail>
      <Detail label="Recibe">{d.to_name}</Detail>
      <Detail label={d.i_pay ? "Sale de" : "Entra a"}>{account?.name ?? "Sin ligar a una cuenta"}</Detail>
    </dl>
  );
}
