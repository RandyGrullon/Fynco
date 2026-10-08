"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as accounts from "@/lib/data/accounts";
import * as groups from "@/lib/data/groups";
import * as planning from "@/lib/data/planning";
import * as profile from "@/lib/data/profile";
import * as tx from "@/lib/data/transactions";
import { useUser } from "@/components/providers/session-provider";
import { todayISO } from "@/lib/dates";

export const keys = {
  profile: ["profile"] as const,
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  transactions: (f: tx.TransactionFilters = {}) => ["transactions", f] as const,
  transactionsAll: ["transactions"] as const,
  recurring: ["recurring"] as const,
  goals: ["goals"] as const,
  shared: ["shared"] as const,
  group: (id: string) => ["group", id] as const,
  groupsAll: ["group"] as const,
  stats: ["stats"] as const,
  invites: ["invites"] as const,
  pin: ["pin"] as const,
};

/** Todo lo que cambia cuando se mueve dinero. */
function useInvalidateMoney() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.accounts }),
      qc.invalidateQueries({ queryKey: keys.transactionsAll }),
      qc.invalidateQueries({ queryKey: keys.stats }),
      qc.invalidateQueries({ queryKey: keys.goals }),
    ]);
}

function useInvalidateShared() {
  const qc = useQueryClient();
  const money = useInvalidateMoney();
  return () =>
    Promise.all([qc.invalidateQueries({ queryKey: keys.shared }), qc.invalidateQueries({ queryKey: keys.groupsAll }), money()]);
}

// ---------- Perfil ----------
export function useProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: profile.fetchProfile, staleTime: 5 * 60_000 });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: profile.updateProfile,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: keys.profile });
      const prev = qc.getQueryData(keys.profile);
      qc.setQueryData(keys.profile, (old: Awaited<ReturnType<typeof profile.fetchProfile>> | undefined) => (old ? { ...old, ...patch } : old));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.profile, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.profile }),
  });
}

export function useHasPin() {
  return useQuery({ queryKey: keys.pin, queryFn: profile.hasPin });
}

// ---------- Cuentas y categorías ----------
export function useAccounts() {
  return useQuery({ queryKey: keys.accounts, queryFn: accounts.fetchAccounts });
}

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: accounts.fetchCategories, staleTime: 30 * 60_000 });
}

export function useAccountMutations() {
  const qc = useQueryClient();
  const money = useInvalidateMoney();
  const done = { onSuccess: () => money() };
  return {
    create: useMutation({ mutationFn: accounts.createAccount, ...done }),
    update: useMutation({ mutationFn: (v: { id: string; patch: Parameters<typeof accounts.updateAccount>[1] }) => accounts.updateAccount(v.id, v.patch), ...done }),
    // Borrar una cuenta borra en cascada sus recurrentes y sus pagos de gastos compartidos.
    remove: useMutation({
      mutationFn: accounts.deleteAccount,
      onSuccess: () => Promise.all([money(), qc.invalidateQueries({ queryKey: keys.recurring }), qc.invalidateQueries({ queryKey: keys.shared })]),
    }),
    setDefault: useMutation({ mutationFn: accounts.setDefaultAccount, onSuccess: () => qc.invalidateQueries({ queryKey: keys.accounts }) }),
  };
}

