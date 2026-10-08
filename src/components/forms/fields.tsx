"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Money, usePrivateAccountIds } from "@/components/money";
import { iconFor } from "@/components/visuals";
import { currencySymbol } from "@/lib/money";
import type { Account, Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor?: string; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px] font-semibold text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-semibold text-negative" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Monto grande centrado, como en un neobanco. Guarda texto; el padre lo convierte con parseMoney. */
export function AmountField({
  value,
  onChange,
  currency,
  autoFocus,
  label = "Monto",
  tone,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  currency: string;
  autoFocus?: boolean;
  label?: string;
  tone?: "negative" | "positive";
  error?: string | null;
}) {
  const id = useId();
  return (
    <div className="flex flex-col items-center gap-1 py-3">
      <label htmlFor={id} className="text-[13px] font-semibold text-muted-foreground">
        {label}
      </label>
      <div className="flex items-baseline justify-center gap-2">
        <span className="text-2xl font-bold text-muted-foreground">{currencySymbol(currency)}</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          className={cn(
            "tabular w-full min-w-[3ch] max-w-[9ch] bg-transparent text-center text-[44px] font-extrabold leading-none tracking-[-0.035em] outline-none placeholder:text-secondary",
            tone === "negative" && value && "text-foreground",
            tone === "positive" && value && "text-primary",
          )}
          style={{ width: `${Math.max(1, value.length) + 0.5}ch` }}
          aria-invalid={Boolean(error)}
        />
      </div>
      {error && (
        <p className="text-xs font-semibold text-negative" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function CategoryPicker({
  categories,
  kind,
  value,
  onChange,
}: {
  categories: Category[];
  kind: "income" | "expense";
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const list = categories.filter((c) => c.kind === kind);
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
      {list.map((c) => {
        const Icon = iconFor(c.icon);
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : c.id)}
            className={cn(
              "flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-primary bg-primary text-primary-foreground" : "border-secondary bg-card text-foreground hover:bg-secondary",
            )}
          >
            <Icon className="h-4 w-4" style={active ? undefined : { color: c.color }} strokeWidth={2.2} />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  id,
  placeholder = "Elige una cuenta",
  exclude,
  currency,
}: {
  accounts: Account[];
  value: string | null | undefined;
  onChange: (id: string) => void;
  id?: string;
  placeholder?: string;
  exclude?: string | null;
  /** Solo cuentas en esta moneda (gastos y pagos de grupos). */
  currency?: string;
}) {
  // Etiqueta explícita: el SelectValue de Radix puede montarse vacío con un valor inicial.
  const selected = accounts.find((a) => a.id === value);
  const privateAccounts = usePrivateAccountIds();
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder}>
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.name}
              {selected.last4 ? ` ···${selected.last4}` : ""}
              <Money amount={selected.balance} currency={selected.currency} masked={privateAccounts.has(selected.id)} className="text-xs text-muted-foreground" />
            </span>
          ) : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {accounts
          .filter((a) => !a.archived_at && a.id !== exclude && (!currency || a.currency === currency))
          .map((a) => (
            <SelectItem key={a.id} value={a.id}>
              <span className="flex w-full items-center justify-between gap-4">
                <span>
                  {a.name}
                  {a.last4 ? ` ···${a.last4}` : ""}
                </span>
                <Money amount={a.balance} currency={a.currency} masked={privateAccounts.has(a.id)} className="text-xs text-muted-foreground" />
              </span>
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

export function DateField({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} required />;
}

/** Botones de opción tipo píldora (Gasto/Ingreso, métodos de reparto…). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg border border-border bg-card p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 rounded-md px-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value ? "bg-secondary font-bold text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
