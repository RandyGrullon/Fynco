import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret } from "./crypto";
import { syncGmail } from "./sync";

// ---------- Base de datos en memoria con lo mínimo que usa syncGmail ----------
type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
let seq = 0;
const newId = () => `id-${++seq}`;

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "insert" | "upsert" | "update" = "select";
  private payload: Row | null = null;
  private opts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  private mode: "many" | "one" | "maybe" = "many";
  constructor(
    private tables: Tables,
    private table: string,
  ) {}
  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  upsert(row: Row, opts: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = "upsert";
    this.payload = row;
    this.opts = opts;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this.run();
  }
  single() {
    this.mode = "one";
    return this.run();
  }
  then<T>(resolve: (v: { data: unknown; error: null }) => T, reject?: (e: unknown) => T) {
    return this.run().then(resolve, reject);
  }
  private async run(): Promise<{ data: unknown; error: null }> {
    const rows = (this.tables[this.table] ??= []);
    if (this.op === "insert" || this.op === "upsert") {
      const row = { id: newId(), ...this.payload } as Row;
      if (this.op === "upsert" && this.opts.ignoreDuplicates) {
        const keys = (this.opts.onConflict ?? "").split(",");
        if (rows.some((r) => keys.every((k) => r[k] === row[k]))) return { data: [], error: null };
      }
      rows.push(row);
      return { data: this.mode === "many" ? [row] : row, error: null };
    }
    const matched = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") {
      matched.forEach((r) => Object.assign(r, this.payload));
      return { data: null, error: null };
    }
    return { data: this.mode === "many" ? matched : (matched[0] ?? null), error: null };
  }
}

function fakeSupabase(tables: Tables) {
  return {
    from: (t: string) => new Query(tables, t),
    rpc: async (name: string, args: Row) => {
      if (name !== "create_transfer") throw new Error(name);
      const tid = newId();
      tables.transactions.push({ id: newId(), account_id: args.p_from, kind: "transfer", amount: -Number(args.p_amount), transfer_id: tid });
      tables.transactions.push({ id: newId(), account_id: args.p_to, kind: "transfer", amount: Number(args.p_amount), transfer_id: tid });
      return { data: tid, error: null };
    },
  } as unknown as SupabaseClient;
}

// ---------- Gmail simulado con correos reales del Popular ----------
const consumo = (card: string, last4: string, monto: string, moneda: string, fecha: string, comercio: string, estatus = "Aprobada") =>
  `Estimado (a) NOMBRE\n\nGracias por utilizar su ${card}, terminada en ${last4}.\n\nA continuación le informamos el detalle de su transacción:\n\nMonto \tMoneda \tFecha \tComercio\tEstatus\t\n${monto} \t${moneda} \t${fecha} \t${comercio} \t${estatus}\t\n\nEn caso de requerir mayor información, puede comunicarse con nosotros`;

const NOW = Date.parse("2026-10-14T15:00:00Z");
const CONNECTED = "2026-10-13T05:00:00Z";
const MAILS: Record<string, { at: string; subject: string; text: string; from?: string }> = {
  old: { at: "2026-10-12T19:12:53Z", subject: "Notificación de Consumo", text: consumo("VISA IKEA FAMILY", "5263", "RD$4,704.75", "Peso dominicano", "12/10/2026", "SEGUROS\nRESERVAS INTERM 3") },
  wolt: { at: "2026-10-13T18:00:00Z", subject: "Notificación de Consumo", text: consumo("MASTERCARD JETBLUE", "3742", "EUR$25.15", "Euro", "13/10/2026", "Wolt") },
  ikea: { at: "2026-10-13T19:00:00Z", subject: "Notificación de Consumo", text: consumo("VISA IKEA FAMILY", "5263", "RD$1,250.00", "Peso dominicano", "13/10/2026", "SUPERMERCADOS\nNACIONAL") },
  declined: { at: "2026-10-13T20:00:00Z", subject: "Notificación de Consumo", text: consumo("MASTERCARD JETBLUE", "3742", "US$9.99", "Dólar estadounidense", "13/10/2026", "NETFLIX", "Declinada") },
  unknownCard: { at: "2026-10-13T21:00:00Z", subject: "Notificación de Consumo", text: consumo("VISA CLASICA", "0000", "RD$300.00", "Peso dominicano", "13/10/2026", "COLMADO") },
  nomina: {
    at: "2026-10-14T12:00:00Z",
    subject: "Notificación Depósito de Nómina",
    text: "Le informamos que ha sido acreditado el pago de su nómina en su cuenta terminada en 1848.",
  },
  promo: { at: "2026-10-14T13:00:00Z", subject: "¡35% de ahorro! - Publicidad", text: "Promoción", from: "popularteinforma@popularenlinea.com" },
};

