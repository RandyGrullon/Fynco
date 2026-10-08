"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, ChevronRight, FileText, LogOut, MessageCircle, Repeat, Settings, ShieldCheck, Target, Wallet, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { initials } from "@/components/visuals";
import { useUser } from "@/components/providers/session-provider";
import { useProfile } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

interface Item {
  href: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
}

const MAIN: Item[] = [
  { href: "/cuentas", label: "Cuentas", hint: "Saldos, tarjetas y efectivo", icon: Wallet },
  { href: "/metas", label: "Metas", hint: "Ahorra para lo que quieres", icon: Target },
  { href: "/recurrentes", label: "Recurrentes", hint: "Pagos y cobros fijos", icon: Repeat },
  { href: "/estadisticas", label: "Estadísticas", hint: "En qué se va tu dinero", icon: BarChart3 },
  { href: "/asistente", label: "Asistente", hint: "Pregunta o dicta un gasto", icon: MessageCircle },
  { href: "/ajustes", label: "Ajustes", hint: "Perfil, PIN y tus datos", icon: Settings },
];

const LEGAL: Item[] = [
  { href: "/legal/privacidad", label: "Privacidad", icon: ShieldCheck },
  { href: "/legal/terminos", label: "Términos", icon: FileText },
];

export default function MasPage() {
  const user = useUser();
  const { data: profile } = useProfile();
  const [signingOut, setSigningOut] = useState(false);

  const name = profile?.display_name || "";
  const email = profile?.email ?? user.email ?? "";

  async function signOut() {
    setSigningOut(true);
    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
      // SessionProvider redirige a /login al recibir SIGNED_OUT.
    } catch (e) {
      setSigningOut(false);
      toast({ variant: "destructive", title: "No se pudo cerrar la sesión", description: errorMessage(e) });
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader title="Más" />

      <Link
        href="/ajustes"
        className="flex items-center gap-3.5 rounded-2xl border border-secondary bg-card p-4 transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-extrabold text-primary-foreground">
          {profile ? initials(name || email || "?") : ""}
        </span>
        <span className="min-w-0 flex-1">
          {profile ? <span className="block truncate text-base font-bold">{name || "Tu perfil"}</span> : <Skeleton className="mb-1 h-5 w-32" />}
          <span className="block truncate text-sm text-muted-foreground">{email}</span>
        </span>
        <span className="sr-only">Ver ajustes del perfil</span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <nav aria-label="Secciones">
        <MenuList items={MAIN} />
      </nav>

      <nav aria-label="Legal">
        <MenuList items={LEGAL} />
      </nav>

      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-secondary bg-card px-4 text-left text-[15px] font-semibold text-negative transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-negative/10">
          <LogOut className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
        </span>
        {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>

      <p className="text-center text-xs text-muted-foreground">Fynco 2.0</p>
    </div>
  );
}

function MenuList({ items }: { items: Item[] }) {
  return (
    <ul className="divide-y divide-secondary overflow-hidden rounded-2xl border border-secondary bg-card">
      {items.map(({ href, label, hint, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{label}</span>
              {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
