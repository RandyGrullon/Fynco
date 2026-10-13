import type { EmailImport, EmailImportStatus, GmailStatus, SyncSummary } from "@/lib/gmail/types";
import { db, unwrap } from "./base";

export async function fetchGmailStatus(): Promise<GmailStatus | null> {
  // Nunca se pide el token (va cifrado de todas formas).
  return unwrap(await db().from("gmail_connections").select("google_email, query, import_since, last_synced_at, last_error").maybeSingle()) as GmailStatus | null;
}

export async function fetchEmailImports(status: EmailImportStatus = "review", limit = 20): Promise<EmailImport[]> {
  const rows = unwrap(await db().from("email_imports").select("*").eq("status", status).order("received_at", { ascending: false }).limit(limit)) as EmailImport[];
  return rows.map((r) => ({ ...r, amount: r.amount == null ? null : Number(r.amount) }));
}

export async function resolveEmailImport(id: string, patch: { status: EmailImportStatus; transaction_id?: string | null }): Promise<void> {
  unwrap(await db().from("email_imports").update({ ...patch, note: null }).eq("id", id));
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // respuesta vacía
  }
  if (!res.ok) throw new Error((json as { error?: string } | null)?.error ?? "No pude conectarme. Intenta de nuevo.");
  return json as T;
}

export const syncGmailNow = (force = false) => post<SyncSummary>("/api/gmail/sync", { force });
export const disconnectGmail = () => post<{ ok: true }>("/api/gmail/disconnect");