function gmailFetch(url: string): Response {
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
  if (url.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "access" });
  if (url.startsWith("https://open.er-api.com")) return json({ rates: { USD: 1, DOP: 62, EUR: 0.86 } });
  const list = url.match(/\/users\/me\/messages\?(.*)$/);
  if (list) {
    const q = new URLSearchParams(list[1]).get("q") ?? "";
    const after = Number(q.match(/after:(\d+)/)?.[1] ?? 0) * 1000;
    // Gmail devuelve lo más nuevo primero.
    const ids = Object.entries(MAILS)
      .filter(([, m]) => Date.parse(m.at) >= after - 86_400_000) // "after:" de Gmail es poco preciso: incluye de más
      .sort(([, a], [, b]) => Date.parse(b.at) - Date.parse(a.at))
      .map(([id]) => ({ id }));
    return json({ messages: ids });
  }
  const one = url.match(/\/users\/me\/messages\/([^?]+)\?format=full/);
  if (one) {
    const m = MAILS[decodeURIComponent(one[1])];
    return json({
      id: one[1],
      internalDate: String(Date.parse(m.at)),
      payload: {
        mimeType: "multipart/alternative",
        headers: [
          { name: "From", value: `Banco Popular <${m.from ?? "notificaciones@popularenlinea.com"}>` },
          { name: "Subject", value: m.subject },
        ],
        parts: [{ mimeType: "text/plain", body: { data: Buffer.from(m.text).toString("base64url") } }],
      },
    });
  }
  throw new Error(`fetch inesperado: ${url}`);
}

const USER = "randy";
const ACCOUNTS: Row[] = [
  { id: "popular", name: "Popular 1848", type: "checking", currency: "DOP", last4: "1848", is_default: true, archived_at: null },
  { id: "ikea", name: "IKEA Family 5263", type: "credit", currency: "DOP", last4: "5263", is_default: false, archived_at: null },
  { id: "jb-dop", name: "JetBlue 3742 RD$", type: "credit", currency: "DOP", last4: "3742", is_default: false, archived_at: null },
  { id: "jb-usd", name: "JetBlue 3742 US$", type: "credit", currency: "USD", last4: "3742", is_default: false, archived_at: null },
];
const CATEGORIES: Row[] = [
  { id: "c-comida", name: "Comida", kind: "expense", user_id: null },
  { id: "c-super", name: "Supermercado", kind: "expense", user_id: null },
  { id: "c-otros", name: "Otros gastos", kind: "expense", user_id: null },
  { id: "c-salario", name: "Salario", kind: "income", user_id: null },
];

