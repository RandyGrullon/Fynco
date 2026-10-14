import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerUser } from "@/lib/supabase/server";
import { GROQ_DEFAULT_MODELS, runGroqToolLoop, transcribeWithGroq, type GroqMessage } from "@/lib/assistant/groq";
import { IAError } from "@/lib/assistant/ia";
import { MAX_AUDIO_CHARS } from "@/lib/assistant/types";
import { crearHerramientas } from "@/lib/finanzas/herramientas";
import { hoyRD } from "@/lib/finanzas/motor";
import { promptSistema, type Nota } from "@/lib/finanzas/prompt";
import type { Estado } from "@/lib/finanzas/tipos";
import type { MensajeChat, RespuestaChat } from "@/lib/finanzas/chat";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const HISTORIAL = 10; // mensajes anteriores que ve el modelo

const Cuerpo = z
  .object({
    texto: z.string().max(4000).optional(),
    audio: z
      .object({ mimeType: z.literal("audio/wav"), data: z.string().min(64).max(MAX_AUDIO_CHARS).regex(/^[A-Za-z0-9+/]+={0,2}$/) })
      .optional(),
  })
  .refine((b) => Boolean(b.audio) || Boolean(b.texto?.trim()), { message: "vacio" });

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });
const corta = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Fragmento del texto alrededor de la primera palabra encontrada. */
function fragmento(texto: string, consulta: string, largo = 700) {
  const palabras = consulta.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const t = texto.toLowerCase();
  const i = Math.max(0, ...palabras.map((w) => t.indexOf(w)).filter((x) => x >= 0).slice(0, 1));
  const desde = Math.max(0, i - 200);
  return `${desde > 0 ? "…" : ""}${texto.slice(desde, desde + largo)}${desde + largo < texto.length ? "…" : ""}`;
}

function fuentes(supabase: SupabaseClient, userId: string) {
  return {
    async buscar(consulta: string) {
      const like = `%${consulta.replace(/[%_\\]/g, " ").trim()}%`;
      const [archivo, notas, chat] = await Promise.all([
        supabase.rpc("pf_buscar_archivo", { p_consulta: consulta, p_limite: 6 }),
        supabase.from("pf_memoria").select("id, tema, texto").eq("archivada", false).or(`tema.ilike.${like},texto.ilike.${like}`).limit(6),
        supabase.from("pf_chat").select("rol, texto, creado").ilike("texto", like).order("id", { ascending: false }).limit(6),
      ]);
      return {
        conversacion_con_claude: ((archivo.data ?? []) as { fuente: string; n: number; quien: string; fecha: string | null; texto: string }[]).map(
          (r) => `[${r.fuente} #${r.n} · ${r.quien} · ${r.fecha ?? ""}] ${fragmento(r.texto, consulta)}`,
        ),
        notas: ((notas.data ?? []) as { id: string; tema: string; texto: string }[]).map((n) => `[${n.id} · ${n.tema}] ${n.texto}`),
        este_chat: ((chat.data ?? []) as { rol: string; texto: string; creado: string }[]).map((m) => `[${m.creado.slice(0, 10)} · ${m.rol}] ${fragmento(m.texto, consulta, 400)}`),
      };
    },
    async leerConversacion(desde: number, hasta: number) {
      const { data } = await supabase
        .from("pf_archivo")
        .select("n, quien, fecha, texto")
        .eq("fuente", "claude-2026-10")
        .gte("n", desde)
        .lte("n", hasta)
        .order("n");
      return ((data ?? []) as { n: number; quien: string; fecha: string | null; texto: string }[]).map((r) => `#${r.n} ${r.quien} (${r.fecha ?? ""}): ${corta(r.texto, 3500)}`);
    },
    async leerNotas(tema?: string) {
      let q = supabase.from("pf_memoria").select("id, tema, texto").eq("archivada", false).order("tema");
      if (tema) q = q.ilike("tema", `%${tema}%`);
      const { data } = await q.limit(60);
      return ((data ?? []) as { id: string; tema: string; texto: string }[]).map((n) => `[${n.id} · ${n.tema}] ${n.texto}`);
    },
    async guardarNota(n: { id?: string; tema: string; texto: string; archivar?: boolean }) {
      if (n.id) {
        const { error } = await supabase
          .from("pf_memoria")
          .update({ tema: n.tema, texto: n.texto, archivada: Boolean(n.archivar), actualizado: new Date().toISOString() })
          .eq("id", n.id)
          .eq("user_id", userId);
        return error ? { error: "No pude guardar la nota" } : { ok: true, id: n.id };
      }
      const { data, error } = await supabase.from("pf_memoria").insert({ tema: n.tema, texto: n.texto, origen: "chat" }).select("id").single();
      return error ? { error: "No pude guardar la nota" } : { ok: true, id: (data as { id: string }).id };
    },
  };
}

