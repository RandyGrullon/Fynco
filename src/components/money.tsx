"use client";

import { useMemo } from "react";
import { useGoals, useProfile } from "@/hooks/queries";
import { formatMoney, splitMoney, currencySymbol, type FormatOptions } from "@/lib/money";
import { cn } from "@/lib/utils";

export function useHideAmounts() {
  const { data } = useProfile();
  return data?.hide_amounts ?? false;
}

/** Cuentas ligadas a metas privadas: su saldo se oculta fuera de Metas. */
export function usePrivateAccountIds() {
  const { data: goals } = useGoals();
  return useMemo(() => new Set((goals ?? []).filter((g) => g.is_private && g.account_id && g.status !== "archived").map((g) => g.account_id!)), [goals]);
}

export function useDefaultCurrency() {
  const { data } = useProfile();
  return data?.default_currency ?? "DOP";
}

interface MoneyProps extends FormatOptions {
  amount: number;
  currency?: string;
  className?: string;
  /** "auto": lima si positivo con signo, coral si negativo. */
  tone?: "none" | "auto" | "positive" | "negative";
  /** Ocultar este monto aunque "ocultar montos" esté apagado (metas privadas). */
  masked?: boolean;
}

export function Money({ amount, currency, className, tone = "none", masked, ...opts }: MoneyProps) {
  const hide = useHideAmounts() || Boolean(masked);
  const fallback = useDefaultCurrency();
  const cur = currency ?? fallback;
  const color =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : tone === "auto"
          ? amount > 0
            ? "text-positive"
            : amount < 0
              ? "text-negative"
              : ""
          : "";
  const text = hide ? `${currencySymbol(cur)} ••••` : formatMoney(amount, cur, opts);
  return <span className={cn("tabular whitespace-nowrap", color, className)}>{text}</span>;
}

/** Cifra grande: "RD$" pequeño, entero grande y centavos atenuados. */
export function BigMoney({ amount, currency, className, masked }: { amount: number; currency?: string; className?: string; masked?: boolean }) {
  const hide = useHideAmounts() || Boolean(masked);
  const fallback = useDefaultCurrency();
  const cur = currency ?? fallback;
  const { whole, cents } = splitMoney(amount);
  return (
    <div className={cn("tabular flex items-baseline font-extrabold leading-none tracking-[-0.035em]", className)}>
      <span className="mr-1.5 text-[0.52em] font-bold tracking-normal text-muted-foreground">{currencySymbol(cur)}</span>
      {amount < 0 && <span>−</span>}
      {hide ? (
        <span>••••••</span>
      ) : (
        <>
          <span>{whole}</span>
          <span className="text-subtle">.{cents}</span>
        </>
      )}
    </div>
  );
}
