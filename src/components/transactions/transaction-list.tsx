"use client";

import { useMemo } from "react";
import { Money } from "@/components/money";
import { TxIcon } from "@/components/visuals";
import { useSheets } from "@/components/shell/sheets";
import { useAccounts, useCategories } from "@/hooks/queries";
import { dayLabel } from "@/lib/dates";
import type { Account, Category, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<Transaction["kind"], string> = {
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
  shared: "Compartido",
  settlement: "Pago de deuda",
};

export function TransactionRow({
  tx,
  account,
  category,
  transferTo,
  onClick,
}: {
  tx: Transaction;
  account?: Account;
  category?: Category | null;
  /** Si se muestran juntas las dos patas de una transferencia: la cuenta destino. */
  transferTo?: Account;
  onClick?: () => void;
}) {
  const meta = transferTo
    ? `${account?.name ?? "Cuenta"} → ${transferTo.name}`
    : [tx.kind === "income" || tx.kind === "expense" ? (category?.name ?? KIND_LABEL[tx.kind]) : KIND_LABEL[tx.kind], account?.name].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg py-2.5 text-left transition-colors hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <TxIcon tx={tx} category={category} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{tx.description || KIND_LABEL[tx.kind]}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {meta}
          {tx.source === "recurring" && " · Recurrente"}
          {(tx.source === "voice" || tx.source === "assistant") && " · Asistente"}
        </span>
      </span>
      <Money
        amount={transferTo ? Math.abs(tx.amount) : tx.amount}
        currency={account?.currency}
        sign={transferTo ? "never" : "always"}
        className={cn("text-[15px] font-bold", tx.amount > 0 && tx.kind === "income" ? "text-positive" : tx.kind === "transfer" || tx.kind === "settlement" ? "text-muted-foreground" : "")}
      />
    </button>
  );
}

export function TransactionList({ transactions, grouped = true, emptyText = "Sin movimientos." }: { transactions: Transaction[]; grouped?: boolean; emptyText?: string }) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const sheets = useSheets();
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const openTx = (tx: Transaction) =>
    tx.kind === "transfer" ? sheets.open({ type: "transfer", tx }) : sheets.open({ type: "transaction", tx });

  // Transferencias con ambas patas en la lista: se muestra una sola fila "Origen → Destino".
  const { visible, pairTo } = useMemo(() => {
    const legs = new Map<string, Transaction[]>();
    for (const t of transactions) if (t.transfer_id) legs.set(t.transfer_id, [...(legs.get(t.transfer_id) ?? []), t]);
    const pairTo = new Map<string, string>();
    const hidden = new Set<string>();
    for (const pair of legs.values()) {
      const out = pair.find((t) => t.amount < 0);
      const inn = pair.find((t) => t.amount > 0);
      if (out && inn) {
        pairTo.set(out.id, inn.account_id);
        hidden.add(inn.id);
      }
    }
    return { visible: transactions.filter((t) => !hidden.has(t.id)), pairTo };
  }, [transactions]);

  const groups = useMemo(() => {
    if (!grouped) return [{ day: "", items: visible }];
    const out: { day: string; items: Transaction[] }[] = [];
    for (const t of visible) {
      const last = out[out.length - 1];
      if (last && last.day === t.occurred_on) last.items.push(t);
      else out.push({ day: t.occurred_on, items: [t] });
    }
    return out;
  }, [visible, grouped]);

  if (!transactions.length) return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <div className="flex flex-col">
      {groups.map((g) => (
        <section key={g.day || "all"} aria-label={g.day ? dayLabel(g.day) : undefined}>
          {g.day && <h3 className="sticky top-0 z-10 bg-background/95 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground backdrop-blur">{dayLabel(g.day)}</h3>}
          <ul>
            {g.items.map((t) => (
              <li key={t.id}>
                <TransactionRow
                  tx={t}
                  account={accById.get(t.account_id)}
                  category={t.category_id ? catById.get(t.category_id) : null}
                  transferTo={pairTo.has(t.id) ? accById.get(pairTo.get(t.id)!) : undefined}
                  onClick={() => openTx(t)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
