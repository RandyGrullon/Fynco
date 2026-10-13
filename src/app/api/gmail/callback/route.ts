import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/gmail/crypto";
import { GMAIL_SCOPE, exchangeCode, getProfileEmail, gmailConfig, revokeToken } from "@/lib/gmail/google";
import { GMAIL_STATE_COOKIE } from "@/lib/gmail/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameState(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Google vuelve aquí con el código: se cambia por un token y se guarda cifrado. */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const back = (result: string) => {
    const res = NextResponse.redirect(new URL(`/ajustes?gmail=${result}`, origin));
    res.cookies.set(GMAIL_STATE_COOKIE, "", { path: "/api/gmail", maxAge: 0 });
    return res;
  };

  if (searchParams.get("error")) return back("cancelado");
  if (!sameState(searchParams.get("state"), req.cookies.get(GMAIL_STATE_COOKIE)?.value)) return back("error");
  const code = searchParams.get("code");
  if (!code) return back("error");

  const { supabase, user } = await getServerUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/ajustes", origin));
  const cfg = gmailConfig();
  if (!cfg) return back("sin-configurar");

  try {
    const tokens = await exchangeCode(cfg, code, `${origin}/api/gmail/callback`);
    if (!tokens.scope.split(" ").includes(GMAIL_SCOPE)) return back("sin-permiso");
    if (!tokens.refreshToken) return back("error");
    const googleEmail = await getProfileEmail(tokens.accessToken);
    const refresh_token_enc = encryptSecret(tokens.refreshToken);

    const { data: existing } = await supabase.from("gmail_connections").select("refresh_token_enc").eq("user_id", user.id).maybeSingle();
    const now = new Date().toISOString();
    // Al reconectar se conserva desde cuándo se importa, para no duplicar ni perder correos.
    const { error } = existing
      ? await supabase.from("gmail_connections").update({ google_email: googleEmail, refresh_token_enc, last_error: null, updated_at: now }).eq("user_id", user.id)
      : await supabase.from("gmail_connections").insert({ user_id: user.id, google_email: googleEmail, refresh_token_enc });
    if (error) {
      await revokeToken(tokens.refreshToken);
      console.error("[gmail] no se pudo guardar la conexión:", error.code);
      return back("error");
    }
    return back("conectado");
  } catch {
    console.error("[gmail] falló el intercambio del código");
    return back("error");
  }
}
