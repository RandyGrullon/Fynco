// Cliente REST mínimo de Gemini con bucle de llamadas a funciones. Solo servidor.
// Nunca registra el contenido del usuario ni la llave.

export type GeminiType = "OBJECT" | "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ARRAY";

export interface GeminiSchema {
  type: GeminiType;
  description?: string;
  enum?: string[];
  format?: string;
  nullable?: boolean;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: GeminiSchema;
}

export interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content?: { role?: string; parts?: GeminiPart[] };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
}

/** Error con mensaje listo para mostrar (español) y el estado HTTP que debe devolver la API. */
export class GeminiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.code = code;
  }
}

export const GEMINI_MESSAGES = {
  rateLimited: "Estoy recibiendo muchas preguntas, intenta en un momento.",
  misconfigured: "El asistente no está configurado correctamente. Intenta más tarde.",
  unavailable: "El asistente no está disponible ahora. Intenta en un momento.",
  timeout: "Tardé demasiado en responder. Intenta de nuevo.",
  network: "No pude conectarme con el asistente. Intenta de nuevo.",
  badRequest: "No pude procesar tu mensaje. Intenta decirlo de otra forma.",
  blocked: "No puedo ayudarte con eso. Pregúntame sobre tus finanzas.",
} as const;

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const BLOCK_REASONS = new Set(["SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "RECITATION", "IMAGE_SAFETY"]);

function mapHttpError(status: number, apiMessage: string): GeminiError {
  if (status === 429) return new GeminiError(429, "rate_limited", GEMINI_MESSAGES.rateLimited);
  if (status === 401 || status === 403 || status === 404) return new GeminiError(503, "misconfigured", GEMINI_MESSAGES.misconfigured);
  if (status === 400) {
    if (/api key|api_key|permission/i.test(apiMessage)) return new GeminiError(503, "misconfigured", GEMINI_MESSAGES.misconfigured);
    return new GeminiError(400, "bad_request", GEMINI_MESSAGES.badRequest);
  }
  if (status === 504) return new GeminiError(504, "timeout", GEMINI_MESSAGES.timeout);
  return new GeminiError(503, "unavailable", GEMINI_MESSAGES.unavailable);
}

export interface GenerateOptions {
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
  timeoutMs: number;
  signal?: AbortSignal;
}

/** Una llamada a generateContent con tiempo límite. */
export async function generateContent({ apiKey, model, body, timeoutMs, signal }: GenerateOptions): Promise<GeminiResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs));
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  const name = model.replace(/^models\//, "");
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${encodeURIComponent(name)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch (e) {
    if (ctrl.signal.aborted) throw new GeminiError(504, "timeout", GEMINI_MESSAGES.timeout);
    void e;
    throw new GeminiError(502, "network", GEMINI_MESSAGES.network);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  if (!res.ok) {
    let apiMessage = "";
    try {
      const err = (await res.json()) as { error?: { message?: string; status?: string } };
      apiMessage = `${err.error?.status ?? ""} ${err.error?.message ?? ""}`;
    } catch {
      // cuerpo no JSON
    }
    throw mapHttpError(res.status, apiMessage);
  }

  try {
    return (await res.json()) as GeminiResponse;
  } catch {
    throw new GeminiError(502, "bad_response", GEMINI_MESSAGES.unavailable);
  }
}

export interface ToolLoopOptions {
  apiKey: string;
  model: string;
  systemInstruction: string;
  contents: GeminiContent[];
  tools: FunctionDeclaration[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Máximo de llamadas al modelo (la última se fuerza a responder con texto). */
  maxRounds?: number;
  /** Momento absoluto (ms) en que hay que haber terminado. */
  deadline?: number;
  /** Tiempo máximo por llamada. */
  callTimeoutMs?: number;
  generationConfig?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface ToolLoopResult {
  text: string;
  rounds: number;
  toolCalls: number;
}

const MAX_CALLS_PER_ROUND = 6;

function textOf(parts: GeminiPart[]) {
  return parts
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
}

/**
 * Bucle de function calling: si el modelo pide funciones, se ejecutan en el servidor y se le
 * devuelven sus resultados, hasta obtener texto o agotar las rondas.
 */
export async function runToolLoop(opts: ToolLoopOptions): Promise<ToolLoopResult> {
  const maxRounds = Math.max(1, opts.maxRounds ?? 5);
  const deadline = opts.deadline ?? Date.now() + 27_000;
  const callTimeout = opts.callTimeoutMs ?? 25_000;
  const contents = [...opts.contents];
  let toolCalls = 0;

  for (let round = 1; round <= maxRounds; round++) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) throw new GeminiError(504, "timeout", GEMINI_MESSAGES.timeout);
    // En la última ronda (o con poco tiempo) se obliga a contestar con texto.
    const forceText = round === maxRounds || remaining < 7000;

    const res = await generateContent({
      apiKey: opts.apiKey,
      model: opts.model,
      timeoutMs: Math.min(callTimeout, remaining - 500),
      signal: opts.signal,
      body: {
        systemInstruction: { parts: [{ text: opts.systemInstruction }] },
        contents,
        tools: [{ functionDeclarations: opts.tools }],
        toolConfig: { functionCallingConfig: { mode: forceText ? "NONE" : "AUTO" } },
        generationConfig: opts.generationConfig,
      },
    });

    if (res.promptFeedback?.blockReason) throw new GeminiError(422, "blocked", GEMINI_MESSAGES.blocked);
    const candidate = res.candidates?.[0];
    if (!candidate) throw new GeminiError(502, "empty", GEMINI_MESSAGES.unavailable);
    if (candidate.finishReason && BLOCK_REASONS.has(candidate.finishReason)) throw new GeminiError(422, "blocked", GEMINI_MESSAGES.blocked);

    const parts = candidate.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall?.name);

    if (!calls.length || forceText) {
      // Llamada mal formada: un reintento si quedan rondas.
      if (!calls.length && candidate.finishReason === "MALFORMED_FUNCTION_CALL" && !forceText) continue;
      return { text: textOf(parts), rounds: round, toolCalls };
    }

    // Se devuelven las partes tal cual (incluye thoughtSignature si viene).
    contents.push({ role: "model", parts });
    const responses: GeminiPart[] = await Promise.all(
      calls.map(async (p, i): Promise<GeminiPart> => {
        const call = p.functionCall!;
        let result: unknown;
        if (i >= MAX_CALLS_PER_ROUND) {
          result = { error: "Demasiadas llamadas en una sola ronda." };
        } else {
          toolCalls++;
          try {
            result = await opts.executeTool(call.name, call.args ?? {});
          } catch {
            result = { error: "No pude completar esa consulta. Intenta de nuevo." };
          }
        }
        return { functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response: { result } } };
      }),
    );
    contents.push({ role: "user", parts: responses });
  }

  return { text: "", rounds: maxRounds, toolCalls };
}
