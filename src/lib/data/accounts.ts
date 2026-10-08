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
  return rows.map((a) => ({ ...a, opening_balance: Number(a.opening_balance), balance: byId.get(a.id) ?? Number(a.opening_balance) }));
}

export interface AccountInput {
  name: string;
  type: AccountType;
  currency: string;
  opening_balance: number;
  institution?: string | null;
  last4?: string | null;
}

export async function createAccount(input: AccountInput): Promise<AccountRow> {
  return unwrap(await db().from("accounts").insert(input).select("*").single());
}

export async function updateAccount(id: string, patch: Partial<AccountInput> & { archived_at?: string | null }): Promise<AccountRow> {
  return unwrap(await db().from("accounts").update(patch).eq("id", id).select("*").single());
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
