import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerUser } from "@/lib/supabase/server";
import { GeminiError } from "@/lib/assistant/gemini";
import { extractStatement, type CategoryRef } from "@/lib/import/extract";
import { IMPORT_LIMITS, type ImportRequest } from "@/lib/import/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/);
const common = { account_type: z.string().max(20), today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) };
const BodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), chunks: z.array(z.string().min(1).max(IMPORT_LIMITS.chunkChars)).min(1).max(IMPORT_LIMITS.chunks), ...common }),
  z.object({ kind: z.literal("images"), images: z.array(base64.min(100).max(IMPORT_LIMITS.imageChars)).min(1).max(IMPORT_LIMITS.images), ...common }),
]);

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

/** Lee un estado de cuenta con la IA y devuelve los movimientos para revisar. No guarda nada. */
export async function POST(req: Request) {
  const deadline = Date.now() + 55_000;
  const { supabase, user } = await getServerUser();
  if (!user) return fail(401, "Tu sesión expiró. Vuelve a entrar.");

  const groqKey = process.env.GROQ_API_KEY?.trim() || undefined;
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || undefined;
  if (!groqKey && !geminiKey) return fail(503, "La lectura de estados de cuenta todavía no está disponible.");

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "No entendí el archivo. Intenta de nuevo.");
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return fail(400, "El archivo es muy grande o no es válido. Prueba con el PDF del banco.");
  const request = parsed.data as ImportRequest;

  // Comparte el cupo del asistente (40 por hora, 200 por día).
  const { data: allowed, error: quotaError } = await supabase.rpc("consume_assistant_quota");
  const quotaMissing = quotaError && (quotaError.code === "PGRST202" || quotaError.code === "42883");
  if (quotaError && !quotaMissing) return fail(503, "No está disponible en este momento. Intenta en un rato.");
  if (!quotaError && allowed === false) return fail(429, "Llegaste al límite de consultas por ahora. Intenta en un rato.");

  const { data: cats } = await supabase.from("categories").select("id, name, kind").order("sort");
  const categories = ((cats ?? []) as CategoryRef[]).filter((c) => c.kind === "income" || c.kind === "expense");

  try {
    const result = await extractStatement({ request, categories, groqKey, geminiKey, deadline, signal: req.signal });
    if (!result.rows.length) return fail(422, "No encontré movimientos en ese archivo. ¿Es un estado de cuenta? Prueba con el PDF que envía el banco.");
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof GeminiError) {
      // Solo diagnóstico del proveedor; nunca el contenido del estado.
      console.error("[importar] ia:", e.code, e.detail);
      return fail(e.status, e.message);
    }
    console.error("[importar] error interno");
    return fail(500, "Algo salió mal leyendo el archivo. Intenta de nuevo.");
  }
}
