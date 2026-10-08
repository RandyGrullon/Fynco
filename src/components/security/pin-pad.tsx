"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

/** Teclado numérico de PIN (4–6 dígitos). Llama a onComplete al llegar a `length`. */
export function PinPad({
  length = 4,
  onComplete,
  disabled,
  error,
  resetKey,
}: {
  length?: number;
  onComplete: (pin: string) => void;
  disabled?: boolean;
  error?: string | null;
  /** Cambiarlo limpia el PIN escrito. */
  resetKey?: unknown;
}) {
  const [pin, setPin] = useState("");

  useEffect(() => setPin(""), [resetKey]);

  // Efecto fuera del updater: en modo estricto los updaters corren dos veces.
  const press = (d: string) => {
    if (disabled || pin.length >= length) return;
    const next = pin + d;
    setPin(next);
    if (next.length === length) setTimeout(() => onComplete(next), 80);
  };

  // Teclado físico (solo mientras el teclado está montado).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-3" aria-label={`${pin.length} de ${length} dígitos`} role="status">
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn("h-3.5 w-3.5 rounded-full border-2 transition-colors", i < pin.length ? "border-primary bg-primary" : "border-[#3A3F48]", error && "border-negative")}
          />
        ))}
      </div>
      {error && (
        <p className="-mt-2 text-sm font-semibold text-negative" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={disabled}>
            {d}
          </Key>
        ))}
        <span />
        <Key onClick={() => press("0")} disabled={disabled}>
          0
        </Key>
        <Key onClick={() => setPin((p) => p.slice(0, -1))} disabled={disabled} label="Borrar" quiet>
          <Delete className="h-6 w-6" />
        </Key>
      </div>
    </div>
  );
}

function Key({ children, onClick, disabled, label, quiet }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label?: string; quiet?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex h-[72px] w-[72px] items-center justify-center rounded-full text-2xl font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
        quiet ? "text-muted-foreground hover:text-foreground" : "border border-secondary bg-card hover:bg-secondary active:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
