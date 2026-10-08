"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Pencil, Star, Wallet, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BigMoney, Money, usePrivateAccountIds } from "@/components/money";
import { EmptyState, PageHeader, SectionTitle } from "@/components/shell/page-header";
import { useSheets } from "@/components/shell/sheets";
import { TransactionList } from "@/components/transactions/transaction-list";
import { ACCOUNT_TYPE_LABEL, AccountPanel } from "@/components/accounts/account-panel";
import { useAccountMutations, useAccounts, useTransactions } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function CuentaDetallePage() {
  const { accountId } = useParams<{ accountId: string }>();
  const router = useRouter();
  const sheets = useSheets();
  const m = useAccountMutations();
  const { data: accounts, isLoading, isError, refetch } = useAccounts();
  const filters = useMemo(() => ({ accountId }), [accountId]);
  const txq = useTransactions(filters);
  const [editing, setEditing] = useState(false);
  const privateAccounts = usePrivateAccountIds();

  const account = accounts?.find((a) => a.id === accountId);
  const rows = useMemo(() => txq.data?.pages.flat() ?? [], [txq.data]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 pb-4">
        <PageHeader back="/cuentas" title={<span className="inline-block h-7 w-40 animate-pulse rounded-md bg-muted align-middle" aria-label="Cargando" />} />
        <Skeleton className="h-11 w-56" />
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="mx-auto h-14 w-14 rounded-[18px]" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6 pb-4">
        <PageHeader back="/cuentas" title="Cuenta" />
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-secondary bg-card p-6 text-center" role="alert">
          <p className="text-sm text-muted-foreground">No pudimos cargar esta cuenta.</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col gap-6 pb-4">
        <PageHeader back="/cuentas" title="Cuenta" />
        <EmptyState
          icon={Wallet}
          title="No encontramos esta cuenta"
          action={
            <Button asChild variant="secondary">
              <Link href="/cuentas">Ver mis cuentas</Link>
            </Button>
          }
        >
          Puede que la hayas eliminado o que el enlace no sea correcto.
        </EmptyState>
      </div>
    );
  }

  const acc = account;
  const archived = Boolean(acc.archived_at);
  const subtitle = [ACCOUNT_TYPE_LABEL[acc.type], acc.institution, acc.last4 ? `···${acc.last4}` : null].filter(Boolean).join(" · ");

  async function makeDefault() {
    try {
      await m.setDefault.mutateAsync(acc.id);
    } catch {
      return;
    }
    toast({ title: "Cuenta predeterminada", description: `${acc.name} se elegirá primero al registrar movimientos.` });
  }

  async function restore() {
    try {
      await m.update.mutateAsync({ id: acc.id, patch: { archived_at: null } });
    } catch {
      return;
    }
    toast({ title: "Cuenta restaurada", description: acc.name });
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageHeader back="/cuentas" title={acc.name} subtitle={subtitle} />

      <section className="flex flex-col gap-2" aria-label="Saldo">
        <span className="text-[13px] font-medium text-muted-foreground">{acc.balance < 0 ? "Deuda actual" : "Saldo actual"}</span>
        <BigMoney amount={acc.balance} currency={acc.currency} masked={privateAccounts.has(acc.id)} className={cn("text-[42px]", acc.balance < 0 && "text-negative")} />
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {acc.is_default ? (
            <span className="rounded-full bg-primary-soft px-2.5 py-1 font-bold text-primary">Predeterminada</span>
          ) : (
            !archived && (
              <Button variant="secondary" size="sm" className="h-11 px-4 text-[13px]" onClick={makeDefault} disabled={m.setDefault.isPending}>
                <Star className="!size-4" />
                Hacer predeterminada
              </Button>
            )
          )}
          <span className="text-muted-foreground">
            Saldo inicial <Money amount={acc.opening_balance} currency={acc.currency} className="font-semibold text-foreground" />
          </span>
        </div>
      </section>

      {archived ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-secondary bg-card p-4">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Archive className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Esta cuenta está archivada: no aparece al registrar movimientos, pero conserva su historial.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={restore} disabled={m.update.isPending}>
              Restaurar
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil />
              Editar
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <Action label="Gasto" icon={ArrowUpRight} onClick={() => sheets.open({ type: "transaction", kind: "expense", preset: { account_id: acc.id } })} />
          <Action label="Ingreso" icon={ArrowDownLeft} onClick={() => sheets.open({ type: "transaction", kind: "income", preset: { account_id: acc.id } })} />
          <Action label="Transferir" icon={ArrowLeftRight} onClick={() => sheets.open({ type: "transfer", preset: { from: acc.id } })} />
          <Action label="Editar" icon={Pencil} onClick={() => setEditing(true)} />
        </div>
      )}

      <section className="flex flex-col gap-1">
        <SectionTitle>Movimientos</SectionTitle>
        {txq.isLoading ? (
          <div className="flex flex-col gap-3 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : txq.isError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center" role="alert">
            <p className="text-sm text-muted-foreground">No pudimos cargar los movimientos.</p>
            <Button variant="secondary" onClick={() => txq.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <TransactionList transactions={rows} emptyText="Esta cuenta aún no tiene movimientos." />
        )}
        {txq.hasNextPage && (
          <Button variant="secondary" className="mt-3" onClick={() => txq.fetchNextPage()} disabled={txq.isFetchingNextPage}>
            {txq.isFetchingNextPage ? "Cargando…" : "Cargar más"}
          </Button>
        )}
      </section>

      {editing && <AccountPanel open onOpenChange={setEditing} account={acc} onDeleted={() => router.replace("/cuentas")} />}
    </div>
  );
}

function Action({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-xl text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-secondary bg-card transition-colors group-hover:bg-secondary group-active:scale-95">
        <Icon className="h-[22px] w-[22px]" strokeWidth={2.2} />
      </span>
      {label}
    </button>
  );
}
