// Estado de la conversación del asistente: tipos de la interfaz, sessionStorage y el
// historial que se manda a la API.
import { formatMoney } from "@/lib/money";
import { MAX_HISTORY, MAX_TEXT, VOICE_PLACEHOLDER, type ChatMessage, type Draft } from "@/lib/assistant/types";

export interface UIDraft {
  draft: Draft;
  status: "pending" | "saved";
  /** Origen para el movimiento guardado. */
  source: "voice" | "assistant";
}

export interface UIMessage {
  id: string;
  role: "user" | "model";
  text: string;
  /** Mensaje del usuario enviado como nota de voz. */
  voice?: { durationMs: number };
  drafts?: UIDraft[];
  at: number;
}

const MAX_STORED = 60;
const storageKey = (userId: string) => `fynco:asistente:v1:${userId}`;

export function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function isMessage(v: unknown): v is UIMessage {
  if (!v || typeof v !== "object") return false;
  const m = v as Partial<UIMessage>;
  return typeof m.id === "string" && (m.role === "user" || m.role === "model") && typeof m.text === "string" && (m.drafts === undefined || Array.isArray(m.drafts));
}

export function loadConversation(userId: string): UIMessage[] {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMessage).slice(-MAX_STORED);
  } catch {
    return [];
  }
}

export function saveConversation(userId: string, messages: UIMessage[]) {
  try {
    if (!messages.length) sessionStorage.removeItem(storageKey(userId));
    else sessionStorage.setItem(storageKey(userId), JSON.stringify(messages.slice(-MAX_STORED)));
  } catch {
    // almacenamiento lleno o bloqueado: la conversación sigue en memoria
  }
}

function describeDraft(d: UIDraft) {
  const x = d.draft;
  const status = d.status === "saved" ? "guardado" : "sin confirmar";
  switch (x.type) {
    case "transaction":
      return `${x.kind === "income" ? "ingreso" : "gasto"} de ${formatMoney(x.amount, x.currency)} «${x.description}» (${status})`;
    case "shared_expense":
      return `gasto compartido en ${x.group_name} de ${formatMoney(x.amount, x.currency)} «${x.description}» (${status})`;
    case "transfer":
      return `transferencia de ${formatMoney(x.amount, x.currency)} de ${x.from_account_name} a ${x.to_account_name} (${status})`;
    case "settlement":
      return `pago de ${x.from_name} a ${x.to_name} por ${formatMoney(x.amount, x.currency)} en ${x.group_name} (${status})`;
    case "recurring":
      return `${x.kind === "income" ? "ingreso" : "gasto"} recurrente ${x.frequency} de ${formatMoney(x.amount, x.currency)} «${x.description}» (${status})`;
  }
}

const clip = (s: string) => (s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) : s);

/** Últimos mensajes en el formato de la API, con una nota del estado de los borradores. */
export function toApiMessages(messages: UIMessage[]): ChatMessage[] {
  return messages.slice(-MAX_HISTORY).map((m) => {
    if (m.role === "user") return { role: "user", text: clip(m.text.trim() || VOICE_PLACEHOLDER) };
    const note = m.drafts?.length ? `\n\n(Borradores propuestos: ${m.drafts.map(describeDraft).join("; ")}.)` : "";
    return { role: "model", text: clip(`${m.text}${note}`) };
  });
}
