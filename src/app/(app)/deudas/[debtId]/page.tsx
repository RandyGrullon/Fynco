"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, CircleCheck, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { BigMoney, Money } from "@/components/money";
import { EmptyState, PageHeader, SectionTitle } from "@/components/shell/page-header";
import { useSheets } from "@/components/shell/sheets";
import { debtView } from "@/components/debts/debt-view";
import { useAccounts, useDebtMutations, useDebts } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { dayLabel, shortDate, todayISO } from "@/lib/dates";
import { FREQUENCY_LABEL, interestLabel, type InstallmentStatus } from "@/lib/debts";
import type { PersonDebtPayment } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATE: Record<InstallmentStatus["state"], { label: string; cls: string }> = {
  paid: { label: "Pagada", cls: "bg-primary-soft text-primary" },
  partial: { label: "Parcial", cls: "bg-secondary text-foreground" },
  overdue: { label: "Vencida", cls: "bg-negative/15 text-negative" },
  pending: { label: "Pendiente", cls: "bg-secondary text-muted-foreground" },
};

export default function DeudaPage() {
  const { debtId } = useParams<{ debtId: string }>();
  const { data: debts, isLoading } = useDebts();
  const { data: accounts = [] } = useAccounts();
  const m = useDebtMutations();
  const sheets = useSheets();
  const today = todayISO();
  const [deleting, setDeleting] = useState<PersonDebtPayment | null>(null);
  const debt = debts?.find((d) => d.id === debtId);
  const view = useMemo(() => (debt ? debtView(debt, today) : null), [debt, today]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 pt-4">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }
  if (!debt || !view) {
    return (
      <div className="flex flex-col gap-6 pb-4">
        <PageHeader back="/deudas" title="Deuda" />
        <EmptyState title="No encontramos esta deuda">Puede que se haya eliminado.</EmptyState>
      </div>
    );
  }

  const { terms, status } = view;
  const borrowed = debt.direction === "borrowed";
  const pct = terms.total ? Math.min(100, Math.round((status.paid / terms.total) * 100)) : 0;
  const account = accounts.find((a) => a.id === debt.account_id);
  const n = terms.installments.length;

  async function removePayment() {
    if (!deleting) return;
    try {
      await m.removePayment.mutateAsync(deleting.id);
    } catch {
      return;
    }
    toast({ title: borrowed ? "Pago eliminado" : "Cobro eliminado" });
    setDeleting(null);
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageHeader back="/deudas" title={debt.person} subtitle={`${borrowed ? "Te prestó" : "Le prestaste"} · ${interestLabel(debt.interest_rate, debt.interest_period)}`} />

      <section className="flex flex-col gap-2" aria-label="Saldo">
        <span className="text-[13px] font-medium text-muted-foreground">{status.done ? "Saldada" : borrowed ? "Te falta pagar" : "Te falta cobrar"}</span>
        <BigMoney amount={status.remaining} currency={debt.currency} className={cn("text-[42px]", borrowed && !status.done && "text-negative")} />
        <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Pagado" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[13px] text-muted-foreground">
          {borrowed ? "Pagado" : "Cobrado"} <Money amount={status.paid} currency={debt.currency} className="font-semibold text-foreground" /> de{" "}
          <Money amount={terms.total} currency={debt.currency} className="font-semibold text-foreground" />
          {status.overdue > 0 && (
            <span className="font-semibold text-negative">
              {" "}
              · vencido <Money amount={status.overdue} currency={debt.currency} />
            </span>
          )}
        </span>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <Button className="h-12" onClick={() => sheets.open({ type: "debt_payment", debtId: debt.id })} disabled={status.done}>
          <CircleCheck />
          {borrowed ? "Registrar pago" : "Registrar cobro"}
        </Button>
        <Button variant="secondary" className="h-12" onClick={() => sheets.open({ type: "debt", debt })}>
          <Pencil />
          Editar
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-secondary bg-card p-4 text-sm">
        <Fact label="Prestado">
          <Money amount={debt.principal} currency={debt.currency} />
        </Fact>
        <Fact label="Interés">
          <Money amount={terms.interest} currency={debt.currency} />
        </Fact>
        <Fact label={borrowed ? "Total a pagar" : "Total a cobrar"}>
          <Money amount={terms.total} currency={debt.currency} />
        </Fact>
        <Fact label="Forma de pago">{n === 1 ? "Un solo pago" : `${n} cuotas · ${FREQUENCY_LABEL[debt.frequency].toLowerCase()}`}</Fact>
        <Fact label="Fecha del préstamo">{shortDate(debt.started_on)}</Fact>
        <Fact label={n === 1 ? "Fecha límite" : "Última cuota"}>{shortDate(terms.last_due_on)}</Fact>
        {account && <Fact label={borrowed ? "Entró a" : "Salió de"}>{account.name}</Fact>}
      </dl>
      {debt.note && <p className="-mt-3 rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground">{debt.note}</p>}

      <section className="flex flex-col gap-2">
        <SectionTitle>{n === 1 ? "Pago" : "Cuotas"}</SectionTitle>
        <ul className="flex flex-col divide-y divide-secondary rounded-2xl border border-secondary bg-card px-4">
          {status.schedule.map((c) => (
            <li key={c.n} className="flex items-center gap-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">{c.state === "paid" ? <Check className="h-4 w-4 text-primary" /> : c.n}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{c.due_on === today ? "Hoy" : shortDate(c.due_on)}</span>
                {c.state === "partial" || (c.state === "overdue" && c.pending < c.amount) ? (
                  <span className="block text-xs text-muted-foreground">
                    Falta <Money amount={c.pending} currency={debt.currency} />
                  </span>
                ) : null}
              </span>
              <Money amount={c.amount} currency={debt.currency} className={cn("text-sm font-bold", c.state === "paid" && "text-muted-foreground line-through")} />
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", STATE[c.state].cls)}>{STATE[c.state].label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>{borrowed ? "Pagos" : "Cobros"}</SectionTitle>
        {debt.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay {borrowed ? "pagos" : "cobros"}.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-secondary rounded-2xl border border-secondary bg-card px-4">
            {[...debt.payments].reverse().map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{dayLabel(p.paid_on)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{accounts.find((a) => a.id === p.account_id)?.name ?? "Sin cuenta"}</span>
                </span>
                <Money amount={p.amount} currency={debt.currency} className="text-sm font-bold" />
                <Button variant="ghost" size="icon-sm" aria-label="Eliminar este pago" onClick={() => setDeleting(p)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este {borrowed ? "pago" : "cobro"}?</AlertDialogTitle>
            <AlertDialogDescription>Si se registró en una cuenta, ese movimiento también se borra.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.removePayment.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={m.removePayment.isPending}
              onClick={(e) => {
                e.preventDefault();
                void removePayment();
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-semibold">{children}</dd>
    </div>
  );
}
