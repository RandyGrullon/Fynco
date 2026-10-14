"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarRange, LogOut, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand";
import { getSupabase } from "@/lib/supabase/client";

const ITEMS = [
  { href: "/plan", label: "Plan", icon: CalendarRange },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/memoria", label: "Memoria", icon: BookOpen },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export async function salir() {
  await getSupabase().auth.signOut();
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="sin-teclado grid shrink-0 select-none grid-cols-3 items-start border-t border-border bg-nav px-2 pt-2.5 pb-safe md:hidden">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] flex-col items-center gap-1 rounded-md text-[11px] font-semibold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "font-bold text-primary",
            )}
          >
            <item.icon className="h-[22px] w-[22px]" strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 select-none flex-col overflow-y-auto border-r border-border bg-nav px-4 py-6 md:flex">
      <Link href="/plan" className="mb-8 flex items-center gap-2.5 px-2">
        <LogoMark size={36} />
        <span className="text-xl font-extrabold tracking-tight">Fynco</span>
      </Link>
      <nav aria-label="Principal" className="flex flex-col gap-1">
        {ITEMS.map((item) => {
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
      <button
        type="button"
        onClick={() => void salir()}
        className="mt-auto flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut className="h-5 w-5" /> Salir
      </button>
    </aside>
  );
}
