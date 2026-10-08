"use client";

import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Bloque de ajustes: título y una tarjeta con filas separadas. */
export function SettingsSection({ title, description, danger, children }: { title: string; description?: React.ReactNode; danger?: boolean; children: React.ReactNode }) {
  const id = useId();
  return (
    <section className="flex flex-col gap-2" aria-labelledby={id}>
      <div className="px-1">
        <h2 id={id} className={cn("text-[15px] font-bold", danger && "text-negative")}>
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("divide-y divide-secondary overflow-hidden rounded-2xl border bg-card", danger ? "border-negative/40" : "border-secondary")}>{children}</div>
    </section>
  );
}

/** Fila con título, descripción opcional y control a la derecha (o debajo con `stack`). */
export function SettingsRow({
  title,
  description,
  htmlFor,
  descriptionId,
  stack,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  descriptionId?: string;
  /** Controles en una segunda línea (útil con varios botones en móvil). */
  stack?: boolean;
  children?: React.ReactNode;
}) {
  const Title = htmlFor ? "label" : "p";
  return (
    <div className={cn("flex min-h-16 gap-3 px-4 py-3.5", stack ? "flex-col" : "items-center")}>
      <div className="min-w-0 flex-1">
        <Title htmlFor={htmlFor} className="block text-[15px] font-semibold">
          {title}
        </Title>
        {description && (
          <p id={descriptionId} className="mt-0.5 text-[13px] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && <div className={cn("flex shrink-0 flex-wrap items-center gap-2", stack && "w-full")}>{children}</div>}
    </div>
  );
}

/** Fila con interruptor; toda la etiqueta es clicable. */
export function SwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  title: string;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <SettingsRow title={title} description={description} htmlFor={id} descriptionId={description ? descId : undefined}>
      {/* Área táctil de 44px alrededor del interruptor */}
      <span className="flex h-11 items-center">
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-describedby={description ? descId : undefined} />
      </span>
    </SettingsRow>
  );
}
