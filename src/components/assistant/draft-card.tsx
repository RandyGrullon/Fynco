"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { MemberAvatar } from "@/components/visuals";
import { useSheets } from "@/components/shell/sheets";
import { RecurringPanel } from "@/components/recurring/recurring-panel";
import { ACCOUNT_TYPE_LABEL, AccountPanel } from "@/components/accounts/account-panel";
import { useAccountMutations, useAccounts, useRecurringMutations, useSharedMutations, useTransactionMutations } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { dayLabel, shortDate } from "@/lib/dates";
import type { AccountDraft, CardDebtDraft, CardPaymentDraft, Draft, RecurringDraft, SettlementDraft, SharedExpenseDraft, TransactionDraft, TransferDraft } from "@/lib/assistant/types";
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
  const accountM = useAccountMutations();
  const sheets = useSheets();
  const [editingRecurring, setEditingRecurring] = useState<RecurringDraft | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountDraft | null>(null);

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
        case "account": {
          await accountM.create.mutateAsync(accountInput(d));
          break;
        }
        case "card_payment": {
          const from = paymentSource(d);
          if (!from) {
            toast({ title: "Elige la cuenta", description: "¿Desde qué cuenta pagaste la tarjeta?" });
            return false;
          }
          await accountM.payCard.mutateAsync({ card: d.card_id, from: from.id, amount: d.amount, occurred_on: d.occurred_on });
          break;
        }
        case "card_debt": {
          await accountM.setCardDebt.mutateAsync({ card: d.card_id, debt: d.new_debt, occurred_on: d.occurred_on });
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
      case "account":
        return setEditingAccount(d);
      case "card_payment":
        return sheets.open({ type: "card_payment", cardId: d.card_id });
      case "card_debt":
        return sheets.open({ type: "card_balance", cardId: d.card_id });
    }
  }

  /** Cuentas con que se puede pagar una tarjeta: no son tarjetas y están en su moneda. */
  const paymentSources = (d: CardPaymentDraft) => active.filter((a) => a.type !== "credit" && a.currency === d.currency);
  const paymentSource = (d: CardPaymentDraft) => {
    const list = paymentSources(d);
    return list.find((a) => a.id === d.from_account_id) ?? list.find((a) => a.is_default) ?? list[0];
  };

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

  /** Panel de cuenta nueva para "Editar" un borrador de cuenta. */
  const accountEditor = editingAccount ? <AccountPanel open onOpenChange={(o) => !o && setEditingAccount(null)} preset={accountInput(editingAccount)} /> : null;

  return { ready, confirm, edit, accountForTransaction, accountForShared, byId, recurringEditor, accountEditor, paymentSources, paymentSource };
}

/** Datos para crear la cuenta. Los campos de tarjeta solo se envían en tarjetas. */
function accountInput(d: AccountDraft) {
  return {
    name: d.name,
    type: d.account_type,
    currency: d.currency,
    opening_balance: d.opening_balance,
    institution: d.institution,
    last4: d.last4,
    ...(d.account_type === "credit"
      ? { statement_day: d.statement_day, payment_due_day: d.payment_due_day, ...(d.credit_limit ? { credit_limit: d.credit_limit } : {}) }
      : {}),
  };
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
    case "account":
      return d.account_type === "credit" ? "Nueva tarjeta" : "Nueva cuenta";
    case "card_payment":
      return "Tarjeta pagada";
    case "card_debt":
      return "Deuda de tarjeta";
  }
}

function titleFor(d: Draft) {
  if (d.type === "settlement") return d.i_pay ? `Le pagaste a ${d.to_name}` : `${d.from_name} te pagó`;
  if (d.type === "account" || d.type === "card_debt") return d.type === "account" ? d.name : d.card_name;
  if (d.type === "card_payment") return `Pago ${d.card_name}`;
  return d.description;
}

