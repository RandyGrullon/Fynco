import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/app/(auth)/_components/auth-helpers";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Destino de los enlaces de Supabase: OAuth (Google), confirmación de correo y recuperación.
 * - ?code=…               → PKCE: exchangeCodeForSession
 * - ?token_hash=…&type=…  → plantillas de correo con token: verifyOtp
 * La sesión queda en cookies (createSupabaseServer) y se redirige a `next` (solo rutas internas).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const type = OTP_TYPES.find((t) => t === rawType) ?? null;
  const next = safeNext(searchParams.get("next")) ?? (type === "recovery" ? "/nueva-contrasena" : "/inicio");

  // El proveedor devolvió un error (p. ej. cancelaste el acceso con Google).
  if (!code && !tokenHash && searchParams.get("error")) {
    return NextResponse.redirect(new URL("/login?error=acceso", origin));
  }

  let ok = false;
  try {
    const supabase = await createSupabaseServer();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      ok = !error;
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      ok = !error;
    }
  } catch {
    ok = false;
  }

  return NextResponse.redirect(new URL(ok ? next : "/login?error=enlace", origin));
}
