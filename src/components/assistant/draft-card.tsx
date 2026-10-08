"use client";

import { useState } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { MemberAvatar } from "@/components/visuals";
import { useSheets } from "@/components/shell/sheets";
import { useAccounts, useSharedMutations, useTransactionMutations } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { dayLabel } from "@/lib/dates";
import type { SharedExpenseDraft, TransactionDraft } from "@/lib/assistant/types";
import type { Account } from "@/lib/types";
import type { UIDraft } from "./conversation";

/** Confirmar o editar borradores. Se usa una vez en el chat y se pasa a cada tarjeta. */
export function useDraftActions() {
  const accountsQuery = useAccounts();
  const accounts = accountsQuery.data ?? [];
  /** Hasta que carguen las cuentas no se sabe con cuál pagar. */
  const ready = !accountsQuery.isPending;
  const tx = useTransactionMutations();
  const shared = useSharedMutations();
  const sheets = useSheets();

  const active = accounts.filter((a) => !a.archived_at);
  const defaultAccount = active.find((a) => a.is_default) ?? active[0];

  /** Cuenta del borrador si sigue activa; si no, la predeterminada. */
  const accountForTransaction = (d: TransactionDraft): Account | undefined => active.find((a) => a.id === d.account_id) ?? defaultAccount;

  /** Para gastos compartidos que pagaste tú: la predeterminada en la moneda del grupo. */
  const accountForShared = (d: SharedExpenseDraft): Account | undefined =>
    d.payer_is_me ? (active.find((a) => a.is_default && a.currency === d.currency) ?? active.find((a) => a.currency === d.currency)) : undefined;

  async function confirm(item: UIDraft): Promise<boolean> {
    const d = item.draft;
    try {
      if (d.type === "transaction") {
        const account = accountForTransaction(d);
        if (!account) {
          toast({ title: "Elige una cuenta", description: "Toca Editar para elegir de qué cuenta sale." });
          return false;
        }
        await tx.create.mutateAsync({
          account_id: account.id,
          kind: d.kind,
          amount: d.amount,
          occurred_on: d.occurred_on,
          description: d.description,
          category_id: d.category_id,
          source: item.source,
        });
      } else {
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
      }
      return true;
    } catch {
      return false; // el aviso global ya mostró el error
    }
  }

  function edit(item: UIDraft) {
    const d = item.draft;
    if (d.type === "transaction") {
      sheets.open({
        type: "transaction",
        kind: d.kind,
        preset: {
          kind: d.kind,
          amount: d.amount,
          description: d.description,
          category_id: d.category_id,
          account_id: accountForTransaction(d)?.id,
          occurred_on: d.occurred_on,
          source: item.source,
        },
      });
    } else {
      sheets.open({
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
    }
  }

  return { ready, confirm, edit, accountForTransaction, accountForShared };
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

  const isIncome = d.type === "transaction" && d.kind === "income";
  const label = d.type === "transaction" ? (isIncome ? "Ingreso" : "Gasto") : "Gasto compartido";
  return (
    <section aria-label={saved ? `${label} guardado` : `${label} sin guardar`}className="rounded-2xl border border-secondary bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={saved ? "rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary" : "rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-foreground"}>
          {d.type === "shared_expense" ? `${label} · ${d.group_name}` : label}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{dayLabel(d.occurred_on)}</span>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-bold">{d.description}</p>
        <Money
          amount={isIncome ? d.amount : -d.amount}
          currency={d.currency}
          sign={isIncome ? "always" : "negative"}
          className={isIncome ? "text-lg font-extrabold text-positive" : "text-lg font-extrabold"}
        />
      </div>

      {d.type === "transaction" ? (
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <Detail label="Categoría">{d.category_name ?? "Sin categoría"}</Detail>
          <Detail label={isIncome ? "Entra a" : "Sale de"}>{actions.accountForTransaction(d)?.name ?? d.account_name ?? "Elige una cuenta"}</Detail>
        </dl>
      ) : (
        <SharedDetails d={d} account={actions.accountForShared(d)} />
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
