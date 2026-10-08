import { cn } from "@/lib/utils";

/**
 * Logo de Fynco: una "F" cuyo brazo medio se separa en una moneda
 * (dinero que se comparte). Mismo dibujo que public/logo.svg.
 */
export function LogoMark({ size = 36, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={cn("shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect width="512" height="512" rx="116" fill="#171A1F" />
      <rect x="0.75" y="0.75" width="510.5" height="510.5" rx="115.5" fill="none" stroke="#262A31" strokeWidth="6" />
      <g fill="#C8F05A">
        <rect x="148" y="104" width="76" height="304" rx="38" />
        <rect x="148" y="104" width="224" height="76" rx="38" />
        <rect x="148" y="222" width="122" height="68" rx="34" />
        <circle cx="326" cy="256" r="34" />
      </g>
    </svg>
  );
}

/** Marca + nombre. */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="text-xl font-extrabold tracking-tight">Fynco</span>
    </span>
  );
}
