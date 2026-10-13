// Sincroniza las alertas del banco desde Gmail hacia el libro de movimientos. Solo servidor.
// Corre con la sesión del usuario (RLS): solo puede leer y escribir lo suyo.
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMoney } from "@/lib/money";
import { categorizeWithAI, extractWithAI, isAiConfigured } from "./ai";
import { decryptSecret } from "./crypto";
import { GmailError, getMessage, gmailConfig, listMessageIds, refreshAccessToken, type GmailMessage } from "./google";
import { cashAccount, convertCents, fetchRates, matchCardAccount, type MatchableAccount } from "./match";
import { guessCategory, parseBankEmail, prettyMerchant } from "./parse";
import type { SyncSummary } from "./types";

export type { SyncSummary };

/** No se vuelve a revisar Gmail antes de esto, salvo que la persona lo pida. */
export const SYNC_COOLDOWN_MS = 10 * 60_000;
const MAX_PER_RUN = 25;
const OVERLAP_MS = 3 * 86_400_000;


type ImportStatus = "added" | "review" | "ignored" | "error";
type ImportKind = "expense" | "income" | "cash_withdrawal" | "refund" | "other";

interface ImportRow {
  user_id: string;
  gmail_id: string;
  received_at: string;
  sender: string;
  subject: string;
  status: ImportStatus;
  parser: "rules" | "ai";
  kind?: ImportKind | null;
  amount?: number | null;
  currency?: string | null;
  card_last4?: string | null;
  merchant?: string | null;
  occurred_on?: string | null;
  account_id?: string | null;
  transaction_id?: string | null;
  note?: string | null;
}

type Account = MatchableAccount;

type Plan =
  | { action: "skip"; row: ImportRow }
  | {
      action: "income" | "expense";
      row: ImportRow;
      account: Account;
      amount: number;
      occurredOn: string;
      description: string;
      merchant: string;
      categoryHint: string | null;
      note: string;
    }
  | { action: "transfer"; row: ImportRow; from: Account; to: Account; amount: number; occurredOn: string; description: string };

interface Normalized {
  kind: ImportKind;
  amount: number | null;
  currency: string | null;
  last4: string | null;
  merchant: string | null;
  occurredOn: string | null;
  approved: boolean;
  parser: "rules" | "ai";
  categoryHint: string | null;
}

const localDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(d);
const clip = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : s ?? null);

