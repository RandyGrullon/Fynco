import { NextResponse } from "next/server";
import { z } from "zod";
import { differenceInCalendarDays, format } from "date-fns";
import { getServerUser } from "@/lib/supabase/server";
import { parseDate } from "@/lib/dates";
import { GeminiError, runToolLoop, type GeminiContent, type GeminiPart } from "@/lib/assistant/gemini";
import { GROQ_DEFAULT_MODELS, runGroqToolLoop, transcribeWithGroq, type GroqMessage } from "@/lib/assistant/groq";
import { createToolbox, validDate } from "@/lib/assistant/tools";
import { systemPrompt } from "@/lib/assistant/prompt";
import { MAX_AUDIO_CHARS, MAX_HISTORY, MAX_TEXT, VOICE_PLACEHOLDER, type AssistantErrorBody, type AssistantResponse } from "@/lib/assistant/types";

export const runtime = "nodejs";

const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-2.5-flash"];

/** Gemini 3 usa thinkingLevel y temperatura 1.0 (recomendado); Gemini 2.5 usa thinkingBudget. */
function generationConfigFor(model: string): Record<string, unknown> {
  if (/^gemini-2\./.test(model)) {
    const env = Number(process.env.GEMINI_THINKING_BUDGET);
    const thinkingBudget = process.env.GEMINI_THINKING_BUDGET?.trim() && Number.isFinite(env) ? env : 0;
    return { temperature: 0.3, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget } };
  }
  const level = process.env.GEMINI_THINKING_LEVEL?.trim() || "low";
  return { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: level } };
}
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    messages: z
      .array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(MAX_TEXT) }))
      .min(1)
      .max(MAX_HISTORY),
    audio: z
      .object({
        mimeType: z.literal("audio/wav"),
        data: z
          .string()
          .min(64)
          .max(MAX_AUDIO_CHARS)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      })
      .optional(),
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((b) => Boolean(b.audio) || b.messages[b.messages.length - 1].role === "user", { message: "last_must_be_user" });

function fail(status: number, error: string) {
  return NextResponse.json<AssistantErrorBody>({ error }, { status, headers: { "cache-control": "no-store" } });
}

/** La fecha del cliente manda (zona horaria local), salvo que esté a más de un día del servidor. */
function resolveToday(clientToday: string) {
  const server = format(new Date(), "yyyy-MM-dd");
  const client = validDate(clientToday);
  if (!client) return server;
  return Math.abs(differenceInCalendarDays(parseDate(client), parseDate(server))) <= 1 ? client : server;
}

const TRANSCRIPT_RE = /<transcripci[oó]n>([\s\S]*?)<\/transcripci[oó]n>/i;

function splitTranscript(text: string): { reply: string; transcript?: string } {
  const m = text.match(TRANSCRIPT_RE);
  const transcript = m?.[1]?.trim().replace(/^["«“]|["»”]$/g, "").trim() || undefined;
  const reply = text
    .replace(TRANSCRIPT_RE, "")
    .replace(/<\/?transcripci[oó]n>/gi, "")
    .trim();
  return { reply, transcript };
}