export function DraftCard({
  item,
  actions,
  onSaved,
  onUpdate,
  locked,
}: {
  item: UIDraft;
  actions: DraftActions;
  onSaved: () => void;
  /** Cambios hechos en la misma tarjeta (p. ej. la cuenta con que se pagó). */
  onUpdate?: (d: Draft) => void;
  locked?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const d = item.draft;
  const saved = item.status === "saved";

  async function confirm() {
    if (busy || saved || locked) return;
    setBusy(true);
    const ok = await actions.confirm(item);
    setBusy(false);
    if (ok) onSaved();
  }

  const positive = (d.type === "transaction" || d.type === "recurring") && d.kind === "income";
  const neutral = d.type === "transfer" || d.type === "settlement" || d.type === "card_payment";
  const label = labelFor(d);
  const when = d.type === "recurring" ? `Desde ${shortDate(d.start_on)}` : d.type === "account" ? (d.institution ?? "") : dayLabel(d.occurred_on);

  return (
    <section aria-label={saved ? `${label} guardado` : `${label} sin guardar`} className="rounded-2xl border border-secondary bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={saved ? "truncate rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary" : "truncate rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-foreground"}>{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-bold">{titleFor(d)}</p>
        {d.type === "account" ? (
          <Money amount={d.opening_balance} currency={d.currency} className={d.opening_balance < 0 ? "text-lg font-extrabold text-negative" : "text-lg font-extrabold"} />
        ) : d.type === "card_debt" ? (
          <Money amount={-d.new_debt} currency={d.currency} className="text-lg font-extrabold" />
        ) : (
          <Money
            amount={neutral || positive ? d.amount : -d.amount}
            currency={d.currency}
            sign={positive ? "always" : neutral ? "never" : "negative"}
            className={positive ? "text-lg font-extrabold text-positive" : "text-lg font-extrabold"}
          />
        )}
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
      {d.type === "account" && <AccountDetails d={d} />}
      {d.type === "card_payment" && <CardPaymentDetails d={d} actions={actions} saved={saved} onUpdate={onUpdate} />}
      {d.type === "card_debt" && <CardDebtDetails d={d} />}
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
          <Button type="button" className="h-11" onClick={confirm} disabled={busy || locked || !actions.ready}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            Confirmar
          </Button>
          <Button type="button" variant="secondary" className="h-11" onClick={() => actions.edit(item)} disabled={busy || locked}>
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

function CardPaymentDetails({ d, actions, saved, onUpdate }: { d: CardPaymentDraft; actions: DraftActions; saved: boolean; onUpdate?: (d: Draft) => void }) {
  const sources = actions.paymentSources(d);
  const from = actions.paymentSource(d);
  return (
    <div className="mt-3 flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3">
        <Detail label="Debías">
          <Money amount={d.debt} currency={d.currency} />
        </Detail>
        <Detail label="Entra a">{d.card_name}</Detail>
      </dl>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-primary">¿Desde qué cuenta pagaste?</span>
        {sources.length ? (
          <select
            value={from?.id ?? ""}
            disabled={saved}
            onChange={(e) => {
              const a = sources.find((x) => x.id === e.target.value);
              if (a) onUpdate?.({ ...d, from_account_id: a.id, from_account_name: a.name });
            }}
            className="h-11 rounded-xl border border-secondary bg-background px-3 text-sm font-semibold text-foreground disabled:opacity-70"
          >
            {sources.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.last4 ? ` ···${a.last4}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-muted-foreground">No tienes cuentas en {d.currency}. Crea una para registrar el pago.</span>
        )}
      </label>
    </div>
  );
}

function CardDebtDetails({ d }: { d: CardDebtDraft }) {
  const diff = d.new_debt - d.current_debt;
  return (
    <>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Detail label="En Fynco">
          <Money amount={Math.max(0, d.current_debt)} currency={d.currency} />
        </Detail>
        <Detail label="Debes hoy">
          <Money amount={d.new_debt} currency={d.currency} />
        </Detail>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {diff > 0 ? (
          <>
            Se registran <Money amount={diff} currency={d.currency} className="font-semibold text-foreground" /> como consumos sin detallar. Ninguna cuenta se toca.
          </>
        ) : diff < 0 ? (
          "Se corrige la deuda sin contarlo como ingreso. Ninguna cuenta se toca."
        ) : (
          "Ya estaba al día."
        )}
      </p>
    </>
  );
}

function AccountDetails({ d }: { d: AccountDraft }) {
  const card = d.account_type === "credit";
  const day = (n: number | null) => (n ? `Día ${n}` : "Sin definir");
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3">
      <Detail label="Tipo">{ACCOUNT_TYPE_LABEL[d.account_type]}</Detail>
      <Detail label="Banco">{d.institution ?? "Sin definir"}</Detail>
      <Detail label="Moneda">{d.currency}</Detail>
      {d.last4 && <Detail label="Últimos 4">···{d.last4}</Detail>}
      {card && <Detail label="Límite">{d.credit_limit ? <Money amount={d.credit_limit} currency={d.currency} /> : "Sin definir"}</Detail>}
      {card && <Detail label="Corte">{day(d.statement_day)}</Detail>}
      {card && <Detail label="Pago">{day(d.payment_due_day)}</Detail>}
    </dl>
  );
}

function TransferDetails({ d }: { d: TransferDraft }) {
  const cross = d.currency !== d.to_currency;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <dl className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <Detail label="Sale de">{d.from_account_name}</Detail>
        <ArrowRight className="mb-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Detail label="Entra a">{d.to_account_name}</Detail>
      </dl>
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