export async function syncGmail(opts: { supabase: SupabaseClient; userId: string; force?: boolean; deadline: number }): Promise<SyncSummary> {
  const { supabase, userId } = opts;
  const summary: SyncSummary = { connected: false, added: 0, review: 0, ignored: 0, errors: 0, more: false };

  const { data: conn, error: connError } = await supabase
    .from("gmail_connections")
    .select("refresh_token_enc, query, import_since, last_synced_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (connError) throw connError;
  if (!conn) return summary;
  summary.connected = true;

  if (!opts.force && conn.last_synced_at && Date.now() - Date.parse(conn.last_synced_at) < SYNC_COOLDOWN_MS) return { ...summary, skipped: "recent" };

  const cfg = gmailConfig();
  if (!cfg) return { ...summary, error: "Falta configurar Gmail en el servidor (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GMAIL_TOKEN_KEY)." };

  const setError = async (message: string) => {
    await supabase.from("gmail_connections").update({ last_error: message.slice(0, 300), updated_at: new Date().toISOString() }).eq("user_id", userId);
    return { ...summary, error: message };
  };

  let access: string;
  try {
    access = await refreshAccessToken(cfg, decryptSecret(conn.refresh_token_enc as string));
  } catch (e) {
    return setError(e instanceof GmailError ? e.message : "No pude abrir tu conexión con Gmail. Vuelve a conectarlo en Ajustes.");
  }

  const importSince = Date.parse(conn.import_since as string);
  const lastSync = conn.last_synced_at ? Date.parse(conn.last_synced_at as string) : importSince;
  const since = Math.max(importSince, lastSync - OVERLAP_MS);
  const startedAt = new Date(Date.now()).toISOString();

  let ids: string[];
  try {
    ids = await listMessageIds(access, `${conn.query as string} after:${Math.floor(since / 1000)}`, 100);
  } catch (e) {
    if (e instanceof GmailError) return setError(e.message);
    throw e;
  }

  let done = new Set<string>();
  if (ids.length) {
    const { data, error } = await supabase.from("email_imports").select("gmail_id").in("gmail_id", ids);
    if (error) throw error;
    done = new Set((data ?? []).map((r) => r.gmail_id as string));
  }
  // Más viejos primero, para que el orden de los movimientos sea el real.
  const pendingAll = ids.filter((id) => !done.has(id)).reverse();
  const pending = pendingAll.slice(0, MAX_PER_RUN);
  summary.more = pendingAll.length > pending.length;

  const [accRes, catRes] = await Promise.all([
    supabase.from("accounts").select("id, name, type, currency, last4, is_default, archived_at"),
    supabase.from("categories").select("id, name, kind, user_id"),
  ]);
  if (accRes.error) throw accRes.error;
  if (catRes.error) throw catRes.error;
  const accounts = (accRes.data ?? []) as Account[];
  const categories = (catRes.data ?? []) as { id: string; name: string; kind: string; user_id: string | null }[];

  let rates: Record<string, number> | null = null;
  let liveRates = true;
  const getRates = async () => {
    if (!rates) {
      const r = await fetchRates();
      rates = r.rates;
      liveRates = r.live;
    }
    return rates;
  };

  // ---------- 1) Leer cada correo y decidir qué hacer ----------
  const plans: Plan[] = [];
  for (const id of pending) {
    if (Date.now() > opts.deadline - 8000) {
      summary.more = true;
      break;
    }
    let msg: GmailMessage;
    try {
      msg = await getMessage(access, id);
    } catch (e) {
      if (e instanceof GmailError && e.code === "reconnect") return setError(e.message);
      summary.errors++;
      summary.more = true;
      continue; // se reintenta en la próxima vuelta
    }
    const row: ImportRow = {
      user_id: userId,
      gmail_id: msg.id,
      received_at: msg.receivedAt.toISOString(),
      sender: msg.sender.slice(0, 200),
      subject: msg.subject.slice(0, 200),
      status: "review",
      parser: "rules",
    };
    if (msg.receivedAt.getTime() < importSince) {
      plans.push({ action: "skip", row: { ...row, status: "ignored", note: "Llegó antes de conectar Gmail (ya está en tus saldos iniciales)." } });
      continue;
    }
    plans.push(await planFor(msg, row));
  }

  async function planFor(msg: GmailMessage, base: ImportRow): Promise<Plan> {
    const review = (row: ImportRow, note: string): Plan => ({ action: "skip", row: { ...row, status: "review", note } });
    const ignore = (row: ImportRow, note: string): Plan => ({ action: "skip", row: { ...row, status: "ignored", note } });

    const parsed = parseBankEmail(msg);
    if (parsed === "noise") return ignore(base, "No es un movimiento.");

    let n: Normalized;
    if (parsed?.type === "card_charge") {
      n = { kind: "expense", amount: parsed.amount, currency: parsed.currency, last4: parsed.last4, merchant: parsed.merchant, occurredOn: parsed.occurredOn, approved: parsed.approved, parser: "rules", categoryHint: null };
    } else if (parsed?.type === "cash_withdrawal") {
      n = { kind: "cash_withdrawal", amount: parsed.amount, currency: parsed.currency, last4: null, merchant: "Retiro en cajero", occurredOn: parsed.occurredOn, approved: parsed.approved, parser: "rules", categoryHint: null };
    } else if (parsed?.type === "payroll") {
      n = { kind: "income", amount: parsed.amount, currency: parsed.currency, last4: parsed.last4, merchant: "Nómina", occurredOn: parsed.occurredOn, approved: true, parser: "rules", categoryHint: "Salario" };
    } else if (isAiConfigured()) {
      const ai = await extractWithAI(msg);
      const aiRow = { ...base, parser: "ai" as const };
      if (!ai) return review(aiRow, "La IA no pudo leer este correo. Revísalo tú.");
      if (!ai.is_transaction) return ignore(aiRow, "La IA dice que no es un movimiento.");
      n = {
        kind: ai.kind,
        amount: ai.amount ? Math.round(ai.amount * 100) : null,
        currency: ai.currency,
        last4: ai.last4,
        merchant: ai.merchant,
        occurredOn: ai.date,
        approved: ai.approved,
        parser: "ai",
        categoryHint: null,
      };
    } else {
      return review(base, "No reconozco este formato de correo.");
    }

    const occurredOn = n.occurredOn ?? localDate(msg.receivedAt);
    const row: ImportRow = {
      ...base,
      parser: n.parser,
      kind: n.kind,
      amount: n.amount,
      currency: n.currency,
      card_last4: n.last4,
      merchant: clip(n.merchant, 120),
      occurred_on: occurredOn,
    };
    if (!n.approved) return ignore(row, "El banco no aprobó la transacción.");
    if (!n.amount || !n.currency) {
      const target = n.last4 ? matchCardAccount(accounts, n.last4, n.currency ?? "DOP")?.account : undefined;
      return review({ ...row, account_id: target?.id ?? null }, "El correo no trae el monto. Agrégalo tú.");
    }

    if (n.kind === "cash_withdrawal") {
      const from = accounts.find((a) => !a.archived_at && a.is_default && a.currency === n.currency) ?? accounts.find((a) => !a.archived_at && a.type === "checking" && a.currency === n.currency);
      const to = cashAccount(accounts);
      if (!from || !to || from.id === to.id) return review({ ...row, account_id: from?.id ?? null }, "Retiro en cajero: no tienes una cuenta de efectivo para pasarlo.");
      return { action: "transfer", row: { ...row, account_id: from.id }, from, to, amount: n.amount, occurredOn, description: "Retiro en cajero" };
    }

    if (n.kind === "expense" || n.kind === "income" || n.kind === "refund") {
      const match = n.last4 ? matchCardAccount(accounts, n.last4, n.currency) : null;
      if (!match) return review(row, n.last4 ? `No tienes una cuenta con terminación ${n.last4}. Agrégala a una cuenta o regístralo tú.` : "No sé a qué cuenta va.");
      let amount = n.amount;
      let note = "Correo del banco";
      if (match.convert) {
        const converted = convertCents(n.amount, n.currency, match.account.currency, await getRates());
        if (converted == null || converted <= 0) return review({ ...row, account_id: match.account.id }, `No pude convertir ${n.currency} a ${match.account.currency}.`);
        amount = converted;
        note += ` · ${formatMoney(n.amount, n.currency, { cents: "always" })} convertido${liveRates ? "" : " (tasa aproximada)"}`;
      }
      const merchant = n.merchant?.trim() || (n.kind === "expense" ? "Consumo" : n.kind === "refund" ? "Devolución" : "Depósito");
      return {
        action: n.kind === "expense" ? "expense" : "income",
        row: { ...row, account_id: match.account.id },
        account: match.account,
        amount,
        occurredOn,
        description: prettyMerchant(merchant),
        merchant,
        categoryHint: n.categoryHint ?? (n.kind === "refund" ? "Otros ingresos" : null),
        note,
      };
    }

    return review(row, "No sé qué tipo de movimiento es.");
  }

  // ---------- 2) Categorías: reglas, luego la IA para lo que falte ----------
  const catId = (name: string, kind: "expense" | "income") =>
    (categories.find((c) => c.kind === kind && c.user_id && c.name === name) ?? categories.find((c) => c.kind === kind && c.name === name))?.id ?? null;
  const pendingCat: { id: string; merchant: string; kind: "expense" | "income" }[] = [];
  plans.forEach((p, i) => {
    if (p.action !== "expense" && p.action !== "income") return;
    p.categoryHint ??= guessCategory(p.merchant);
    if (!p.categoryHint) pendingCat.push({ id: String(i), merchant: p.merchant, kind: p.action });
  });
  if (pendingCat.length && isAiConfigured() && Date.now() < opts.deadline - 5000) {
    const byAi = await categorizeWithAI(pendingCat, categories);
    for (const [i, name] of Object.entries(byAi)) {
      const p = plans[Number(i)];
      if (p && (p.action === "expense" || p.action === "income")) p.categoryHint = name;
    }
  }

  // ---------- 3) Guardar ----------
  for (const p of plans) {
    // Se "reserva" el correo antes de crear el movimiento: si otra pestaña ya lo tomó, no se duplica.
    const claim = p.action === "skip" ? p.row : { ...p.row, status: "review" as const, note: "Registrando…" };
    const { data: claimed, error: claimError } = await supabase
      .from("email_imports")
      .upsert(claim, { onConflict: "user_id,gmail_id", ignoreDuplicates: true })
      .select("id");
    if (claimError) {
      summary.errors++;
      continue;
    }
    if (!claimed?.length) continue;
    const importId = claimed[0].id as string;

    if (p.action === "skip") {
      if (p.row.status === "review") summary.review++;
      else summary.ignored++;
      continue;
    }

    try {
      let transactionId: string;
      if (p.action === "transfer") {
        const { data: transferId, error } = await supabase.rpc("create_transfer", {
          p_from: p.from.id,
          p_to: p.to.id,
          p_amount: p.amount,
          p_to_amount: null,
          p_occurred_on: p.occurredOn,
          p_description: p.description,
        });
        if (error) throw error;
        const { data: leg } = await supabase.from("transactions").select("id").eq("transfer_id", transferId).eq("account_id", p.from.id).maybeSingle();
        transactionId = (leg?.id as string | undefined) ?? (transferId as string);
      } else {
        const fallback = p.action === "expense" ? "Otros gastos" : "Otros ingresos";
        const { data: tx, error } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            account_id: p.account.id,
            kind: p.action,
            amount: p.action === "expense" ? -Math.abs(p.amount) : Math.abs(p.amount),
            occurred_on: p.occurredOn,
            description: p.description.slice(0, 120),
            category_id: catId(p.categoryHint ?? fallback, p.action) ?? catId(fallback, p.action),
            source: "email",
            note: p.note.slice(0, 500),
          })
          .select("id")
          .single();
        if (error) throw error;
        transactionId = tx.id as string;
      }
      await supabase.from("email_imports").update({ status: "added", transaction_id: transactionId, note: null }).eq("id", importId);
      summary.added++;
    } catch {
      await supabase.from("email_imports").update({ status: "review", note: "No se pudo registrar automáticamente. Regístralo tú." }).eq("id", importId);
      summary.review++;
    }
  }

  // Solo se avanza la marca si se revisó todo; si no, la próxima vuelta repite la misma ventana.
  await supabase
    .from("gmail_connections")
    .update({ ...(summary.more ? {} : { last_synced_at: startedAt }), last_error: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return summary;
}
