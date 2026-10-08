import { debtsFor, pairwiseDebts, simplifyDebts } from "@/lib/split";
import type { Debt, Group, GroupMember, MemberBalance, Portion, Settlement, SharedExpense, SplitMethod } from "@/lib/types";
import { db, unwrap } from "./base";

const num = (n: unknown) => Number(n ?? 0);

function normalizeBalance(b: MemberBalance): MemberBalance {
  return { ...b, paid: num(b.paid), owed: num(b.owed), settled_sent: num(b.settled_sent), settled_received: num(b.settled_received), net: num(b.net) };
}

function normalizeExpense(e: SharedExpense): SharedExpense {
  return {
    ...e,
    amount: num(e.amount),
    payers: (e.payers ?? []).map((p) => ({ ...p, amount: num(p.amount) })),
    shares: (e.shares ?? []).map((s) => ({ ...s, amount: num(s.amount), weight: s.weight == null ? null : Number(s.weight) })),
  };
}

export async function fetchGroups(): Promise<Group[]> {
  const groups = unwrap(
    await db().from("groups").select("*, members:group_members(*)").order("created_at", { ascending: false }),
  ) as Omit<Group, "balances">[];
  if (!groups.length) return [];
  const balances = (unwrap(
    await db().from("group_member_balances").select("*").in("group_id", groups.map((g) => g.id)),
  ) as MemberBalance[]).map(normalizeBalance);
  return groups.map((g) => ({
    ...g,
    members: [...g.members].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    balances: balances.filter((b) => b.group_id === g.id),
  }));
}

export interface GroupDetail {
  group: Group;
  expenses: SharedExpense[];
  settlements: Settlement[];
}

