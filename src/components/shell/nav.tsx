"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Grid2x2,
  Home,
  List,
  MessageCircle,
  Plus,
  Repeat,
  Settings,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { useSheets } from "./sheets";
import { cn } from "@/lib/utils";

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

const MORE_PATHS = ["/mas", "/cuentas", "/metas", "/recurrentes", "/estadisticas", "/ajustes", "/asistente", "/legal"];

export function BottomNav() {
  const pathname = usePathname();
  const sheets = useSheets();
  const items = [
    { href: "/inicio", label: "Inicio", icon: Home },
    { href: "/movimientos", label: "Movimientos", icon: List },
    null,
    { href: "/compartido", label: "Compartido", icon: Users },
    { href: "/mas", label: "Más", icon: Grid2x2, active: MORE_PATHS.some((p) => isActive(pathname, p)) },
  ];

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-start border-t border-border bg-nav/95 px-2 pt-2.5 backdrop-blur pb-safe md:hidden"
    >
      {items.map((item) =>
        item === null ? (
          <div key="add" className="flex justify-center">
            <button
              type="button"
              onClick={() => sheets.open({ type: "quick" })}
              aria-label="Añadir movimiento"
              className="-mt-7 flex h-[60px] w-[60px] items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-[0_6px_20px_rgb(var(--primary)/0.25)] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Plus className="h-[26px] w-[26px]" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            aria-current={(item.active ?? isActive(pathname, item.href)) ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] flex-col items-center gap-1 rounded-md text-[11px] font-semibold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              (item.active ?? isActive(pathname, item.href)) && "font-bold text-primary",
            )}
          >
            <item.icon className="h-[22px] w-[22px]" strokeWidth={2} />
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

const SIDE_ITEMS = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/movimientos", label: "Movimientos", icon: List },
  { href: "/compartido", label: "Compartido", icon: Users },
  { href: "/cuentas", label: "Cuentas", icon: Wallet },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/recurrentes", label: "Recurrentes", icon: Repeat },
  { href: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/asistente", label: "Asistente", icon: MessageCircle },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function SideNav() {
  const pathname = usePathname();
  const sheets = useSheets();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-nav px-4 py-6 md:flex">
      <Link href="/inicio" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-[15px] font-extrabold text-primary-foreground">F</span>
        <span className="text-xl font-extrabold tracking-tight">Fynco</span>
      </Link>
      <button
        type="button"
        onClick={() => sheets.open({ type: "quick" })}
        className="mb-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} /> Añadir
      </button>
      <nav aria-label="Principal" className="flex flex-col gap-1">
        {SIDE_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "bg-card text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "text-primary")} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
