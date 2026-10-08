import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LogoMark } from "@/components/brand";

export const metadata = { title: "Configurar" };

// Se muestra solo si faltan las variables de entorno de Supabase.
export default function ConfigurarPage() {
  if (isSupabaseConfigured) redirect("/inicio");
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <LogoMark size={48} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Falta conectar Supabase</h1>
        <p className="mt-2 text-muted-foreground">Agrega estas variables de entorno (en Vercel → Settings → Environment Variables, o en <code>.env.local</code>) y vuelve a desplegar.</p>
      </div>
      <pre className="overflow-x-auto rounded-xl border border-secondary bg-card p-4 text-sm leading-relaxed">
        {`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
GEMINI_API_KEY=...                     # para el asistente`}
      </pre>
      <p className="text-sm text-muted-foreground">
        La primera vez, ejecuta <code>supabase/migrations/20261008000001_init.sql</code> en Supabase → SQL Editor.
      </p>
    </main>
  );
}