export async function POST(req: Request) {
  const deadline = Date.now() + 27_000;

  const { supabase, user } = await getServerUser();
  if (!user) return fail(401, "Tu sesión expiró. Vuelve a entrar.");

  // Proveedor: Groq si hay llave (rápido, con Whisper para la voz); si no, Gemini.
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!groqKey && !apiKey) return fail(503, "El asistente todavía no está disponible. Intenta más tarde.");

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "No entendí la solicitud. Intenta de nuevo.");
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return fail(400, "El mensaje no es válido. Revisa que no sea muy largo e intenta de nuevo.");
  const body = parsed.data;
  const today = resolveToday(body.today);

  // Límite por usuario (40/hora, 200/día). Si el RPC no existe aún, no bloqueamos.
  const { data: allowed, error: quotaError } = await supabase.rpc("consume_assistant_quota");
  const quotaMissing = quotaError && (quotaError.code === "PGRST202" || quotaError.code === "42883");
  if (quotaError && !quotaMissing) return fail(503, "El asistente no está disponible en este momento. Intenta en un rato.");
  if (!quotaError && allowed === false) return fail(429, "Llegaste al límite de consultas por ahora. Intenta en un rato.");

  try {
    const { data: profile } = await supabase.from("profiles").select("display_name, default_currency").eq("id", user.id).maybeSingle();
    const currency = (profile?.default_currency as string | undefined)?.trim() || "DOP";
    const name = ((profile?.display_name as string | undefined) ?? "").trim().split(/\s+/)[0] ?? "";

    const toolbox = createToolbox({ supabase, userId: user.id, today, currency });
    let context = "";
    try {
      context = await toolbox.contextSummary();
    } catch {
      context = "(No se pudo cargar el contexto; usa las herramientas.)";
    }

    // Voz con Groq: Whisper transcribe y el modelo actúa sobre el texto.
    let groqTranscript: string | undefined;
    let useGroq = Boolean(groqKey);
    if (groqKey && body.audio) {
      try {
        groqTranscript = await transcribeWithGroq(groqKey, body.audio.data, req.signal);
      } catch (e) {
        if (!apiKey) throw e;
        useGroq = false; // Gemini escucha el audio directamente.
      }
      if (useGroq && !groqTranscript) return fail(400, "No te entendí en la nota de voz. Intenta de nuevo, más cerca del micrófono.");
    }

    if (useGroq && groqKey) {
      const transcript = groqTranscript;
      try {
        const history: GroqMessage[] = [];
        for (const m of body.messages) {
          const text = m.text.trim();
          if (!text || text === VOICE_PLACEHOLDER) continue;
          const role = m.role === "model" ? "assistant" : "user";
          const last = history[history.length - 1];
          if (last && last.role === role) last.content = `${last.content}\n\n${text}`;
          else history.push({ role, content: text } as GroqMessage);
        }
        if (transcript) history.push({ role: "user", content: `(Nota de voz) ${transcript}` });
        while (history.length && history[0].role === "assistant") history.shift();
        if (!history.length || history[history.length - 1].role !== "user") return fail(400, "Escribe un mensaje para empezar.");

        const groqModels = [...new Set([process.env.GROQ_MODEL?.trim(), ...GROQ_DEFAULT_MODELS].filter((m): m is string => Boolean(m)))];
        const result = await runGroqToolLoop({
          apiKey: groqKey,
          models: groqModels,
          messages: [{ role: "system", content: systemPrompt({ today, currency, name, context, hasAudio: false }) }, ...history],
          tools: toolbox.declarations,
          executeTool: toolbox.execute,
          maxRounds: 5,
          deadline,
          callTimeoutMs: 20_000,
          signal: req.signal,
        });
        const drafts = toolbox.drafts;
        const reply =
          result.text ||
          (drafts.length ? "Te dejé el borrador abajo. Revísalo y toca Confirmar para guardarlo." : "No supe qué responder. ¿Me lo dices de otra forma?");
        const response: AssistantResponse = { reply, drafts, ...(transcript ? { transcript } : {}) };
        return NextResponse.json(response, { headers: { "cache-control": "no-store" } });
      } catch (e) {
        // Groq sin cupo o caído: si hay Gemini, se responde con Gemini.
        const fallback = e instanceof GeminiError && ["rate_limited", "unavailable", "timeout", "network", "model_unavailable", "empty"].includes(e.code);
        if (!apiKey || !fallback) throw e;
        console.error("[asistente] groq→gemini:", e.code, e.detail);
        toolbox.drafts.length = 0;
      }
    }

    // ---------- Gemini ----------
    // Historial → contents (alternando roles, empezando por el usuario).
    const contents: GeminiContent[] = [];
    for (const m of body.messages) {
      const text = m.text.trim();
      if (!text) continue;
      const last = contents[contents.length - 1];
      if (last && last.role === m.role) last.parts[0].text = `${last.parts[0].text}\n\n${text}`;
      else contents.push({ role: m.role, parts: [{ text }] });
    }
    while (contents.length && contents[0].role === "model") contents.shift();

    // Si Whisper ya transcribió la nota, Gemini recibe el texto.
    const sendAudio = Boolean(body.audio) && !groqTranscript;
    if (groqTranscript) {
      const last = contents[contents.length - 1];
      const voiceText = `(Nota de voz) ${groqTranscript}`;
      if (last?.role === "user") {
        const kept = (last.parts[0].text ?? "")
          .split("\n\n")
          .filter((t) => t.trim() !== VOICE_PLACEHOLDER)
          .join("\n\n")
          .trim();
        last.parts = [{ text: kept ? `${kept}\n\n${voiceText}` : voiceText }];
      } else {
        contents.push({ role: "user", parts: [{ text: voiceText }] });
      }
    } else if (body.audio) {
      const audioParts: GeminiPart[] = [
        { inlineData: { mimeType: "audio/wav", data: body.audio.data } },
        { text: "Esta es mi nota de voz." },
      ];
      const last = contents[contents.length - 1];
      if (last?.role === "user") {
        const kept = (last.parts[0].text ?? "")
          .split("\n\n")
          .filter((t) => t.trim() !== VOICE_PLACEHOLDER)
          .join("\n\n")
          .trim();
        last.parts = kept ? [{ text: kept }, ...audioParts] : audioParts;
      } else {
        contents.push({ role: "user", parts: audioParts });
      }
    }
    if (!contents.length || contents[contents.length - 1].role !== "user") return fail(400, "Escribe un mensaje para empezar.");

    // Google limitó los Gemini 2.5 a cuentas que ya los usaban (sep 2026): 3.x primero, con respaldos.
    const models = [...new Set([process.env.GEMINI_MODEL?.trim(), ...DEFAULT_MODELS].filter((m): m is string => Boolean(m)))];

    const result = await runToolLoop({
      apiKey: apiKey!,
      models,
      systemInstruction: systemPrompt({ today, currency, name, context, hasAudio: sendAudio }),
      contents,
      tools: toolbox.declarations,
      executeTool: toolbox.execute,
      maxRounds: 5,
      deadline,
      callTimeoutMs: 25_000,
      signal: req.signal,
      generationConfig: generationConfigFor,
    });

    const { reply: text, transcript } = splitTranscript(result.text);
    const drafts = toolbox.drafts;
    const reply =
      text ||
      (drafts.length
        ? "Te dejé el borrador abajo. Revísalo y toca Confirmar para guardarlo."
        : "No supe qué responder. ¿Me lo dices de otra forma?");

    const finalTranscript = groqTranscript ?? (sendAudio ? transcript : undefined);
    const response: AssistantResponse = { reply, drafts, ...(finalTranscript ? { transcript: finalTranscript } : {}) };
    return NextResponse.json(response, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof GeminiError) {
      // Solo diagnóstico del proveedor (estado, motivo, modelo); nunca el contenido del usuario.
      console.error("[asistente] ia:", e.code, e.detail);
      return fail(e.status, e.message);
    }
    console.error("[asistente] error interno");
    return fail(500, "Algo salió mal. Intenta de nuevo.");
  }
}
