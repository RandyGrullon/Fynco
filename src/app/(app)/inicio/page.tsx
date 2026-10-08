"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, Eye, EyeOff, Mic, Repeat, Split, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BigMoney, Money, usePrivateAccountIds } from "@/components/money";
import { SectionTitle } from "@/components/shell/page-header";
import { useSheets } from "@/components/shell/sheets";
import { TransactionList } from "@/components/transactions/transaction-list";
import { PendingInvites } from "@/components/shared/pending-invites";
import { AvatarStack, Monogram, accountMonogram, initials } from "@/components/visuals";
import { useAccounts, useCashflow, useProfile, useRecentTransactions, useRecurring, useSharedOverview, useUpdateProfile } from "@/hooks/queries";
import { greeting, monthName, monthRange, shortDate, todayISO } from "@/lib/dates";
import { addDays, format } from "date-fns";

export default function InicioPage() {
  const { data: profile } = useProfile();
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: recent, isLoading: loadingRecent } = useRecentTransactions(6);
  const { data: shared } = useSharedOverview();
  const { data: recurring = [] } = useRecurring();
  const month = monthRange();
  const { data: flow = [] } = useCashflow(month.from, month.to);
  const updateProfile = useUpdateProfile();
  const privateAccounts = usePrivateAccountIds();
  const sheets = useSheets();

  const currency = profile?.default_currency ?? "DOP";
  const hidden = profile?.hide_amounts ?? false;
  const active = (accounts ?? []).filter((a) => !a.archived_at);

  const totals = useMemo(() => {
    const byCur: Record<string, number> = {};
    for (const a of active) byCur[a.currency] = (byCur[a.currency] ?? 0) + a.balance;
    return byCur;
  }, [active]);
  const others = Object.entries(totals).filter(([c]) => c !== currency);

  const thisMonth = flow.find((f) => f.currency === currency);
  const net = (thisMonth?.income ?? 0) - (thisMonth?.expense ?? 0);
  const sharedTotals = shared?.totals[currency] ?? { owedToMe: 0, iOwe: 0 };
  const sharedOther = Object.entries(shared?.totals ?? {}).filter(([c, t]) => c !== currency && (t.owedToMe > 0 || t.iOwe > 0));
  const creditors = (shared?.friends ?? []).filter((f) => (f.amounts[currency] ?? 0) > 0);
  const debtors = (shared?.friends ?? []).filter((f) => (f.amounts[currency] ?? 0) < 0);
  const hasGroups = (shared?.groups ?? []).some((g) => g.me && !g.archived_at);

  const weekEnd = format(addDays(new Date(), 7), "yyyy-MM-dd");
  const upcoming = recurring.filter((r) => r.active && r.next_run_on <= weekEnd && r.next_run_on >= todayISO()).slice(0, 3);
  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col gap-6 pb-4">
      <header className="flex items-center justify-between pt-5 md:pt-8">
        <Link href="/ajustes" className="flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-[15px] font-extrabold text-primary-foreground">
            {profile ? initials(profile.display_name || "?") : ""}
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] text-muted-foreground">{greeting()}</span>
            <span className="text-[17px] font-bold">{firstName || <Skeleton className="h-5 w-20" />}</span>
          </span>
        </Link>
        <Button
          variant="secondary"
          size="icon"
          aria-label={hidden ? "Mostrar montos" : "Ocultar montos"}
          aria-pressed={hidden}
          onClick={() => updateProfile.mutate({ hide_amounts: !hidden })}
        >
          {hidden ? <EyeOff /> : <Eye />}
        </Button>
      </header>

      <section className="flex flex-col gap-2" aria-label="Patrimonio">
        <span className="text-[13px] font-medium text-muted-foreground">Patrimonio total</span>
        {loadingAccounts ? <Skeleton className="h-11 w-60" /> : <BigMoney amount={totals[currency] ?? 0} currency={currency} className="text-[42px]" />}
        {others.length > 0 && (
          <p className="text-[13px] text-muted-foreground">
            y{" "}
            {others.map(([c, v], i) => (
              <span key={c}>
                {i > 0 && " · "}
                <Money amount={v} currency={c} className="font-semibold text-foreground" />
              </span>
            ))}
          </p>
        )}
        <div className="flex items-center gap-2 text-[13px]">
          <span className={net >= 0 ? "rounded-full bg-primary-soft px-2.5 py-1 font-bold text-primary" : "rounded-full bg-negative/10 px-2.5 py-1 font-bold text-negative"}>
            <Money amount={net} currency={currency} sign="always" /> en {monthName(new Date())}
          </span>
          <span className="text-muted-foreground">ingresos − gastos</span>
        </div>
      </section>

      <div className="grid grid-cols-4 gap-2">
        <QuickAction label="Gasto" icon={ArrowUpRight} onClick={() => sheets.open({ type: "transaction", kind: "expense" })} />
        <QuickAction label="Ingreso" icon={ArrowDownLeft} onClick={() => sheets.open({ type: "transaction", kind: "income" })} />
        <QuickAction label="Transferir" icon={ArrowLeftRight} onClick={() => sheets.open({ type: "transfer" })} />
        <QuickAction label="Dividir" icon={Split} accent onClick={() => sheets.open({ type: "expense" })} />
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-secondary bg-card py-2 pl-4 pr-2">
        <Link href="/asistente" className="min-w-0 flex-1 truncate py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Pregúntale a Fynco o dicta un gasto…
        </Link>
        <Link
          href="/asistente?voz=1"
          aria-label="Dictar por voz"
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary transition-colors hover:bg-[#30353d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Mic className="h-5 w-5" />
        </Link>
      </div>

      <PendingInvites compact />

      {hasGroups ? (
        <Link href="/compartido" className="flex flex-col gap-3.5 rounded-2xl border border-secondary bg-card p-4 transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Gastos compartidos</span>
            <span className="flex items-center gap-0.5 text-[13px] text-muted-foreground">
              {shared?.groups.filter((g) => g.me && !g.archived_at && g.kind === "group").length ?? 0} grupos <ChevronRight className="h-4 w-4" />
            </span>
          </span>
          <span className="grid grid-cols-2 gap-3">
            <span className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Te deben</span>
              <Money amount={sharedTotals.owedToMe} currency={currency} className="text-[22px] font-extrabold text-positive" />
              <PeopleLine people={creditors.map((f) => ({ key: f.key, name: f.name }))} empty="Nadie" />
            </span>
            <span className="flex flex-col gap-1.5 border-l border-secondary pl-3">
              <span className="text-xs text-muted-foreground">Debes</span>
              <Money amount={sharedTotals.iOwe} currency={currency} className="text-[22px] font-extrabold text-negative" />
              <PeopleLine people={debtors.map((f) => ({ key: f.key, name: f.name }))} empty="A nadie" />
            </span>
          </span>
          {sharedOther.length > 0 && (
            <span className="text-xs text-muted-foreground">
              También tienes saldos en {sharedOther.map(([c]) => c).join(", ")}.
            </span>
          )}
        </Link>
      ) : (
        <Link href="/compartido?nuevo=1" className="flex items-center gap-3 rounded-2xl border border-dashed border-secondary p-4 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Users className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">Divide gastos con amigos</span>
            <span className="block text-xs text-muted-foreground">Viajes, apartamento, cenas: quién pagó y quién debe.</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      )}

      {upcoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle href="/recurrentes" action="Ver todos">
            Próximos 7 días
          </SectionTitle>
          <ul className="flex flex-col gap-2">
            {upcoming.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-secondary bg-card px-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                  <Repeat className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.description}</span>
                  <span className="block text-xs text-muted-foreground">{r.next_run_on === todayISO() ? "Hoy" : shortDate(r.next_run_on)}</span>
                </span>
                <Money amount={r.kind === "income" ? r.amount : -r.amount} currency={active.find((a) => a.id === r.account_id)?.currency} sign="always" className={r.kind === "income" ? "text-sm font-bold text-positive" : "text-sm font-bold"} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle href="/cuentas" action="Ver todas">
          Cuentas
        </SectionTitle>
        <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-3 md:px-0">
          {loadingAccounts
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[108px] w-[150px] shrink-0 rounded-xl md:w-auto" />)
            : active.map((a) => (
                <Link
                  key={a.id}
                  href={`/cuentas/${a.id}`}
                  className="flex w-[150px] shrink-0 flex-col gap-2.5 rounded-xl border border-secondary bg-card p-3.5 transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-auto"
                >
                  <Monogram text={accountMonogram(a.name)} />
                  <span className="flex flex-col gap-0.5">
                    <span className="truncate text-xs text-muted-foreground">
                      {a.name}
                      {a.last4 ? ` ···${a.last4}` : ""}
                    </span>
                    <Money amount={a.balance} currency={a.currency} masked={privateAccounts.has(a.id)} className="text-base font-bold" />
                  </span>
                </Link>
              ))}
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <SectionTitle href="/movimientos" action="Ver todo">
          Actividad
        </SectionTitle>
        {loadingRecent ? (
          <div className="flex flex-col gap-3 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <TransactionList transactions={recent ?? []} grouped={false} emptyText="Aún no hay movimientos. Toca + para registrar el primero." />
        )}
      </section>
    </div>
  );
}

function QuickAction({ label, icon: Icon, onClick, accent }: { label: string; icon: LucideIcon; onClick: () => void; accent?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center gap-2 rounded-xl text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span
        className={
          accent
            ? "flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary text-primary-foreground transition-transform group-active:scale-95"
            : "flex h-14 w-14 items-center justify-center rounded-[18px] border border-secondary bg-card transition-colors group-hover:bg-secondary group-active:scale-95"
        }
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={2.2} />
      </span>
      {label}
    </button>
  );
}

function PeopleLine({ people, empty }: { people: { key: string; name: string }[]; empty: string }) {
  if (!people.length) return <span className="text-xs text-muted-foreground">{empty}</span>;
  return (
    <span className="flex items-center gap-1.5">
      <AvatarStack people={people} size={24} max={3} />
      <span className="truncate text-xs text-muted-foreground">{people.map((p) => p.name.split(" ")[0]).slice(0, 2).join(", ")}{people.length > 2 ? "…" : ""}</span>
    </span>
  );
}

