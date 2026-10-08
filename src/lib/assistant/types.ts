// Tipos compartidos entre el cliente y la API del asistente. Montos en centavos.

export type ChatRole = "user" | "model";

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

/** Borrador de ingreso/gasto personal. No se guarda hasta que el usuario lo confirma. */
export interface TransactionDraft {
  type: "transaction";
  id: string;
  kind: "expense" | "income";
  /** Centavos, siempre positivo. */
  amount: number;
  currency: string;
  description: string;
  category_id: string | null;
  category_name: string | null;
  account_id: string | null;
  account_name: string | null;
  occurred_on: string;
}

export interface DraftShare {
  member_id: string;
  name: string;
  /** Centavos. */
  amount: number;
  is_me: boolean;
}

/** Borrador de gasto compartido (reparto igual). */
export interface SharedExpenseDraft {
  type: "shared_expense";
  id: string;
  group_id: string;
  group_name: string;
  currency: string;
  description: string;
  /** Centavos, siempre positivo. */
  amount: number;
  category_id: string | null;
  category_name: string | null;
  occurred_on: string;
  payer_member_id: string;
  payer_name: string;
  payer_is_me: boolean;
  shares: DraftShare[];
}

export type Draft = TransactionDraft | SharedExpenseDraft;

export interface AssistantAudio {
  mimeType: "audio/wav";
  /** WAV en base64 (sin prefijo data:). */
  data: string;
}

export interface AssistantRequest {
  messages: ChatMessage[];
  audio?: AssistantAudio;
  /** Fecha local del usuario, YYYY-MM-DD. */
  today: string;
}

export interface AssistantResponse {
  reply: string;
  drafts: Draft[];
  /** Transcripción de la nota de voz, si se envió una. */
  transcript?: string;
}

export interface AssistantErrorBody {
  error: string;
}

/** Texto que se manda en lugar de una nota de voz sin transcripción. */
export const VOICE_PLACEHOLDER = "[Nota de voz]";

export const MAX_HISTORY = 20;
export const MAX_TEXT = 4000;
export const MAX_AUDIO_CHARS = 3_000_000;
export const MAX_RECORDING_MS = 30_000;
