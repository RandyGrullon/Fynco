import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/gmail/crypto";
import { revokeToken } from "@/lib/gmail/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quita el permiso en Google y borra la conexión. Lo ya registrado se queda. */
export async function POST() {
  const { supabase, user } = await getServerUser();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });
  const { data } = await supabase.from("gmail_connections").select("refresh_token_enc").eq("user_id", user.id).maybeSingle();
  if (data?.refresh_token_enc) {
    try {
      await revokeToken(decryptSecret(data.refresh_token_enc as string));
    } catch {
      // llave cambiada o token ilegible: igual se borra
    }
  }
  const { error } = await supabase.from("gmail_connections").delete().eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "No pude desconectar Gmail. Intenta de nuevo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
