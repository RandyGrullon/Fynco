"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BigMoney, Money, usePrivateAccountIds } from "@/components/money";
import { EmptyState, PageHeader, SectionTitle } from "@/components/shell/page-header";
import { Monogram, accountMonogram } from "@/components/visuals";
import { ACCOUNT_TYPE_LABEL, AccountPanel } from "@/components/accounts/account-panel";
import { useAccounts, useProfile } from "@/hooks/queries";
import { sumByCurrency } from "@/lib/money";
import type { Account } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function CuentasPage() {
  const { data: profile } = useProfile();
  const { data: accounts, isLoading, isError, refetch } = useAccounts();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const currency = profile?.default_currency ?? "DOP";
  const active = useMemo(() => (accounts ?? []).filter((a) => !a.archived_at), [accounts]);
  const archived = useMemo(() => (accounts ?? []).filter((a) => a.archived_at), [accounts]);
  const totals = useMemo(() => sumByCurrency(active, (a) => a.currency, (a) => a.balance), [active]);
  const others = Object.entries(totals).filter(([c]) => c !== currency);

  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageHeader
        title="Cuentas"
        actions={
          <Button onClick={() => setCreating(true)} className="h-11 rounded-full px-4 text-sm">
            <Plus />
            Nueva cuenta
          </Button>
        }
      />

      <section className="flex flex-col gap-2" aria-label="Saldo total">
        <span className="text-[13px] font-medium text-muted-foreground">Saldo total en {currency}</span>
        {isLoading ? <Skeleton className="h-11 w-56" /> : <BigMoney amount={totals[currency] ?? 0} currency={currency} className="text-[40px]" />}
        {others.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Otras monedas">
            {others.map(([c, v]) => (
              <li key={c} className="rounded-full border border-secondary bg-card px-3 py-1.5 text-[13px]">
                <Money amount={v} currency={c} className={cn("font-semibold", v < 0 && "text-negative")} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Activas</SectionTitle>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[66px] w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-secondary bg-card p-6 text-center" role="alert">
            <p className="text-sm text-muted-foreground">No pudimos cargar tus cuentas.</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        ) : active.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Aún no tienes cuentas activas"
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus />
                Crear cuenta
              </Button>
            }
          >
            Agrega tu cuenta de banco, tarjeta o efectivo para registrar movimientos.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((a) => (
              <li key={a.id}>
                <AccountRow account={a} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={showArchived}
            aria-controls="cuentas-archivadas"
            onClick={() => setShowArchived((s) => !s)}
            className="flex h-11 items-center justify-between rounded-lg text-[15px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Archivadas ({archived.length})
            <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", showArchived && "rotate-180")} aria-hidden="true" />
          </button>
          {showArchived && (
            <ul id="cuentas-archivadas" className="flex flex-col gap-2">
              {archived.map((a) => (
                <li key={a.id}>
                  <AccountRow account={a} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {creating && <AccountPanel open onOpenChange={setCreating} />}
    </div>
  );
}

function AccountRow({ account: a }: { account: Account }) {
  const privateAccounts = usePrivateAccountIds();
  const meta = [ACCOUNT_TYPE_LABEL[a.type], a.institution, a.last4 ? `···${a.last4}` : null].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/cuentas/${a.id}`}
      className="flex min-h-[66px] items-center gap-3 rounded-xl border border-secondary bg-card px-3.5 py-3 transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Monogram text={accountMonogram(a.name)} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("truncate text-[15px] font-semibold", a.archived_at && "text-muted-foreground")}>{a.name}</span>
          {a.is_default && <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">Predeterminada</span>}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      <Money amount={a.balance} currency={a.currency} masked={privateAccounts.has(a.id)} className={cn("text-[15px] font-bold", a.balance < 0 && "text-negative")} />
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
