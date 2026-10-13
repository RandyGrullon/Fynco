import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { syncGmail } from "@/lib/gmail/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Revisa Gmail y registra las alertas nuevas. `force` salta la espera de 10 minutos. */
export async function POST(req: Request) {
  const deadline = Date.now() + 52_000;
  const { supabase, user } = await getServerUser();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });

  let force = false;
  try {
    force = ((await req.json()) as { force?: unknown })?.force === true;
  } catch {
    // sin cuerpo: revisión normal
  }

  try {
    const summary = await syncGmail({ supabase, userId: user.id, force, deadline });
    return NextResponse.json(summary, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    // Solo el código del error; nunca el contenido de los correos.
    console.error("[gmail] sincronización falló:", (e as { code?: string }).code ?? (e as Error).name);
    return NextResponse.json({ error: "No pude revisar tu correo. Intenta de nuevo." }, { status: 500 });
  }
}
