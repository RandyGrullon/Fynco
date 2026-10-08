"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Encabezado de pantalla: atrás opcional, título y acciones a la derecha. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
  center,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: string;
  actions?: React.ReactNode;
  className?: string;
  /** Título centrado (pantallas de detalle) */
  center?: boolean;
}) {
  return (
    <header className={cn("flex items-center gap-3 pb-2 pt-4 md:pt-8", className)}>
      {back && (
        <Link
          href={back}
          aria-label="Volver"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-secondary bg-card transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      )}
      <div className={cn("min-w-0 flex-1", center && "text-center")}>
        <h1 className={cn("truncate font-extrabold tracking-tight", center ? "text-base" : "text-2xl md:text-3xl")}>{title}</h1>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : back && center ? <span className="w-11" /> : null}
    </header>
  );
}

/** Título de sección con enlace opcional a la derecha. */
export function SectionTitle({ children, href, action, className }: { children: React.ReactNode; href?: string; action?: string; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-[15px] font-bold">{children}</h2>
      {href && action && (
        <Link href={href} className="text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {action}
        </Link>
      )}
    </div>
  );
}

/** Estado vacío con llamado a la acción. */
export function EmptyState({ icon: Icon, title, children, action }: { icon?: React.ComponentType<{ className?: string }>; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-secondary px-6 py-10 text-center">
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-card text-primary">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <div>
        <p className="font-bold">{title}</p>
        {children && <p className="mt-1 text-sm text-muted-foreground">{children}</p>}
      </div>
      {action}
    </div>
  );
}
