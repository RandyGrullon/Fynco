"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell, ChevronLeft, HandCoins, Plus, Settings2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Money } from "@/components/money";
import { EmptyState } from "@/components/shell/page-header";
import { useSheets } from "@/components/shell/sheets";
import { GroupSettingsPanel } from "@/components/shared/group-settings-panel";
import { useUser } from "@/components/providers/session-provider";
import { AvatarStack, MemberAvatar, iconFor } from "@/components/visuals";
import { keys, useCategories, useGroupDetail, useSharedMutations } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { groupDebts, myMember, type GroupDetail } from "@/lib/data/groups";
import { monthDay, monthLabel, parseDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { myExpenseImpact } from "@/lib/split";
import { getSupabase } from "@/lib/supabase/client";
import type { Debt, GroupMember, Settlement, SharedExpense } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { data, isLoading, error } = useGroupDetail(groupId);
  const qc = useQueryClient();

  // Tiempo real: si otro miembro añade o borra algo, refrescamos.
  useEffect(() => {
    const supabase = getSupabase();
    const refresh = () => {
      qc.invalidateQueries({ queryKey: keys.group(groupId) });
      qc.invalidateQueries({ queryKey: keys.shared });
    };
    const channel = supabase
      .channel(`group:${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_expenses", filter: `group_id=eq.${groupId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements", filter: `group_id=eq.${groupId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, qc]);

  if (isLoading) return <GroupSkeleton />;
  if (error || !data) {
    return (
      <div className="pt-10">
        <EmptyState icon={Users} title="No encontramos este grupo" action={<Button asChild><Link href="/compartido">Volver a Compartido</Link></Button>}>
          Puede que lo hayan borrado o que ya no seas miembro.
        </EmptyState>
      </div>
    );
  }
  return <Group detail={data} />;
}

function Group({ detail }: { detail: GroupDetail }) {
  const user = useUser();
  const sheets = useSheets();
  const { group, expenses, settlements } = detail;
  const me = myMember(group, user.id);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const active = group.members.filter((m) => !m.left_at);
  const memberById = useMemo(() => new Map(group.members.map((m) => [m.id, m])), [group.members]);
  const myNet = me ? (group.balances.find((b) => b.member_id === me.id)?.net ?? 0) : 0;
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  const debts = useMemo(() => groupDebts(detail), [detail]);
  const other = group.kind === "direct" ? active.find((m) => m.id !== me?.id) : undefined;
  const title = other ? other.display_name : group.name;
  const nameOf = (id: string) => (id === me?.id ? "Tú" : (memberById.get(id)?.display_name ?? "Alguien"));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3 pt-4 md:pt-8">
        <Link href="/compartido" aria-label="Volver" className="flex h-11 w-11 items-center justify-center rounded-full border border-secondary bg-card transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-bold">{title}</h1>
        <Button variant="secondary" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Ajustes del grupo">
          <Settings2 />
        </Button>
      </header>

      <section className="flex flex-col items-center gap-2 text-center">
        <AvatarStack people={active.map((m) => ({ key: m.profile_id ?? m.id, name: m.display_name, isMe: m.id === me?.id }))} size={42} max={6} ring="rgb(var(--background))" />
        <p className="text-[13px] text-muted-foreground">
          {active.length} miembros · {formatMoney(total, group.currency)} en total{group.archived_at ? " · archivado" : ""}
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">{myNet > 0 ? "En este grupo te deben" : myNet < 0 ? "En este grupo debes" : "Estás a mano"}</p>
        <Money amount={Math.abs(myNet)} currency={group.currency} className={cn("text-[40px] font-extrabold leading-none tracking-[-0.03em]", myNet > 0 ? "text-positive" : myNet < 0 ? "text-negative" : "text-foreground")} />
      </section>

      <Tabs defaultValue="gastos">
        <TabsList>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="totales">Totales</TabsTrigger>
        </TabsList>
        <TabsContent value="gastos">
          <Activity detail={detail} meId={me?.id} nameOf={nameOf} />
        </TabsContent>
        <TabsContent value="balances">
          <Balances detail={detail} debts={debts} me={me} nameOf={nameOf} />
        </TabsContent>
        <TabsContent value="totales">
          <Totals expenses={expenses} settlements={settlements} meId={me?.id} currency={group.currency} />
        </TabsContent>
      </Tabs>

      {!group.archived_at && (
        <div className="sticky bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+4.75rem)] z-20 -mx-5 grid grid-cols-2 gap-2.5 border-t border-muted bg-background/95 px-5 py-3 backdrop-blur md:bottom-4 md:mx-0 md:rounded-2xl md:border md:px-3">
          <Button variant="secondary" onClick={() => sheets.open({ type: "settle", groupId: group.id })} disabled={!debts.length}>
            Saldar cuentas
          </Button>
          <Button onClick={() => sheets.open({ type: "expense", groupId: group.id })}>
            <Plus strokeWidth={2.5} /> Añadir gasto
          </Button>
        </div>
      )}

      <GroupSettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} detail={detail} />
    </div>
  );
}

// ---------- Gastos y pagos ----------
type Item = { kind: "expense"; e: SharedExpense } | { kind: "settlement"; s: Settlement };

function Activity({ detail, meId, nameOf }: { detail: GroupDetail; meId?: string; nameOf: (id: string) => string }) {
  const sheets = useSheets();
  const m = useSharedMutations();
  const [toDelete, setToDelete] = useState<Settlement | null>(null);
  const { group, expenses, settlements } = detail;

  const months = useMemo(() => {
    const items: Item[] = [...expenses.map((e) => ({ kind: "expense" as const, e })), ...settlements.map((s) => ({ kind: "settlement" as const, s }))];
    const date = (i: Item) => (i.kind === "expense" ? i.e.occurred_on : i.s.occurred_on);
    const created = (i: Item) => (i.kind === "expense" ? i.e.created_at : i.s.created_at);
    items.sort((a, b) => date(b).localeCompare(date(a)) || created(b).localeCompare(created(a)));
    const out: { label: string; items: Item[] }[] = [];
    for (const it of items) {
      const label = monthLabel(parseDate(date(it)));
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(it);
      else out.push({ label, items: [it] });
    }
    return out;
  }, [expenses, settlements]);

  if (!months.length) {
    return (
      <EmptyState icon={HandCoins} title="Todavía no hay gastos" action={<Button onClick={() => sheets.open({ type: "expense", groupId: group.id })}>Añadir el primero</Button>}>
        Añade lo que pagó cada uno y Fynco calcula el resto.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col">
      {months.map((month) => (
        <section key={month.label}>
          <h3 className="py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{month.label}</h3>
          <ul>
            {month.items.map((it) =>
              it.kind === "expense" ? (
                <li key={it.e.id}>
                  <ExpenseRow expense={it.e} meId={meId} nameOf={nameOf} currency={group.currency} onClick={() => sheets.open({ type: "expense", groupId: group.id, expense: it.e })} />
                </li>
              ) : (
                <li key={it.s.id}>
                  <button
                    type="button"
                    onClick={() => setToDelete(it.s)}
                    className="flex w-full items-center gap-3 border-b border-muted py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex w-10 shrink-0 justify-center text-primary">
                      <HandCoins className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold">{nameOf(it.s.from_member)}</span> {it.s.from_member === meId ? "le pagaste a" : "le pagó a"}{" "}
                      <span className="font-semibold">{nameOf(it.s.to_member)}</span>
                      {it.s.note && <span className="block truncate text-xs text-muted-foreground">{it.s.note}</span>}
                    </span>
                    <Money amount={it.s.amount} currency={group.currency} className="text-sm font-bold" />
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este pago?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && `${nameOf(toDelete.from_member)} → ${nameOf(toDelete.to_member)} · ${formatMoney(toDelete.amount, group.currency)}. `}
              Los saldos vuelven a como estaban. Si estaba ligado a una cuenta, ese movimiento también se borra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!toDelete) return;
                try {
                  await m.deleteSettlement.mutateAsync(toDelete.id);
                  toast({ title: "Pago borrado" });
                } catch {}
                setToDelete(null);
              }}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExpenseRow({ expense, meId, nameOf, currency, onClick }: { expense: SharedExpense; meId?: string; nameOf: (id: string) => string; currency: string; onClick: () => void }) {
  const { mon, day } = monthDay(expense.occurred_on);
  const impact = meId ? myExpenseImpact(expense, meId) : { paid: 0, share: 0, net: 0 };
  const paidBy =
    expense.payers.length > 1
      ? `Pagaron ${expense.payers.length} personas ${formatMoney(expense.amount, currency)}`
      : expense.payers[0]?.member_id === meId
        ? `Pagaste ${formatMoney(expense.amount, currency)}`
        : `${nameOf(expense.payers[0]?.member_id ?? "")} pagó ${formatMoney(expense.amount, currency)}`;

  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-muted py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex w-10 shrink-0 flex-col items-center leading-tight">
        <span className="text-[11px] font-semibold uppercase text-muted-foreground">{mon}</span>
        <span className="text-lg font-extrabold">{day}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{expense.description}</span>
        <span className="block truncate text-xs text-muted-foreground">{paidBy}</span>
      </span>
      {impact.net > 0 ? (
        <span className="flex flex-col items-end">
          <span className="text-[11px] text-muted-foreground">prestaste</span>
          <Money amount={impact.net} currency={currency} className="text-sm font-extrabold text-positive" />
        </span>
      ) : impact.net < 0 ? (
        <span className="flex flex-col items-end">
          <span className="text-[11px] text-muted-foreground">debes</span>
          <Money amount={-impact.net} currency={currency} className="text-sm font-extrabold text-negative" />
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground">{impact.share || impact.paid ? "a mano" : "no participas"}</span>
      )}
    </button>
  );
}

// ---------- Balances ----------
function Balances({ detail, debts, me, nameOf }: { detail: GroupDetail; debts: Debt[]; me?: GroupMember; nameOf: (id: string) => string }) {
  const { group } = detail;
  const sheets = useSheets();
  const m = useSharedMutations();
  const memberById = new Map(group.members.map((mm) => [mm.id, mm]));

  async function remind(d: Debt) {
    const text = `Hola ${nameOf(d.from)}, según Fynco me debes ${formatMoney(d.amount, group.currency)} de "${group.name}".`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Mensaje copiado", description: "Pégalo en WhatsApp o donde prefieras." });
      }
    } catch {}
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-center gap-3 rounded-xl border border-secondary bg-card p-4">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Simplificar deudas</span>
          <span className="block text-xs text-muted-foreground">Reduce el número de pagos: el que más debe le paga al que más le deben.</span>
        </span>
        <Switch
          checked={group.simplify_debts}
          onCheckedChange={(v) => m.updateGroup.mutate({ id: group.id, patch: { simplify_debts: v } })}
          aria-label="Simplificar deudas"
        />
      </label>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">Quién le debe a quién</h2>
        {debts.length === 0 ? (
          <p className="rounded-xl border border-secondary bg-card p-4 text-sm text-muted-foreground">Todo el mundo está a mano.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {debts.map((d) => {
              const from = memberById.get(d.from);
              const to = memberById.get(d.to);
              const toMe = d.to === me?.id;
              return (
                <li key={`${d.from}-${d.to}`} className="flex items-center gap-3 rounded-xl border border-secondary bg-card p-3">
                  <span className="flex items-center gap-1">
                    <MemberAvatar name={from?.display_name ?? "?"} seed={from?.profile_id ?? d.from} isMe={d.from === me?.id} size={30} />
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    <MemberAvatar name={to?.display_name ?? "?"} seed={to?.profile_id ?? d.to} isMe={toMe} size={30} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-bold">{nameOf(d.from)}</span> {d.from === me?.id ? "le debes a" : "le debe a"} <span className="font-bold">{toMe ? "ti" : nameOf(d.to)}</span>
                    <Money amount={d.amount} currency={group.currency} className={cn("block text-[15px] font-extrabold", toMe ? "text-positive" : d.from === me?.id ? "text-negative" : "")} />
                  </span>
                  {toMe && (
                    <Button variant="ghost" size="icon-sm" onClick={() => remind(d)} aria-label={`Recordarle a ${nameOf(d.from)}`}>
                      <Bell />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => sheets.open({ type: "settle", groupId: group.id, from: d.from, to: d.to, amount: d.amount })}>
                    Saldar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">Saldo de cada persona</h2>
        <ul className="flex flex-col divide-y divide-muted rounded-xl border border-secondary bg-card">
          {group.members
            .filter((mm) => !mm.left_at || (group.balances.find((b) => b.member_id === mm.id)?.net ?? 0) !== 0)
            .map((mm) => {
              const b = group.balances.find((x) => x.member_id === mm.id);
              const net = b?.net ?? 0;
              return (
                <li key={mm.id} className="flex items-center gap-3 px-3 py-2.5">
                  <MemberAvatar name={mm.display_name} seed={mm.profile_id ?? mm.id} isMe={mm.id === me?.id} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{mm.id === me?.id ? "Tú" : mm.display_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      Pagó {formatMoney(b?.paid ?? 0, group.currency)} · su parte {formatMoney(b?.owed ?? 0, group.currency)}
                    </span>
                  </span>
                  <span className={cn("text-right text-sm font-extrabold", net > 0 ? "text-positive" : net < 0 ? "text-negative" : "text-muted-foreground")}>
                    {net === 0 ? "a mano" : <Money amount={net} currency={group.currency} sign="always" />}
                  </span>
                </li>
              );
            })}
        </ul>
      </section>
    </div>
  );
}

// ---------- Totales ----------
function Totals({ expenses, settlements, meId, currency }: { expenses: SharedExpense[]; settlements: Settlement[]; meId?: string; currency: string }) {
  const { data: categories = [] } = useCategories();
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  const mine = meId ? expenses.reduce((a, e) => a + myExpenseImpact(e, meId).share, 0) : 0;
  const paid = meId ? expenses.reduce((a, e) => a + myExpenseImpact(e, meId).paid, 0) : 0;
  const sent = settlements.filter((s) => s.from_member === meId).reduce((a, s) => a + s.amount, 0);
  const received = settlements.filter((s) => s.to_member === meId).reduce((a, s) => a + s.amount, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const e of expenses) map.set(e.category_id, (map.get(e.category_id) ?? 0) + e.amount);
    return [...map.entries()].map(([id, amount]) => ({ cat: categories.find((c) => c.id === id) ?? null, amount })).sort((a, b) => b.amount - a.amount);
  }, [expenses, categories]);

  const tiles = [
    { label: "Gasto total del grupo", value: total },
    { label: "Tu parte", value: mine },
    { label: "Pagaste", value: paid },
    { label: "Pagos enviados / recibidos", value: null, text: `${formatMoney(sent, currency)} / ${formatMoney(received, currency)}` },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-1 rounded-xl border border-secondary bg-card p-3.5">
            <span className="text-xs text-muted-foreground">{t.label}</span>
            {t.value !== null ? <Money amount={t.value} currency={currency} className="text-lg font-extrabold" /> : <span className="tabular text-sm font-bold">{t.text}</span>}
          </div>
        ))}
      </div>
      {byCategory.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">Por categoría</h2>
          <ul className="flex flex-col gap-3">
            {byCategory.map(({ cat, amount }) => {
              const Icon = iconFor(cat?.icon);
              const pct = total ? Math.round((amount / total) * 100) : 0;
              return (
                <li key={cat?.id ?? "none"} className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4" style={{ color: cat?.color ?? "#9AA0AA" }} />
                    <span className="flex-1 font-semibold">{cat?.name ?? "Sin categoría"}</span>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                    <Money amount={amount} currency={currency} className="font-bold" />
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: cat?.color ?? "#9AA0AA" }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function GroupSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 pt-6">
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-10 w-40 rounded-full" />
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-12 w-full rounded-lg" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}
