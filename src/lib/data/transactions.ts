import type { Transaction, TxKind, TxSource } from "@/lib/types";
import { db, unwrap } from "./base";

export interface TransactionFilters {
  accountId?: string;
  kinds?: TxKind[];
  categoryId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export const PAGE_SIZE = 40;

function normalize(t: Transaction): Transaction {
  return { ...t, amount: Number(t.amount) };
}

export async function fetchTransactions(filters: TransactionFilters = {}, page = 0, pageSize = PAGE_SIZE): Promise<Transaction[]> {
  let q = db().from("transactions").select("*");
  if (filters.accountId) q = q.eq("account_id", filters.accountId);
  if (filters.kinds?.length) q = q.in("kind", filters.kinds);
  if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
  if (filters.from) q = q.gte("occurred_on", filters.from);
  if (filters.to) q = q.lte("occurred_on", filters.to);
  if (filters.search?.trim()) q = q.ilike("description", `%${filters.search.trim().replace(/[%_]/g, "")}%`);
  const rows = unwrap(
    await q
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * pageSize, page * pageSize + pageSize - 1),
  ) as Transaction[];
  return rows.map(normalize);
}

/** Todas las filas del rango (para exportar), paginando de 1000 en 1000. */
export async function fetchAllTransactions(filters: TransactionFilters): Promise<Transaction[]> {
  const out: Transaction[] = [];
  for (let page = 0; page < 100; page++) {
    const rows = await fetchTransactions(filters, page, 1000);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export interface TransactionInput {
  account_id: string;
  kind: "income" | "expense";
  /** Siempre positivo; el signo lo pone `kind`. */
  amount: number;
  occurred_on: string;
  description: string;
  category_id: string | null;
  note?: string | null;
  source?: TxSource;
}

function toRow(input: TransactionInput) {
  return { ...input, amount: input.kind === "expense" ? -Math.abs(input.amount) : Math.abs(input.amount) };
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  return normalize(unwrap(await db().from("transactions").insert(toRow(input)).select("*").single()));
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
  const { source: _source, ...rest } = toRow(input);
  return normalize(unwrap(await db().from("transactions").update(rest).eq("id", id).select("*").single()));
}

export async function deleteTransaction(id: string): Promise<void> {
  unwrap(await db().from("transactions").delete().eq("id", id));
}

export interface TransferInput {
  from: string;
  to: string;
  amount: number;
  /** Solo si las monedas difieren: lo que llegó a la cuenta destino. */
  to_amount?: number | null;
  occurred_on: string;
  description?: string;
}

export async function createTransfer(input: TransferInput): Promise<string> {
  return unwrap(
    await db().rpc("create_transfer", {
      p_from: input.from,
      p_to: input.to,
      p_amount: input.amount,
      p_to_amount: input.to_amount ?? null,
      p_occurred_on: input.occurred_on,
      p_description: input.description ?? "",
    }),
  );
}

export async function updateTransfer(transferId: string, input: Omit<TransferInput, "from" | "to">): Promise<void> {
  unwrap(
    await db().rpc("update_transfer", {
      p_transfer_id: transferId,
      p_amount: input.amount,
      p_to_amount: input.to_amount ?? null,
      p_occurred_on: input.occurred_on,
      p_description: input.description ?? "",
    }),
  );
}

export async function fetchTransferLegs(transferId: string): Promise<Transaction[]> {
  return (unwrap(await db().from("transactions").select("*").eq("transfer_id", transferId)) as Transaction[]).map(normalize);
}
