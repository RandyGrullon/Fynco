// Tipos compartidos entre el servidor y la app (sin dependencias de servidor).

export const GMAIL_STATE_COOKIE = "fynco_gmail_state";

export interface SyncSummary {
  connected: boolean;
  added: number;
  review: number;
  ignored: number;
  errors: number;
  /** Quedaron correos por procesar (se siguen en la próxima vuelta). */
  more: boolean;
  skipped?: "recent";
  error?: string;
}

export interface GmailStatus {
  google_email: string;
  query: string;
  import_since: string;
  last_synced_at: string | null;
  last_error: string | null;
}

export type EmailImportStatus = "added" | "review" | "ignored" | "error";

export interface EmailImport {
  id: string;
  gmail_id: string;
  received_at: string;
  sender: string;
  subject: string;
  status: EmailImportStatus;
  parser: "rules" | "ai";
  kind: "expense" | "income" | "cash_withdrawal" | "refund" | "other" | null;
  amount: number | null;
  currency: string | null;
  card_last4: string | null;
  merchant: string | null;
  occurred_on: string | null;
  account_id: string | null;
  transaction_id: string | null;
  note: string | null;
  created_at: string;
}
