import type { Account, AccountType, Category } from "@/lib/types";
import { db, myUserId, unwrap } from "./base";

type AccountRow = Omit<Account, "balance">;

export async function fetchAccounts(): Promise<Account[]> {
  const [accounts, balances] = await Promise.all([
    db().from("accounts").select("*").order("is_default", { ascending: false }).order("created_at"),
    db().from("account_balances").select("account_id, balance"),
  ]);
  const rows = unwrap(accounts) as AccountRow[];
  const byId = new Map((unwrap(balances) as { account_id: string; balance: number }[]).map((b) => [b.account_id, Number(b.balance)]));
  return rows.map((a) => ({
    ...a,
    opening_balance: Number(a.opening_balance),
    credit_limit: a.credit_limit == null ? null : Number(a.credit_limit),
    balance: byId.get(a.id) ?? Number(a.opening_balance),
  }));
}

export interface AccountInput {
  name: string;
  type: AccountType;
  currency: string;
  opening_balance: number;
  institution?: string | null;
  last4?: string | null;
  statement_day?: number | null;
  payment_due_day?: number | null;
  credit_limit?: number | null;
}

export async function createAccount(input: AccountInput): Promise<AccountRow> {
  return unwrap(await db().from("accounts").insert(input).select("*").single());
}

export async function updateAccount(id: string, patch: Partial<AccountInput> & { archived_at?: string | null }): Promise<AccountRow> {
  return unwrap(await db().from("accounts").update(patch).eq("id", id).select("*").single());
}

/** Pagar una tarjeta desde otra cuenta (transferencia). Sin monto = toda la deuda. */
export async function payCard(input: { card: string; from: string; amount?: number | null; occurred_on: string; description?: string | null }): Promise<string> {
  return unwrap(
    await db().rpc("pay_card", {
      p_card: input.card,
      p_from: input.from,
      p_amount: input.amount ?? null,
      p_occurred_on: input.occurred_on,
      p_description: input.description ?? null,
    }),
  );
}

/** Dejar la deuda de una tarjeta en `debt` (centavos). Devuelve cómo se registró. */
export async function setCardDebt(input: { card: string; debt: number; occurred_on: string }): Promise<"expense" | "opening" | "none"> {
  return unwrap(await db().rpc("set_card_debt", { p_card: input.card, p_debt: input.debt, p_occurred_on: input.occurred_on }));
}

export async function deleteAccount(id: string): Promise<void> {
  unwrap(await db().from("accounts").delete().eq("id", id));
}

export async function setDefaultAccount(id: string): Promise<void> {
  const uid = await myUserId();
  unwrap(await db().from("accounts").update({ is_default: false }).eq("user_id", uid).eq("is_default", true));
  unwrap(await db().from("accounts").update({ is_default: true }).eq("id", id));
}

export async function fetchCategories(): Promise<Category[]> {
  return unwrap(await db().from("categories").select("*").order("sort").order("name"));
}

export async function createCategory(input: Pick<Category, "name" | "kind" | "icon" | "color">): Promise<Category> {
  const uid = await myUserId();
  return unwrap(await db().from("categories").insert({ ...input, user_id: uid }).select("*").single());
}