export async function fetchGroupDetail(id: string): Promise<GroupDetail> {
  const [group, members, balances, expenses, settlements] = await Promise.all([
    db().from("groups").select("*").eq("id", id).single(),
    db().from("group_members").select("*").eq("group_id", id).order("created_at"),
    db().from("group_member_balances").select("*").eq("group_id", id),
    db()
      .from("shared_expenses")
      .select("*, payers:expense_payers(member_id, amount), shares:expense_shares(member_id, amount, weight)")
      .eq("group_id", id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    db().from("settlements").select("*").eq("group_id", id).order("occurred_on", { ascending: false }),
  ]);
  return {
    group: {
      ...(unwrap(group) as Omit<Group, "members" | "balances">),
      members: unwrap(members) as GroupMember[],
      balances: (unwrap(balances) as MemberBalance[]).map(normalizeBalance),
    },
    expenses: (unwrap(expenses) as SharedExpense[]).map(normalizeExpense),
    settlements: (unwrap(settlements) as Settlement[]).map((s) => ({ ...s, amount: num(s.amount) })),
  };
}

/** Deudas del grupo según su configuración (simplificadas o por pareja). */
export function groupDebts(detail: Pick<GroupDetail, "group" | "expenses" | "settlements">): Debt[] {
  return detail.group.simplify_debts ? simplifyDebts(detail.group.balances) : pairwiseDebts(detail.expenses, detail.settlements);
}

/**
 * Identidad de una persona entre grupos: su perfil si tiene cuenta; si no, su correo de invitación;
 * si no, su nombre normalizado (así "Carla" es la misma en el viaje y en los gastos directos).
 */
export function memberKey(m: Pick<GroupMember, "profile_id" | "invite_email" | "display_name">) {
  if (m.profile_id) return m.profile_id;
  if (m.invite_email) return `e:${m.invite_email.toLowerCase()}`;
  return `n:${m.display_name.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")}`;
}

export function myMember(group: Pick<Group, "members">, profileId: string | undefined) {
  return group.members.find((m) => m.profile_id === profileId && !m.left_at);
}

// ---------- Resumen de Compartido (grupos + amigos) ----------
export interface FriendBalance {
  key: string; // profile_id o "m:<member_id>" para invitados
  name: string;
  profileId: string | null;
  /** + te debe, − le debes; por moneda */
  amounts: Record<string, number>;
  groups: { id: string; name: string; kind: Group["kind"]; currency: string; amount: number }[];
}

export interface SharedOverview {
  groups: (Group & { me: GroupMember | undefined; myNet: number })[];
  friends: FriendBalance[];
  /** Por moneda: lo que te deben y lo que debes (ambos positivos). */
  totals: Record<string, { owedToMe: number; iOwe: number }>;
}

export async function fetchSharedOverview(profileId: string): Promise<SharedOverview> {
  const groups = await fetchGroups();
  // Para grupos sin simplificar hace falta el detalle de gastos para calcular deudas por pareja.
  const raw = groups.filter((g) => !g.simplify_debts && !g.archived_at);
  const details = new Map<string, Pick<GroupDetail, "expenses" | "settlements">>();
  if (raw.length) {
    const ids = raw.map((g) => g.id);
    const [expenses, settlements] = await Promise.all([
      db().from("shared_expenses").select("id, group_id, amount, payers:expense_payers(member_id, amount), shares:expense_shares(member_id, amount)").in("group_id", ids),
      db().from("settlements").select("*").in("group_id", ids),
    ]);
    const exps = (unwrap(expenses) as SharedExpense[]).map(normalizeExpense);
    const sets = (unwrap(settlements) as Settlement[]).map((s) => ({ ...s, amount: num(s.amount) }));
    for (const id of ids) details.set(id, { expenses: exps.filter((e) => e.group_id === id), settlements: sets.filter((s) => s.group_id === id) });
  }
  return computeSharedOverview(groups, profileId, details);
}

export function computeSharedOverview(
  groups: Group[],
  profileId: string,
  details: Map<string, Pick<GroupDetail, "expenses" | "settlements">> = new Map(),
): SharedOverview {
  const friends = new Map<string, FriendBalance>();
  const totals: SharedOverview["totals"] = {};
  const out: SharedOverview["groups"] = [];

  for (const g of groups) {
    const me = myMember(g, profileId);
    const myNet = me ? (g.balances.find((b) => b.member_id === me.id)?.net ?? 0) : 0;
    out.push({ ...g, me, myNet });
    if (!me || g.archived_at) continue;

    const t = (totals[g.currency] ??= { owedToMe: 0, iOwe: 0 });
    if (myNet > 0) t.owedToMe += myNet;
    if (myNet < 0) t.iOwe += -myNet;

    const detail = details.get(g.id);
    const debts = g.simplify_debts || !detail ? simplifyDebts(g.balances) : pairwiseDebts(detail.expenses, detail.settlements);
    for (const d of debtsFor(me.id, debts)) {
      const other = g.members.find((m) => m.id === d.other);
      if (!other) continue;
      const key = memberKey(other);
      const f = friends.get(key) ?? { key, name: other.display_name, profileId: other.profile_id, amounts: {}, groups: [] };
      f.amounts[g.currency] = (f.amounts[g.currency] ?? 0) + d.amount;
      f.groups.push({ id: g.id, name: g.name, kind: g.kind, currency: g.currency, amount: d.amount });
      friends.set(key, f);
    }
  }

  // También aparecen los amigos a mano (con quienes compartes grupo aunque no haya deuda).
  for (const g of groups) {
    if (!myMember(g, profileId) || g.archived_at) continue;
    for (const m of g.members) {
      if (m.left_at || m.profile_id === profileId) continue;
      const key = memberKey(m);
      if (!friends.has(key)) friends.set(key, { key, name: m.display_name, profileId: m.profile_id, amounts: {}, groups: [] });
    }
  }

  const magnitude = (f: FriendBalance) => Object.values(f.amounts).reduce((a, v) => a + Math.abs(v), 0);
  return {
    groups: out,
    friends: [...friends.values()].sort((a, b) => magnitude(b) - magnitude(a) || a.name.localeCompare(b.name)),
    totals,
  };
}

// ---------- Escrituras ----------
export async function createGroup(input: { name: string; currency: string; kind?: "group" | "direct"; members: { display_name: string; email?: string | null }[] }): Promise<string> {
  return unwrap(
    await db().rpc("create_group", {
      p_name: input.name,
      p_currency: input.currency,
      p_kind: input.kind ?? "group",
      p_members: input.members,
    }),
  );
}

export async function updateGroup(id: string, patch: Partial<Pick<Group, "name" | "currency" | "simplify_debts" | "archived_at">>) {
  unwrap(await db().from("groups").update(patch).eq("id", id));
}

export async function deleteGroup(id: string) {
  unwrap(await db().rpc("delete_group", { p_group_id: id }));
}

export async function addGroupMember(groupId: string, displayName: string, email?: string | null): Promise<string> {
  return unwrap(await db().rpc("add_group_member", { p_group_id: groupId, p_display_name: displayName, p_email: email ?? null }));
}

export async function updateGroupMember(memberId: string, displayName: string, email?: string | null) {
  unwrap(await db().rpc("update_group_member", { p_member_id: memberId, p_display_name: displayName, p_email: email ?? null }));
}

export async function removeGroupMember(memberId: string) {
  unwrap(await db().rpc("remove_group_member", { p_member_id: memberId }));
}

export interface GroupPreview {
  id: string;
  name: string;
  currency: string;
  is_member: boolean;
  members: { id: string; display_name: string; claimed: boolean }[];
}

export async function groupPreview(code: string): Promise<GroupPreview | null> {
  return unwrap(await db().rpc("group_preview", { p_code: code }));
}

export interface PendingInvite {
  member_id: string;
  group_id: string;
  group_name: string;
  group_kind: "group" | "direct";
  currency: string;
  invited_as: string;
  members: number;
  invited_by: string | null;
}

/** Invitaciones por correo (confirmado) que esperan tu respuesta. */
export async function fetchPendingInvites(): Promise<PendingInvite[]> {
  return unwrap(await db().rpc("my_pending_invites"));
}

export async function acceptInvite(memberId: string): Promise<string> {
  return unwrap(await db().rpc("accept_invite", { p_member_id: memberId }));
}

export async function declineInvite(memberId: string): Promise<void> {
  unwrap(await db().rpc("decline_invite", { p_member_id: memberId }));
}

export async function joinGroup(code: string, claimMemberId?: string | null): Promise<string> {
  return unwrap(await db().rpc("join_group", { p_code: code, p_claim_member: claimMemberId ?? null }));
}

export interface ExpenseInput {
  id?: string | null;
  group_id: string;
  description: string;
  amount: number;
  occurred_on: string;
  category_id: string | null;
  split_method: SplitMethod;
  payers: Portion[];
  shares: Portion[];
  /** Cuenta propia con la que pagaste (si pagaste). */
  account_id?: string | null;
  note?: string | null;
}

export async function saveSharedExpense(input: ExpenseInput): Promise<string> {
  return unwrap(
    await db().rpc("save_shared_expense", {
      p_expense_id: input.id ?? null,
      p_group_id: input.group_id,
      p_description: input.description,
      p_amount: input.amount,
      p_occurred_on: input.occurred_on,
      p_category_id: input.category_id,
      p_split_method: input.split_method,
      p_payers: input.payers.map(({ member_id, amount }) => ({ member_id, amount })),
      p_shares: input.shares.map(({ member_id, amount, weight }) => ({ member_id, amount, weight: weight ?? null })),
      p_account_id: input.account_id ?? null,
      p_note: input.note ?? null,
    }),
  );
}

export async function deleteSharedExpense(id: string) {
  unwrap(await db().rpc("delete_shared_expense", { p_expense_id: id }));
}

export interface SettlementInput {
  group_id: string;
  from_member: string;
  to_member: string;
  amount: number;
  occurred_on: string;
  account_id?: string | null;
  note?: string | null;
}

export async function recordSettlement(input: SettlementInput): Promise<string> {
  return unwrap(
    await db().rpc("record_settlement", {
      p_group_id: input.group_id,
      p_from_member: input.from_member,
      p_to_member: input.to_member,
      p_amount: input.amount,
      p_occurred_on: input.occurred_on,
      p_account_id: input.account_id ?? null,
      p_note: input.note ?? null,
    }),
  );
}

export async function deleteSettlement(id: string) {
  unwrap(await db().rpc("delete_settlement", { p_settlement_id: id }));
}
