import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { buildAuthUrl, gmailConfig } from "@/lib/gmail/google";
import { GMAIL_STATE_COOKIE } from "@/lib/gmail/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manda a Google a pedir permiso de solo lectura sobre Gmail. */
export async function GET(req: NextRequest) {
  const { origin } = req.nextUrl;
  const { user } = await getServerUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/ajustes", origin));
  const cfg = gmailConfig();
  if (!cfg) return NextResponse.redirect(new URL("/ajustes?gmail=sin-configurar", origin));

  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(
    buildAuthUrl({ clientId: cfg.clientId, redirectUri: `${origin}/api/gmail/callback`, state, loginHint: user.email ?? undefined }),
  );
  res.cookies.set(GMAIL_STATE_COOKIE, state, { httpOnly: true, secure: origin.startsWith("https://"), sameSite: "lax", path: "/api/gmail", maxAge: 600 });
  return res;
}
