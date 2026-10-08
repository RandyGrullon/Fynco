"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Download, Loader2, Plus, ReceiptText, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Money } from "@/components/money";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { useSheets } from "@/components/shell/sheets";
import { TransactionList } from "@/components/transactions/transaction-list";
import { useAccounts, useCashflow, useCategories, useProfile, useTransactions } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { fetchAllTransactions, type TransactionFilters } from "@/lib/data/transactions";
import { monthLabel, monthRange, shiftMonth } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { downloadFile, transactionsToCsv } from "@/lib/export";
import type { TxKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChipKey = "all" | "expense" | "income" | "transfer" | "shared";

const CHIPS: { key: ChipKey; label: string; kinds?: TxKind[] }[] = [
  { key: "all", label: "Todos" },
  { key: "expense", label: "Gastos", kinds: ["expense"] },
  { key: "income", label: "Ingresos", kinds: ["income"] },
  { key: "transfer", label: "Transferencias", kinds: ["transfer"] },
  { key: "shared", label: "Compartido", kinds: ["shared", "settlement"] },
];

const ALL_ACCOUNTS = "all";

export default function MovimientosPage() {
  const { data: profile } = useProfile();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const sheets = useSheets();

  const [chip, setChip] = useState<ChipKey>("all");
  const [accountId, setAccountId] = useState(ALL_ACCOUNTS);
  const [month, setMonth] = useState(() => new Date());
  const [allTime, setAllTime] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  // Búsqueda con espera de 300 ms para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const range = monthRange(month);
  const filters = useMemo<TransactionFilters>(() => {
    const f: TransactionFilters = {};
    const kinds = CHIPS.find((c) => c.key === chip)?.kinds;
    if (kinds) f.kinds = kinds;
    if (accountId !== ALL_ACCOUNTS) f.accountId = accountId;
    if (!allTime) {
      f.from = range.from;
      f.to = range.to;
    }
    if (search) f.search = search;
    return f;
  }, [chip, accountId, allTime, range.from, range.to, search]);

  const txq = useTransactions(filters);
  const rows = useMemo(() => txq.data?.pages.flat() ?? [], [txq.data]);

  const currency = profile?.default_currency ?? "DOP";
  const { data: flow = [], isLoading: loadingFlow } = useCashflow(range.from, range.to);
  const monthFlow = flow.find((f) => f.currency === currency);
  const income = monthFlow?.income ?? 0;
  const expense = monthFlow?.expense ?? 0;
  const net = income - expense;

  const filtered = chip !== "all" || accountId !== ALL_ACCOUNTS || Boolean(search);
  const sortedAccounts = useMemo(() => [...accounts].sort((a, b) => Number(Boolean(a.archived_at)) - Number(Boolean(b.archived_at))), [accounts]);

  function goMonth(n: number) {
    setMonth((m) => shiftMonth(m, n));
    setAllTime(false);
  }

  function clearFilters() {
    setChip("all");
    setAccountId(ALL_ACCOUNTS);
    setQuery("");
    setSearch("");
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const all = await fetchAllTransactions(filters);
      if (!all.length) {
        toast({ title: "No hay movimientos para exportar", description: "Cambia los filtros e inténtalo otra vez." });
        return;
      }
      const label = allTime ? "todo" : format(month, "yyyy-MM");
      downloadFile(`fynco-movimientos-${label}.csv`, transactionsToCsv(all, accounts, categories));
      toast({ title: "Exportación lista", description: `${all.length} ${all.length === 1 ? "movimiento" : "movimientos"} en CSV.` });
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo exportar", description: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="Movimientos"
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={exporting} className="h-11 rounded-full px-4 text-sm">
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            {exporting ? "Exportando…" : "Exportar"}
          </Button>
        }
      />

      <div role="group" aria-label="Tipo de movimiento" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={chip === c.key}
            onClick={() => setChip(c.key)}
            className={cn(
              "h-11 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              chip === c.key ? "border-primary bg-primary text-primary-foreground" : "border-secondary bg-card text-foreground hover:bg-secondary",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-xl border border-secondary bg-card p-0.5">
          <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => goMonth(-1)}>
            <ChevronLeft />
          </Button>
          <span className={cn("min-w-0 flex-1 truncate text-center text-[15px] font-bold", allTime && "text-muted-foreground")} aria-live="polite">
            {allTime ? "Todo el historial" : monthLabel(month)}
          </span>
          <Button variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => goMonth(1)}>
            <ChevronRight />
          </Button>
        </div>
        <button
          type="button"
          aria-pressed={allTime}
          onClick={() => setAllTime((v) => !v)}
          className={cn(
            "h-12 shrink-0 rounded-xl border px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            allTime ? "border-primary bg-primary text-primary-foreground" : "border-secondary bg-card text-foreground hover:bg-secondary",
          )}
        >
          Todo
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por descripción"
            aria-label="Buscar movimientos"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            className="pl-10 pr-12"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Borrar búsqueda"
              className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger aria-label="Filtrar por cuenta">
            <SelectValue>
              {(() => {
                const a = sortedAccounts.find((x) => x.id === accountId);
                return a ? `${a.name}${a.last4 ? ` ···${a.last4}` : ""}` : "Todas las cuentas";
              })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ACCOUNTS}>Todas las cuentas</SelectItem>
            {sortedAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
                {a.last4 ? ` ···${a.last4}` : ""}
                {a.archived_at ? " (archivada)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!allTime && (
        <section aria-label={`Resumen de ${monthLabel(month)}`} className="flex flex-col gap-2.5 rounded-2xl border border-secondary bg-card p-4">
          <dl className="flex flex-col gap-1.5 sm:grid sm:grid-cols-3 sm:gap-3">
            <SummaryItem label="Ingresos" loading={loadingFlow}>
              <Money amount={income} currency={currency} sign="always" className="text-[15px] font-bold text-positive" />
            </SummaryItem>
            <SummaryItem label="Gastos" loading={loadingFlow} className="sm:border-l sm:border-secondary sm:pl-3">
              <Money amount={-expense} currency={currency} className="text-[15px] font-bold" />
            </SummaryItem>
            <SummaryItem label="Neto" loading={loadingFlow} className="sm:border-l sm:border-secondary sm:pl-3">
              <Money amount={net} currency={currency} sign="always" tone="auto" className="text-[15px] font-bold" />
            </SummaryItem>
          </dl>
          <p className="text-xs text-muted-foreground">Todas tus cuentas en {currency}. Gastos incluye tu parte de los gastos compartidos.</p>
        </section>
      )}

      <section aria-label="Lista de movimientos" className="flex flex-col">
        {txq.isLoading ? (
          <div className="flex flex-col gap-3 pt-2">
            <Skeleton className="h-4 w-24" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : txq.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-secondary bg-card p-6 text-center" role="alert">
            <p className="text-sm text-muted-foreground">No pudimos cargar tus movimientos.</p>
            <Button variant="secondary" onClick={() => txq.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={ReceiptText}
              title="Nada por aquí"
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Quitar filtros
                </Button>
              }
            >
              No hay movimientos que coincidan con estos filtros{allTime ? "" : ` en ${monthLabel(month).toLowerCase()}`}.
            </EmptyState>
          ) : (
            <EmptyState
              icon={ReceiptText}
              title={allTime ? "Aún no hay movimientos" : `Sin movimientos en ${monthLabel(month).toLowerCase()}`}
              action={
                <Button onClick={() => sheets.open({ type: "transaction", kind: "expense" })}>
                  <Plus />
                  Registrar un gasto
                </Button>
              }
            >
              Lo que registres aparecerá aquí, agrupado por día.
            </EmptyState>
          )
        ) : (
          <TransactionList transactions={rows} />
        )}
        {txq.hasNextPage && (
          <Button variant="secondary" className="mt-3" onClick={() => txq.fetchNextPage()} disabled={txq.isFetchingNextPage}>
            {txq.isFetchingNextPage ? "Cargando…" : "Cargar más"}
          </Button>
        )}
      </section>
    </div>
  );
}

function SummaryItem({ label, loading, className, children }: { label: string; loading?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:gap-0.5", className)}>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd>{loading ? <Skeleton className="h-5 w-24" /> : children}</dd>
    </div>
  );
}