describe("syncGmail con correos reales del Popular", () => {
  let tables: Tables;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GMAIL_TOKEN_KEY = Buffer.alloc(32, 3).toString("base64");
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => gmailFetch(String(input)));
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    tables = {
      gmail_connections: [
        { user_id: USER, refresh_token_enc: encryptSecret("refresh"), query: "from:notificaciones@popularenlinea.com", import_since: CONNECTED, last_synced_at: null, last_error: null },
      ],
      email_imports: [],
      transactions: [],
      accounts: structuredClone(ACCOUNTS),
      categories: structuredClone(CATEGORIES),
    };
  });
  afterEach(() => vi.restoreAllMocks());

  const run = (force = true) => syncGmail({ supabase: fakeSupabase(tables), userId: USER, force, deadline: NOW + 50_000 });
  const importOf = (gmailId: string) => tables.email_imports.find((r) => r.gmail_id === gmailId)!;
  const txOf = (gmailId: string) => tables.transactions.find((t) => t.id === importOf(gmailId).transaction_id);

  it("registra, convierte, deja por revisar e ignora lo que corresponde", async () => {
    const s = await run();
    expect(s).toMatchObject({ connected: true, added: 2, review: 2, ignored: 3, errors: 0, more: false });

    // Euros en la JetBlue → saldo en dólares, convertido.
    expect(txOf("wolt")).toMatchObject({ account_id: "jb-usd", kind: "expense", amount: -2924, description: "Wolt", category_id: "c-comida", source: "email", occurred_on: "2026-10-13" });
    expect(String(txOf("wolt")?.note)).toContain("€ 25.15 convertido");

    // Pesos en la IKEA, con categoría por palabra clave.
    expect(txOf("ikea")).toMatchObject({ account_id: "ikea", amount: -125000, description: "Supermercados Nacional", category_id: "c-super" });

    // Antes de conectar: ya está en los saldos iniciales.
    expect(importOf("old").status).toBe("ignored");
    expect(importOf("old").transaction_id).toBeUndefined();
    // Declinada y promoción: ignoradas.
    expect(importOf("declined").status).toBe("ignored");
    expect(importOf("promo").status).toBe("ignored");
    // Sin cuenta con esa terminación, y nómina sin monto: por revisar.
    expect(importOf("unknownCard")).toMatchObject({ status: "review", card_last4: "0000" });
    expect(importOf("nomina")).toMatchObject({ status: "review", account_id: "popular", kind: "income" });

    expect(tables.transactions).toHaveLength(2);
    expect(tables.gmail_connections[0].last_synced_at).toBeTruthy();
    expect(tables.gmail_connections[0].last_error).toBeNull();
  });

  it("no duplica al revisar otra vez", async () => {
    await run();
    const second = await run();
    expect(second).toMatchObject({ added: 0, review: 0, ignored: 0 });
    expect(tables.transactions).toHaveLength(2);
    expect(tables.email_imports).toHaveLength(Object.keys(MAILS).length);
  });

  it("respeta la espera de 10 minutos si no se fuerza", async () => {
    await run();
    expect(await run(false)).toMatchObject({ skipped: "recent" });
  });

  it("retiro con Código Cash pasa a la cuenta de efectivo", async () => {
    tables.accounts.push({ id: "cash", name: "Efectivo", type: "cash", currency: "DOP", last4: null, is_default: false, archived_at: null });
    MAILS.cash = {
      at: "2026-10-14T14:00:00Z",
      subject: "Notificación de retiro Código Cash",
      text: "Le informamos que el Código Cash generado desde tu aplicación móvil, ha sido utilizado. | Monto | Fecha | Estatus |\n|---|---|---|\n| RD 4,800.00 | 14/10/2026 | Aprobada |\n\nDe no reconocer esta transacción",
    };
    try {
      await run();
      const legs = tables.transactions.filter((t) => t.kind === "transfer");
      expect(legs.map((l) => [l.account_id, l.amount])).toEqual([
        ["popular", -480000],
        ["cash", 480000],
      ]);
      expect(importOf("cash").status).toBe("added");
    } finally {
      delete MAILS.cash;
    }
  });

  it("si Google revocó el permiso, lo dice y no toca nada", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).startsWith("https://oauth2.googleapis.com/token") ? new Response('{"error":"invalid_grant"}', { status: 400 }) : gmailFetch(String(input)),
    );
    const s = await run();
    expect(s.error).toMatch(/venció/);
    expect(tables.gmail_connections[0].last_error).toMatch(/venció/);
    expect(tables.transactions).toHaveLength(0);
  });
});
