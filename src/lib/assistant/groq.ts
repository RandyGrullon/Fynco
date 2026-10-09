// Cliente de Groq (API compatible con OpenAI): bucle de herramientas y transcripción con Whisper.
// Solo servidor. Nunca registra el contenido del usuario ni la llave.
import { GEMINI_MESSAGES, GeminiError, type FunctionDeclaration, type GeminiSchema } from "./gemini";

const BASE = "https://api.groq.com/openai/v1";
export const GROQ_DEFAULT_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
export const GROQ_TRANSCRIBE_MODEL = "whisper-large-v3-turbo";

type JsonSchema = { type: string; description?: string; enum?: string[]; properties?: Record<string, JsonSchema>; required?: string[]; items?: JsonSchema };

/** Las herramientas están escritas en el formato de Gemini; Groq usa JSON Schema. */
function toJsonSchema(s: GeminiSchema): JsonSchema {
  return {
    type: s.type.toLowerCase(),
    ...(s.description ? { description: s.description } : {}),
    ...(s.enum ? { enum: s.enum } : {}),
    ...(s.properties ? { properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toJsonSchema(v)])) } : {}),
    ...(s.required ? { required: s.required } : {}),
    ...(s.items ? { items: toJsonSchema(s.items) } : {}),
  };
}

function toTools(decls: FunctionDeclaration[]) {
  return decls.map((d) => ({
    type: "function" as const,
    function: { name: d.name, description: d.description, parameters: d.parameters ? toJsonSchema(d.parameters) : { type: "object", properties: {} } },
  }));
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type GroqMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

function mapHttpError(status: number, body: string, model: string): GeminiError {
  let detail = `provider=groq http=${status} model=${model}`;
  let code = "";
  let message = "";
  try {
    const err = JSON.parse(body) as { error?: { message?: string; code?: string; type?: string } };
    code = err.error?.code ?? err.error?.type ?? "";
    message = err.error?.message ?? "";
    detail += ` code=${code} msg="${message.slice(0, 160)}"`;
  } catch {
    // cuerpo no JSON
  }
  if (status === 429) return new GeminiError(429, "rate_limited", GEMINI_MESSAGES.rateLimited, detail);
  if (status === 401 || status === 403) return new GeminiError(503, "misconfigured", GEMINI_MESSAGES.misconfigured, detail);
  if (status === 404 || code === "model_not_found" || /model .*(does not exist|not found|decommissioned)/i.test(message)) {
    return new GeminiError(503, "model_unavailable", GEMINI_MESSAGES.misconfigured, detail);
  }
  if (status === 400 || status === 413 || status === 422) return new GeminiError(400, "bad_request", GEMINI_MESSAGES.badRequest, detail);
  return new GeminiError(503, "unavailable", GEMINI_MESSAGES.unavailable, detail);
}

async function post(path: string, apiKey: string, init: { body: BodyInit; json?: boolean }, timeoutMs: number, signal: AbortSignal | undefined, model: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs));
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, ...(init.json ? { "content-type": "application/json" } : {}) },
      body: init.body,
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw mapHttpError(res.status, text, model);
    return JSON.parse(text) as unknown;
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    if (ctrl.signal.aborted) throw new GeminiError(504, "timeout", GEMINI_MESSAGES.timeout, `provider=groq model=${model}`);
    throw new GeminiError(502, "network", GEMINI_MESSAGES.network, `provider=groq model=${model}`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Nota de voz (WAV en base64) → texto, con Whisper en Groq. */
export async function transcribeWithGroq(apiKey: string, wavBase64: string, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(wavBase64, "base64")], { type: "audio/wav" }), "nota.wav");
  form.append("model", GROQ_TRANSCRIBE_MODEL);
  form.append("language", "es");
  form.append("response_format", "json");
  form.append("temperature", "0");
  const res = (await post("/audio/transcriptions", apiKey, { body: form }, 20_000, signal, GROQ_TRANSCRIBE_MODEL)) as { text?: string };
  return (res.text ?? "").trim();
}

export interface GroqLoopOptions {
  apiKey: string;
  models: string[];
  messages: GroqMessage[];
  tools: FunctionDeclaration[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  maxRounds?: number;
  deadline?: number;
  callTimeoutMs?: number;
  signal?: AbortSignal;
}

const MAX_CALLS_PER_ROUND = 6;

/** Bucle de function calling al estilo OpenAI. */
export async function runGroqToolLoop(opts: GroqLoopOptions): Promise<{ text: string; model: string; toolCalls: number }> {
  const maxRounds = Math.max(1, opts.maxRounds ?? 5);
  const deadline = opts.deadline ?? Date.now() + 27_000;
  const messages = [...opts.messages];
  const tools = toTools(opts.tools);
  let modelIndex = 0;
  let toolCalls = 0;

  for (let round = 1; round <= maxRounds; round++) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) throw new GeminiError(504, "timeout", GEMINI_MESSAGES.timeout, "provider=groq");
    const forceText = round === maxRounds || remaining < 5000;
    const model = opts.models[modelIndex];

    let res: { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] }; finish_reason?: string }[] };
    try {
      res = (await post(
        "/chat/completions",
        opts.apiKey,
        {
          json: true,
          body: JSON.stringify({
            model,
            messages,
            tools,
            tool_choice: forceText ? "none" : "auto",
            max_completion_tokens: 2048,
            // gpt-oss razona; con esfuerzo bajo responde rápido.
            ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
          }),
        },
        Math.min(opts.callTimeoutMs ?? 20_000, remaining - 500),
        opts.signal,
        model,
      )) as typeof res;
    } catch (e) {
      if (e instanceof GeminiError && e.code === "model_unavailable" && round === 1 && modelIndex < opts.models.length - 1) {
        modelIndex++;
        round--;
        continue;
      }
      throw e;
    }

    const choice = res.choices?.[0];
    const msg = choice?.message;
    if (!msg) throw new GeminiError(502, "empty", GEMINI_MESSAGES.unavailable, `provider=groq model=${model}`);
    const calls = (msg.tool_calls ?? []).filter((c) => c.function?.name);

    if (!calls.length || forceText) return { text: (msg.content ?? "").trim(), model, toolCalls };

    // Se devuelve el turno del asistente sin el razonamiento interno.
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls });
    const results = await Promise.all(
      calls.map(async (call, i): Promise<GroqMessage> => {
        let result: unknown;
        if (i >= MAX_CALLS_PER_ROUND) {
          result = { error: "Demasiadas llamadas en una sola ronda." };
        } else {
          toolCalls++;
          try {
            const args = call.function.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
            result = await opts.executeTool(call.function.name, args);
          } catch {
            result = { error: "No pude completar esa consulta. Intenta de nuevo." };
          }
        }
        return { role: "tool", tool_call_id: call.id, content: JSON.stringify(result) };
      }),
    );
    messages.push(...results);
  }
  return { text: "", model: opts.models[modelIndex], toolCalls };
}
