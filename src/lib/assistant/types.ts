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

/** Mover dinero entre cuentas propias (incluye aportar o retirar de una meta). */
export interface TransferDraft {
  type: "transfer";
  id: string;
  from_account_id: string;
  from_account_name: string;
  to_account_id: string;
  to_account_name: string;
  /** Centavos que salen (moneda de origen). */
  amount: number;
  currency: string;
  to_currency: string;
  /** Solo si las monedas difieren: lo que llega a destino. null = falta indicarlo. */
  to_amount: number | null;
  description: string;
  occurred_on: string;
  goal_name: string | null;
}

/** Registrar un pago entre miembros de un grupo (saldar deuda). */
export interface SettlementDraft {
  type: "settlement";
  id: string;
  group_id: string;
  group_name: string;
  currency: string;
  from_member_id: string;
  from_name: string;
  to_member_id: string;
  to_name: string;
  /** El usuario es quien paga (sale de su cuenta) o quien recibe. */
  i_pay: boolean;
  amount: number;
  account_id: string | null;
  account_name: string | null;
  occurred_on: string;
}

/** Crear un ingreso o gasto recurrente. */
export interface RecurringDraft {
  type: "recurring";
  id: string;
  kind: "expense" | "income";
  amount: number;
  currency: string;
  description: string;
  category_id: string | null;
  category_name: string | null;
  account_id: string | null;
  account_name: string | null;
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  start_on: string;
}

/** Crear una cuenta o tarjeta de crédito. */
export interface AccountDraft {
  type: "account";
  id: string;
  name: string;
  account_type: "checking" | "savings" | "credit" | "investment" | "cash" | "other";
  currency: string;
  institution: string | null;
  last4: string | null;
  /** Centavos con signo: negativo = deuda (tarjetas). */
  opening_balance: number;
  /** Solo tarjetas, centavos. */
  credit_limit: number | null;
  statement_day: number | null;
  payment_due_day: number | null;
}

/** Pagar una tarjeta desde otra cuenta (transferencia). */
export interface CardPaymentDraft {
  type: "card_payment";
  id: string;
  card_id: string;
  card_name: string;
  currency: string;
  /** Centavos a pagar. */
  amount: number;
  /** Deuda de la tarjeta al preparar el borrador. */
  debt: number;
  /** Cuenta con que se paga; el usuario la puede cambiar en el borrador. */
  from_account_id: string | null;
  from_account_name: string | null;
  occurred_on: string;
}

/** Poner al día cuánto se lleva consumido (se debe) en una tarjeta. */
export interface CardDebtDraft {
  type: "card_debt";
  id: string;
  card_id: string;
  card_name: string;
  currency: string;
  current_debt: number;
  new_debt: number;
  occurred_on: string;
}

/** Deuda o préstamo con una persona. Montos en centavos. */
export interface DebtDraft {
  type: "debt";
  id: string;
  direction: "borrowed" | "lent";
  person: string;
  principal: number;
  currency: string;
  started_on: string;
  interest_rate: number;
  interest_period: "none" | "total" | "monthly" | "annual";
  installments: number;
  frequency: "once" | "weekly" | "biweekly" | "monthly";
  first_due_on: string;
  account_id: string | null;
  account_name: string | null;
  note: string | null;
  /** Calculados (para mostrar). */
  interest: number;
  total: number;
  installment_amount: number;
  last_due_on: string;
}

/** Pago (o cobro) de una deuda con una persona. */
export interface DebtPaymentDraft {
  type: "debt_payment";
  id: string;
  debt_id: string;
  person: string;
  direction: "borrowed" | "lent";
  currency: string;
  amount: number;
  remaining: number;
  account_id: string | null;
  account_name: string | null;
  paid_on: string;
}

export type Draft =
  | TransactionDraft
  | SharedExpenseDraft
  | TransferDraft
  | SettlementDraft
  | RecurringDraft
  | AccountDraft
  | CardPaymentDraft
  | CardDebtDraft
  | DebtDraft
  | DebtPaymentDraft;

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
export const MAX_TEXT = 6000;
export const MAX_AUDIO_CHARS = 3_000_000;
export const MAX_RECORDING_MS = 30_000;
