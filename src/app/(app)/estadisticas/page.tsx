"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download, PieChart as PieIcon, RefreshCw } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money";
import { EmptyState, PageHeader, SectionTitle } from "@/components/shell/page-header";
import { iconFor } from "@/components/visuals";
import { useAccounts, useCashflow, useCategories, useProfile, useSpendingByCategory } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { fetchAllTransactions } from "@/lib/data/transactions";
import { monthLabel, monthRange, shiftMonth, toISODate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { downloadFile, transactionsToCsv } from "@/lib/export";
import type { Category } from "@/lib/types";

const INCOME_COLOR = "#C8F05A";
const EXPENSE_COLOR = "#FF8A7A";
const AXIS_COLOR = "#9AA0AA";
const CARD_COLOR = "#171A1F";
const UNCATEGORIZED_COLOR = "#6B717C";
const REST_COLOR = "#3A3F48";
/** Rebanadas máximas del donut; el resto se agrupa (la lista muestra todas). */
const MAX_SLICES = 7;

const percent = new Intl.NumberFormat("es-DO", { style: "percent", maximumFractionDigits: 0 });

interface CategoryRow {
  key: string;
  name: string;
  icon: string | null;
  color: string;
  total: number;
  share: number;
}

interface MonthBar {
  key: string;
  label: string;
  full: string;
  income: number;
  expense: number;
}

export default function EstadisticasPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const { data: profile } = useProfile();
  const currency = profile?.default_currency ?? "DOP";

  const range = monthRange(month);
  const monthKey = range.from.slice(0, 7);
  const sixFrom = toISODate(startOfMonth(shiftMonth(month, -5)));
  const isCurrent = monthKey >= format(new Date(), "yyyy-MM");

  const spending = useSpendingByCategory(range.from, range.to);
  const flow = useCashflow(sixFrom, range.to);
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const [exporting, setExporting] = useState(false);

  const loading = !profile || spending.isLoading || flow.isLoading;
  const failed = spending.isError || flow.isError;

  const flowRows = flow.data ?? [];
  const thisMonth = flowRows.find((f) => f.currency === currency && f.month.slice(0, 7) === monthKey);
  const income = thisMonth?.income ?? 0;
  const expense = thisMonth?.expense ?? 0;
  const saving = income - expense;
  const rate = income > 0 ? saving / income : null;

  const rows = useMemo(() => buildCategoryRows(spending.data ?? [], currency, categories), [spending.data, currency, categories]);
  const totalSpent = rows.reduce((s, r) => s + r.total, 0);
  const slices = useMemo(() => {
    if (rows.length <= MAX_SLICES + 1) return rows;
    const head = rows.slice(0, MAX_SLICES);
    const rest = rows.slice(MAX_SLICES).reduce((s, r) => s + r.total, 0);
    return [...head, { key: "__rest", name: "Resto", icon: null, color: REST_COLOR, total: rest, share: totalSpent ? rest / totalSpent : 0 }];
  }, [rows, totalSpent]);

  const bars = useMemo<MonthBar[]>(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = shiftMonth(month, i - 5);
        const key = format(d, "yyyy-MM");
        const row = flowRows.find((f) => f.currency === currency && f.month.slice(0, 7) === key);
        return { key, label: format(d, "MMM", { locale: es }).replace(".", ""), full: monthLabel(d), income: row?.income ?? 0, expense: row?.expense ?? 0 };
      }),
    [flowRows, currency, month],
  );
  const hasBars = bars.some((b) => b.income > 0 || b.expense > 0);

  const otherCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const r of spending.data ?? []) if (r.currency !== currency) set.add(r.currency);
    for (const r of flowRows) if (r.currency !== currency && (r.income || r.expense)) set.add(r.currency);
    return [...set];
  }, [spending.data, flowRows, currency]);

  async function exportCsv() {
    setExporting(true);
    try {
      const txs = await fetchAllTransactions({ from: range.from, to: range.to });
      if (!txs.length) {
        toast({ title: "Nada que exportar", description: `No hay movimientos en ${monthLabel(month).toLowerCase()}.` });
        return;
      }
      downloadFile(`fynco-${monthKey}.csv`, transactionsToCsv(txs, accounts, categories));
      toast({ title: "CSV descargado", description: `${txs.length} ${txs.length === 1 ? "movimiento" : "movimientos"} de ${monthLabel(month).toLowerCase()}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo exportar", description: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader
        title="Estadísticas"
        back="/mas"
        actions={
          <Button variant="secondary" size="sm" className="h-11 px-4 text-[13px]" onClick={exportCsv} disabled={exporting} aria-label={`Exportar movimientos de ${monthLabel(month)} en CSV`}>
            <Download className="!size-4" />
            {exporting ? "Exportando…" : "CSV"}
          </Button>
        }
      />

      <div className="flex items-center justify-between rounded-xl border border-secondary bg-card p-1">
        <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <ChevronLeft />
        </Button>
        <h2 className="text-[15px] font-bold" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <Button variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={isCurrent}>
          <ChevronRight />
        </Button>
      </div>

      {failed ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-secondary bg-card px-6 py-8 text-center">
          <p className="font-bold" role="alert">
            No pudimos cargar tus estadísticas.
          </p>
          <p className="text-sm text-muted-foreground">{errorMessage(spending.error ?? flow.error)}</p>
          <Button
            variant="secondary"
            onClick={() => {
              spending.refetch();
              flow.refetch();
            }}
          >
            <RefreshCw /> Reintentar
          </Button>
        </div>
      ) : (
        <>
          <section aria-label="Resumen del mes" className="grid grid-cols-2 gap-2.5">
            <Tile label="Ingresos" swatch={INCOME_COLOR} loading={loading}>
              <Money amount={income} currency={currency} />
            </Tile>
            <Tile label="Gastos" swatch={EXPENSE_COLOR} loading={loading}>
              <Money amount={expense} currency={currency} />
            </Tile>
            <Tile label="Ahorro" hint="ingresos − gastos" loading={loading}>
              <Money amount={saving} currency={currency} tone={saving < 0 ? "negative" : saving > 0 ? "positive" : "none"} />
            </Tile>
            <Tile label="Tasa de ahorro" hint="de tus ingresos" loading={loading}>
              <span className={rate != null && rate < 0 ? "text-negative" : undefined}>{rate == null ? "—" : percent.format(rate)}</span>
            </Tile>
          </section>

          <div className="-mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
            <p>Los gastos compartidos cuentan solo tu parte.</p>
            {otherCurrencies.length > 0 && (
              <p>
                También tienes movimientos en {otherCurrencies.join(", ")}. Aquí solo ves los de {currency}; cambia tu moneda principal en{" "}
                <Link href="/ajustes" className="font-semibold text-primary underline-offset-4 hover:underline">
                  Ajustes
                </Link>
                .
              </p>
            )}
          </div>

          <section className="flex flex-col gap-3" aria-labelledby="stats-categories">
            <SectionTitle>
              <span id="stats-categories">En qué gastaste</span>
            </SectionTitle>
            {loading ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-secondary bg-card p-4">
                <Skeleton className="h-[200px] w-[200px] rounded-full" />
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState icon={PieIcon} title={`Sin gastos en ${monthLabel(month).toLowerCase()}`}>
                Cuando registres gastos, aquí verás en qué se va tu dinero.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-4 rounded-2xl border border-secondary bg-card p-4 md:flex-row md:items-center md:gap-6">
                <div className="relative mx-auto h-[220px] w-[220px] shrink-0" role="img" aria-label={`Gastos de ${monthLabel(month)} por categoría`}>
                  {/* Antes del gráfico para que el tooltip quede por encima */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xs text-muted-foreground">Gastaste</span>
                    <Money amount={totalSpent} currency={currency} className="text-lg font-extrabold" />
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={slices}
                        dataKey="total"
                        nameKey="name"
                        innerRadius="72%"
                        outerRadius="100%"
                        startAngle={90}
                        endAngle={-270}
                        stroke={CARD_COLOR}
                        strokeWidth={slices.length > 1 ? 2 : 0}
                        isAnimationActive={false}
                      >
                        {slices.map((s) => (
                          <Cell key={s.key} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<SliceTooltip currency={currency} />} wrapperStyle={{ zIndex: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ol className="flex min-w-0 flex-1 flex-col">
                  {rows.map((r) => (
                    <CategoryItem key={r.key} row={r} currency={currency} />
                  ))}
                </ol>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="stats-months">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="stats-months" className="text-[15px] font-bold">
                Últimos 6 meses
              </h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME_COLOR }} /> Ingresos
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: EXPENSE_COLOR }} /> Gastos
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-secondary bg-card p-4">
              {loading ? (
                <Skeleton className="h-[200px] w-full rounded-lg" />
              ) : !hasBars ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Aún no hay movimientos en estos meses.</p>
              ) : (
                <>
                  <div className="h-[200px] w-full" role="img" aria-label="Ingresos y gastos de los últimos 6 meses">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bars} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barGap={2} barCategoryGap="24%">
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 12 }} dy={6} />
                        <Tooltip content={<FlowTooltip currency={currency} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} wrapperStyle={{ zIndex: 10 }} />
                        <Bar dataKey="income" name="Ingresos" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                        <Bar dataKey="expense" name="Gastos" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <table className="sr-only">
                    <caption>Ingresos y gastos por mes, en {currency}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Mes</th>
                        <th scope="col">Ingresos</th>
                        <th scope="col">Gastos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bars.map((b) => (
                        <tr key={b.key}>
                          <th scope="row">{b.full}</th>
                          <td>
                            <Money amount={b.income} currency={currency} />
                          </td>
                          <td>
                            <Money amount={b.expense} currency={currency} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function buildCategoryRows(data: { category_id: string | null; currency: string; total: number }[], currency: string, categories: Category[]): CategoryRow[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const buckets = new Map<string, Omit<CategoryRow, "share">>();
  for (const r of data) {
    if (r.currency !== currency || r.total <= 0) continue;
    const cat = r.category_id ? byId.get(r.category_id) : undefined;
    // Sin categoría, o una categoría propia de otra persona del grupo (no la puedes leer).
    const key = cat ? cat.id : r.category_id ? "__other" : "__none";
    const prev = buckets.get(key);
    if (prev) prev.total += r.total;
    else
      buckets.set(key, {
        key,
        name: cat?.name ?? (r.category_id ? "Otras categorías" : "Sin categoría"),
        icon: cat?.icon ?? null,
        color: cat?.color ?? UNCATEGORIZED_COLOR,
        total: r.total,
      });
  }
  const list = [...buckets.values()].sort((a, b) => b.total - a.total);
  const sum = list.reduce((s, r) => s + r.total, 0);
  return list.map((r) => ({ ...r, share: sum ? r.total / sum : 0 }));
}

function Tile({ label, hint, swatch, loading, children }: { label: string; hint?: string; swatch?: string; loading?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-secondary bg-card p-3.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {swatch && <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: swatch }} />}
        {label}
      </span>
      {loading ? <Skeleton className="h-6 w-24" /> : <span className="tabular truncate text-[15px] font-extrabold leading-tight sm:text-lg">{children}</span>}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function CategoryItem({ row, currency }: { row: CategoryRow; currency: string }) {
  const Icon = iconFor(row.icon);
  const pct = row.share < 0.01 && row.share > 0 ? "<1 %" : percent.format(row.share);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-secondary bg-background" style={{ color: row.color }}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold">{row.name}</span>
          <Money amount={row.total} currency={currency} className="text-sm font-bold" />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${Math.max(row.share * 100, 1)}%`, background: row.color }} />
          </div>
          <span className="tabular w-10 shrink-0 text-right text-xs text-muted-foreground">{pct}</span>
        </div>
      </div>
    </li>
  );
}

