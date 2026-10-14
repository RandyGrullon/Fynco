"use client";

import { Money } from "@/components/money";
import type { Rich } from "@/lib/plan/types";

/** Texto del plan con montos que respetan "ocultar montos". */
export function RichLine({ parts, className }: { parts: Rich; className?: string }) {
  return (
    <span className={className}>
      {parts.map((p, i) => (typeof p === "string" ? <span key={i}>{p}</span> : <Money key={i} amount={p.amount} currency={p.currency} className="font-semibold text-foreground" />))}
    </span>
  );
}
