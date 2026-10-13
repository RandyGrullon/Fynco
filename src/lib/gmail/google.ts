// Cliente mínimo de Google OAuth y de la API de Gmail (solo lectura). Solo servidor.
// Nunca registra el contenido de los correos ni los tokens.

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
}

/** Credenciales de Google y llave de cifrado; null si falta alguna variable. */
export function gmailConfig(): GmailConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const tokenKey = process.env.GMAIL_TOKEN_KEY?.trim();
  return clientId && clientSecret && tokenKey ? { clientId, clientSecret } : null;
}

export type GmailErrorCode = "reconnect" | "rate_limited" | "unavailable";

export class GmailError extends Error {
  readonly code: GmailErrorCode;
  constructor(code: GmailErrorCode, message: string) {
    super(message);
    this.name = "GmailError";
    this.code = code;
  }
}

async function call(url: string, init: RequestInit, timeoutMs = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } catch {
    throw new GmailError("unavailable", "No pude conectarme con Gmail. Intenta en un momento.");
  } finally {
    clearTimeout(timer);
  }
}

function apiError(status: number): GmailError {
  if (status === 401 || status === 403) return new GmailError("reconnect", "Gmail ya no da acceso. Vuelve a conectarlo en Ajustes.");
  if (status === 429) return new GmailError("rate_limited", "Gmail pidió esperar un momento. Intenta más tarde.");
  return new GmailError("unavailable", "Gmail no respondió bien. Intenta en un momento.");
}

export function buildAuthUrl(p: { clientId: string; redirectUri: string; state: string; loginHint?: string }): string {
  const params = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: `openid email ${GMAIL_SCOPE}`,
    access_type: "offline",
    // Fuerza a Google a entregar un refresh_token aunque ya hayas dado permiso antes.
    prompt: "consent",
    include_granted_scopes: "true",
    state: p.state,
  });
  if (p.loginHint) params.set("login_hint", p.loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(cfg: GmailConfig, code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken: string | null; scope: string }> {
  const res = await call(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!res.ok) throw new GmailError("reconnect", "Google no aceptó el permiso. Intenta conectar de nuevo.");
  const body = (await res.json()) as { access_token?: string; refresh_token?: string; scope?: string };
  if (!body.access_token) throw new GmailError("reconnect", "Google no devolvió acceso. Intenta conectar de nuevo.");
  return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null, scope: body.scope ?? "" };
}

export async function refreshAccessToken(cfg: GmailConfig, refreshToken: string): Promise<string> {
  const res = await call(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: "refresh_token" }),
  });
  if (res.status === 400 || res.status === 401) {
    // invalid_grant: el permiso se revocó o venció (en modo "Testing" de Google vence a los 7 días).
    throw new GmailError("reconnect", "El permiso de Gmail venció. Vuelve a conectarlo en Ajustes.");
  }
  if (!res.ok) throw apiError(res.status);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new GmailError("unavailable", "Google no devolvió acceso. Intenta en un momento.");
  return body.access_token;
}

export async function revokeToken(token: string): Promise<void> {
  try {
    await call(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" } }, 5000);
  } catch {
    // Si falla, igual se borra la conexión de nuestro lado.
  }
}

async function gmailGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await call(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw apiError(res.status);
  return (await res.json()) as T;
}

export async function getProfileEmail(accessToken: string): Promise<string> {
  const p = await gmailGet<{ emailAddress?: string }>(accessToken, "/profile");
  return (p.emailAddress ?? "").toLowerCase();
}

/** IDs de los mensajes que cumplen la búsqueda (más nuevos primero). */
export async function listMessageIds(accessToken: string, q: string, max = 60): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q, maxResults: String(Math.min(100, max - ids.length)) });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmailGet<{ messages?: { id: string }[]; nextPageToken?: string }>(accessToken, `/messages?${params.toString()}`);
    ids.push(...(page.messages ?? []).map((m) => m.id));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
}

export interface GmailMessage {
  id: string;
  receivedAt: Date;
  sender: string;
  subject: string;
  text: string;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", shy: "" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
}

function findPart(part: GmailPart, mime: string): string | null {
  if (part.mimeType === mime && part.body?.data) return decodeBase64Url(part.body.data);
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}

/** Remitente sin el nombre: "Banco <a@b.com>" → "a@b.com" */
export function senderAddress(from: string): string {
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
}

export async function getMessage(accessToken: string, id: string): Promise<GmailMessage> {
  const msg = await gmailGet<{ id: string; internalDate?: string; payload?: GmailPart }>(accessToken, `/messages/${encodeURIComponent(id)}?format=full`);
  const payload = msg.payload ?? {};
  const header = (name: string) => payload.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  const plain = findPart(payload, "text/plain");
  const html = plain ? null : findPart(payload, "text/html");
  return {
    id: msg.id,
    receivedAt: new Date(Number(msg.internalDate ?? Date.now())),
    sender: senderAddress(header("from")),
    subject: header("subject").slice(0, 200),
    // Límite por si llega un correo enorme: las alertas pesan unos pocos KB.
    text: (plain ?? (html ? htmlToText(html) : "")).slice(0, 20_000),
  };
}