export async function POST(req: Request) {
  const deadline = Date.now() + 52_000;
  const { supabase, user } = await getServerUser();
  if (!user) return fail(401, "Tu sesión expiró. Vuelve a entrar.");

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!groqKey) return fail(503, "Falta configurar la llave de Groq en Vercel (GROQ_API_KEY).");

  let cuerpo: z.infer<typeof Cuerpo>;
  try {
    const p = Cuerpo.safeParse(await req.json());
    if (!p.success) return fail(400, "El mensaje no es válido. Revisa que no sea muy largo.");
    cuerpo = p.data;
  } catch {
    return fail(400, "No entendí la solicitud. Intenta de nuevo.");
  }

  const { data: permitido, error: errCupo } = await supabase.rpc("consume_assistant_quota");
  if (!errCupo && permitido === false) return fail(429, "Llegaste al límite de mensajes por ahora (40 por hora). Intenta en un rato.");

  // Nota de voz → texto
  let transcripcion: string | undefined;
  if (cuerpo.audio) {
    try {
      transcripcion = await transcribeWithGroq(groqKey, cuerpo.audio.data, req.signal);
    } catch (e) {
      return fail(e instanceof IAError ? e.status : 502, e instanceof IAError ? e.message : "No pude transcribir la nota de voz.");
    }
    if (!transcripcion) return fail(400, "No te entendí en la nota de voz. Intenta de nuevo, más cerca del micrófono.");
  }
  const textoUsuario = [cuerpo.texto?.trim(), transcripcion ? `(Nota de voz) ${transcripcion}` : ""].filter(Boolean).join("\n\n");

  // Todo se guarda: primero el mensaje de Randy, pase lo que pase después.
  const { data: filaUsuario, error: errUsuario } = await supabase.from("pf_chat").insert({ rol: "user", texto: textoUsuario }).select("*").single();
  if (errUsuario) return fail(500, "No pude guardar tu mensaje. Intenta de nuevo.");

  const [{ data: filaEstado }, { data: filasNotas }, { data: filasChat }, { data: perfil }] = await Promise.all([
    supabase.from("pf_estado").select("datos, version").maybeSingle(),
    supabase.from("pf_memoria").select("id, tema, texto, actualizado").eq("archivada", false),
    supabase.from("pf_chat").select("id, rol, texto").lt("id", (filaUsuario as MensajeChat).id).order("id", { ascending: false }).limit(HISTORIAL),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!filaEstado) return fail(409, "Todavía no tienes un plan guardado.");

  const hoy = hoyRD();
  const estadoInicial = filaEstado.datos as Estado;
  const version = filaEstado.version as number;
  const nombre = ((perfil?.display_name as string | undefined) ?? "").trim().split(/\s+/)[0] || "Randy";
  const tools = crearHerramientas(estadoInicial, hoy, fuentes(supabase, user.id));
  const sistema = promptSistema({ hoy, nombre, estado: estadoInicial, notas: (filasNotas ?? []) as Nota[], resumen: tools.resumen() });

  const historial = ((filasChat ?? []) as { rol: string; texto: string }[]).reverse().map((m) => ({ rol: m.rol, texto: corta(m.texto, 700) }));
  historial.push({ rol: "user", texto: textoUsuario });

  let respuesta = "";
  let errorIA: IAError | null = null;
  try {
    const msgs: GroqMessage[] = [{ role: "system", content: sistema }];
    for (const m of historial) {
      const role = m.rol === "assistant" ? "assistant" : "user";
      const last = msgs[msgs.length - 1];
      if (last.role === role) last.content = `${last.content}\n\n${m.texto}`;
      else msgs.push({ role, content: m.texto } as GroqMessage);
    }
    while (msgs[1]?.role === "assistant") msgs.splice(1, 1);
    const modelos = [...new Set([process.env.GROQ_MODEL?.trim(), ...GROQ_DEFAULT_MODELS].filter((m): m is string => Boolean(m)))];
    const r = await runGroqToolLoop({ apiKey: groqKey, models: modelos, messages: msgs, tools: tools.declaraciones, executeTool: tools.ejecutar, maxRounds: 6, deadline, callTimeoutMs: 25_000, signal: req.signal });
    respuesta = r.text;
  } catch (e) {
    if (!(e instanceof IAError)) {
      console.error("[chat] error interno");
      errorIA = new IAError(500, "internal", "Algo salió mal. Intenta de nuevo.");
    } else {
      console.error("[chat] ia:", e.code, e.detail);
      errorIA = e;
    }
  }

  // Guardar el plan si cambió (aunque la IA no haya terminado de responder).
  let cambiosGuardados: MensajeChat["cambios"] = null;
  let avisoGuardado = "";
  if (tools.cambios.length) {
    const motivo = tools.cambios.length > 1 ? `${corta(tools.cambios[0], 160)} y ${tools.cambios.length - 1} más` : corta(tools.cambios[0], 200);
    const { data: nueva, error } = await supabase.rpc("pf_guardar_estado", { p_datos: tools.estado, p_version_esperada: version, p_motivo: motivo, p_origen: "chat", p_cambios: tools.cambios });
    if (error) {
      avisoGuardado = error.message.includes("version_conflict")
        ? "\n\nOjo: no guardé estos cambios porque el plan cambió desde otro lado mientras te respondía. Repíteme el mensaje."
        : "\n\nOjo: no pude guardar estos cambios en el plan. Repíteme el mensaje.";
    } else {
      cambiosGuardados = { version_antes: version, version_despues: nueva as number, resumen: tools.cambios };
    }
  }

  if (errorIA && !cambiosGuardados) {
    const texto = `No pude responder: ${errorIA.message}`;
    const { data: fila } = await supabase.from("pf_chat").insert({ rol: "assistant", texto }).select("*").single();
    return NextResponse.json<RespuestaChat>({ usuario: filaUsuario as MensajeChat, asistente: (fila as MensajeChat) ?? null, transcripcion, error: errorIA.message }, { status: errorIA.status, headers: { "cache-control": "no-store" } });
  }

  if (!respuesta) respuesta = cambiosGuardados ? `Listo, guardé esto:\n${tools.cambios.map((c) => `- ${c}`).join("\n")}` : "No supe qué responder. ¿Me lo dices de otra forma?";
  const { data: filaAsistente } = await supabase
    .from("pf_chat")
    .insert({ rol: "assistant", texto: corta(respuesta + avisoGuardado, 19_000), cambios: cambiosGuardados })
    .select("*")
    .single();

  return NextResponse.json<RespuestaChat>(
    { usuario: filaUsuario as MensajeChat, asistente: (filaAsistente as MensajeChat) ?? null, transcripcion },
    { headers: { "cache-control": "no-store" } },
  );
}