// ---------- Movimientos ----------
export function useTransactions(filters: tx.TransactionFilters = {}) {
  return useInfiniteQuery({
    queryKey: keys.transactions(filters),
    queryFn: ({ pageParam }) => tx.fetchTransactions(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === tx.PAGE_SIZE ? all.length : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useRecentTransactions(limit = 6) {
  return useQuery({ queryKey: [...keys.transactionsAll, "recent", limit], queryFn: () => tx.fetchTransactions({}, 0, limit) });
}

export function useTransactionMutations() {
  const money = useInvalidateMoney();
  const done = { onSuccess: () => money() };
  return {
    create: useMutation({ mutationFn: tx.createTransaction, ...done }),
    update: useMutation({ mutationFn: (v: { id: string; input: tx.TransactionInput }) => tx.updateTransaction(v.id, v.input), ...done }),
    remove: useMutation({ mutationFn: tx.deleteTransaction, ...done }),
    transfer: useMutation({ mutationFn: tx.createTransfer, ...done }),
    updateTransfer: useMutation({
      mutationFn: (v: { transferId: string; input: Omit<tx.TransferInput, "from" | "to"> }) => tx.updateTransfer(v.transferId, v.input),
      ...done,
    }),
  };
}

// ---------- Recurrentes y metas ----------
export function useRecurring() {
  return useQuery({ queryKey: keys.recurring, queryFn: planning.fetchRecurring });
}

export function useRecurringMutations() {
  const qc = useQueryClient();
  const money = useInvalidateMoney();
  // Una regla que empieza hoy (o antes) genera sus movimientos al guardarse, no en la próxima apertura.
  const done = {
    onSuccess: async () => {
      await planning.runMyRecurring(todayISO()).catch(() => 0);
      await Promise.all([qc.invalidateQueries({ queryKey: keys.recurring }), money()]);
    },
  };
  return {
    create: useMutation({ mutationFn: planning.createRecurring, ...done }),
    update: useMutation({ mutationFn: (v: { id: string; patch: Partial<planning.RecurringInput> }) => planning.updateRecurring(v.id, v.patch), ...done }),
    remove: useMutation({ mutationFn: planning.deleteRecurring, ...done }),
  };
}

export function useGoals() {
  return useQuery({ queryKey: keys.goals, queryFn: planning.fetchGoals });
}

export function useGoalMutations() {
  const qc = useQueryClient();
  const done = { onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: keys.goals }), qc.invalidateQueries({ queryKey: keys.accounts })]) };
  return {
    create: useMutation({ mutationFn: planning.createGoal, ...done }),
    update: useMutation({ mutationFn: (v: { id: string; patch: Partial<planning.GoalInput> }) => planning.updateGoal(v.id, v.patch), ...done }),
    remove: useMutation({ mutationFn: planning.deleteGoal, ...done }),
  };
}

// ---------- Estadísticas ----------
export function useSpendingByCategory(from: string, to: string) {
  return useQuery({ queryKey: [...keys.stats, "categories", from, to], queryFn: () => planning.spendingByCategory(from, to) });
}

export function useCashflow(from: string, to: string) {
  return useQuery({ queryKey: [...keys.stats, "cashflow", from, to], queryFn: () => planning.cashflowByMonth(from, to) });
}

// ---------- Compartido ----------
export function useSharedOverview() {
  const user = useUser();
  return useQuery({ queryKey: keys.shared, queryFn: () => groups.fetchSharedOverview(user.id) });
}

export function usePendingInvites() {
  return useQuery({ queryKey: keys.invites, queryFn: groups.fetchPendingInvites, staleTime: 60_000 });
}

export function useGroupDetail(id: string) {
  return useQuery({ queryKey: keys.group(id), queryFn: () => groups.fetchGroupDetail(id) });
}

export function useSharedMutations() {
  const qc = useQueryClient();
  const invalidate = useInvalidateShared();
  const done = { onSuccess: () => invalidate() };
  return {
    createGroup: useMutation({ mutationFn: groups.createGroup, ...done }),
    updateGroup: useMutation({ mutationFn: (v: { id: string; patch: Parameters<typeof groups.updateGroup>[1] }) => groups.updateGroup(v.id, v.patch), ...done }),
    deleteGroup: useMutation({ mutationFn: groups.deleteGroup, ...done }),
    addMember: useMutation({ mutationFn: (v: { groupId: string; name: string; email?: string | null }) => groups.addGroupMember(v.groupId, v.name, v.email), ...done }),
    updateMember: useMutation({ mutationFn: (v: { memberId: string; name: string; email?: string | null }) => groups.updateGroupMember(v.memberId, v.name, v.email), ...done }),
    removeMember: useMutation({ mutationFn: groups.removeGroupMember, ...done }),
    joinGroup: useMutation({ mutationFn: (v: { code: string; claim?: string | null }) => groups.joinGroup(v.code, v.claim), ...done }),
    acceptInvite: useMutation({ mutationFn: groups.acceptInvite, onSuccess: () => Promise.all([invalidate(), qc.invalidateQueries({ queryKey: keys.invites })]) }),
    declineInvite: useMutation({ mutationFn: groups.declineInvite, onSuccess: () => qc.invalidateQueries({ queryKey: keys.invites }) }),
    saveExpense: useMutation({ mutationFn: groups.saveSharedExpense, ...done }),
    deleteExpense: useMutation({ mutationFn: groups.deleteSharedExpense, ...done }),
    settle: useMutation({ mutationFn: groups.recordSettlement, ...done }),
    deleteSettlement: useMutation({ mutationFn: groups.deleteSettlement, ...done }),
  };
}