// Recharts clona estos elementos y les pasa active/payload.
interface TooltipLike<T> {
  active?: boolean;
  payload?: { payload: T }[];
}

function FlowTooltip({ active, payload, currency }: TooltipLike<MonthBar> & { currency: string }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-secondary bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-bold">{row.full}</p>
      <p className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-sm" style={{ background: INCOME_COLOR }} />
        <span className="text-muted-foreground">Ingresos</span>
        <Money amount={row.income} currency={currency} className="ml-auto pl-3 font-bold" />
      </p>
      <p className="mt-1 flex items-center gap-2">
        <span className="h-2 w-2 rounded-sm" style={{ background: EXPENSE_COLOR }} />
        <span className="text-muted-foreground">Gastos</span>
        <Money amount={row.expense} currency={currency} className="ml-auto pl-3 font-bold" />
      </p>
    </div>
  );
}

function SliceTooltip({ active, payload, currency }: TooltipLike<CategoryRow> & { currency: string }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-secondary bg-card px-3 py-2 text-xs shadow-lg">
      <p className="flex items-center gap-2 font-bold">
        <span className="h-2 w-2 rounded-sm" style={{ background: row.color }} />
        {row.name}
      </p>
      <p className="mt-1 text-muted-foreground">
        <Money amount={row.total} currency={currency} className="font-bold text-foreground" /> · {percent.format(row.share)}
      </p>
    </div>
  );
}
