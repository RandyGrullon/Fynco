// Herramientas del asistente. Solo servidor: usan el cliente de Supabase con la sesión del
// usuario (RLS aplica). Las propuestas NO escriben en la base: generan borradores que el
// usuario confirma en la interfaz.
import { addDays, format, isValid, parse } from "date-fns";
import type { createSupabaseServer } from "@/lib/supabase/server";
import { computeSharedOverview, myMember, type GroupDetail } from "@/lib/data/groups";
import { monthRange, parseDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { pairwiseDebts, simplifyDebts, splitEqual } from "@/lib/split";
import type { AccountType, Debt, Group, GroupMember, MemberBalance, Settlement, SharedExpense, TxKind } from "@/lib/types";
import type { FunctionDeclaration } from "./gemini";
import type { Draft, DraftShare, SharedExpenseDraft, TransactionDraft } from "./types";

export type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServer>>;

export interface ToolboxOptions {
  supabase: ServerSupabase;
  userId: string;
  /** YYYY-MM-DD del usuario. */
  today: string;
  /** Moneda por defecto del perfil. */
  currency: string;
}

// ---------------------------------------------------------------------------------------------
// Utilidades puras (exportadas para pruebas)
// ---------------------------------------------------------------------------------------------

/** Minúsculas, sin acentos ni signos. */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreName(q: string, n: string): number {
  if (!q || !n) return 0;
  if (q === n) return 100;
  const qt = q.split(" ");
  const nt = n.split(" ");
  if (qt.every((t) => nt.includes(t))) return 90;
  if (q.length >= 2 && n.startsWith(q)) return 80;
  if (qt.every((t) => nt.some((w) => w.startsWith(t)))) return 70;
  if (n.length >= 3 && q.startsWith(`${n} `)) return 65;
  if (qt.some((t) => t.length >= 3 && nt.includes(t))) return 55;
  if (q.length >= 4 && n.includes(q)) return 45;
  return 0;
}

/** Mejor coincidencia por nombre (sin distinguir mayúsculas ni acentos). */
export function bestMatch<T>(items: T[], query: string | null | undefined, names: (t: T) => (string | null | undefined)[], min = 45): T | undefined {
  const q = norm(query ?? "");
  if (!q) return undefined;
  let best: { item: T; score: number } | undefined;
  for (const item of items) {
    for (const raw of names(item)) {
      const score = scoreName(q, norm(raw ?? ""));
      if (score > (best?.score ?? 0)) best = { item, score };
    }
  }
  return best && best.score >= min ? best.item : undefined;
}

const CATEGORY_HINTS: [RegExp, string][] = [
  [/almuerzo|\bcena|desayuno|comida|aliment|restaurant|pizza|hamburgues|\bcafe|picadera|delivery|pedidos ya|empanada|pollo|sushi|helado/, "comida"],
  [/\bsuper|colmado|mercado|bodega|despensa/, "supermercado"],
  [/\buber|taxi|gasolina|combustible|pasaje|guagua|\bmetro\b|peaje|parqueo|didi|indrive|transporte|\bcarro|vehiculo/, "transporte"],
  [/alquiler|\brenta\b|hipoteca|vivienda|condominio/, "vivienda"],
  [/\bluz\b|electricidad|edenorte|edesur|edeeste|\bagua\b|internet|telefono|celular|\bclaro\b|altice|\bcable\b|servicio/, "servicios"],
  [/farmacia|medic|doctor|consulta|clinica|hospital|laboratorio|salud|dentista/, "salud"],
  [/\bcine\b|fiesta|concierto|\bbar\b|\bjuego|entreten|teatro|discoteca/, "entretenimiento"],
  [/\bropa\b|zapato|tienda|amazon|shein|temu|\bcompra/, "compras"],
  [/colegio|universidad|\bcurso|\blibro|matricula|educacion|escuela/, "educacion"],
  [/viaje|hotel|vuelo|boleto|airbnb|vacacion/, "viajes"],
  [/netflix|spotify|suscripcion|youtube|icloud|disney|\bhbo\b|\bprime\b|chatgpt/, "suscripciones"],
  [/salario|sueldo|nomina|quincena|pago de la empresa/, "salario"],
  [/freelance|proyecto|cliente|honorario|chiripa/, "freelance"],
  [/dividendo|interes|inversion/, "inversiones"],
  [/regalo/, "regalos"],
];

/** Pistas de categoría a partir de palabras comunes ("almuerzo" → "comida"), en orden. */
export function categoryHints(text: string): string[] {
  const t = norm(text);
  return t ? CATEGORY_HINTS.filter(([re]) => re.test(t)).map(([, name]) => name) : [];
}

export function categoryHint(text: string): string | null {
  return categoryHints(text)[0] ?? null;
}

const ACCOUNT_TYPE_HINTS: [RegExp, AccountType][] = [
  [/efectivo|cash|cartera|billetera/, "cash"],
  [/tarjeta|credito|visa|mastercard|amex/, "credit"],
  [/ahorro/, "savings"],
  [/corriente|debito|banco|nomina/, "checking"],
  [/inversion/, "investment"],
];

export function accountTypeHint(text: string): AccountType | null {
  const t = norm(text);
  for (const [re, type] of ACCOUNT_TYPE_HINTS) if (re.test(t)) return type;
  return null;
}

const ME_WORDS = new Set(["yo", "me", "mi", "conmigo", "tu", "usuario", "el usuario", "me", "i", "myself"]);
export const isMeWord = (s: string) => ME_WORDS.has(norm(s));

/** "YYYY-MM-DD" válido o null. */
export function validDate(s: unknown): string | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isValid(d) && format(d, "yyyy-MM-dd") === s ? s : null;
}

/** Monto en unidades (850, "850.50", "1,200") → centavos > 0, o null. */
export function toCents(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") {
    const s = v.replace(/[^\d.,-]/g, "");
    // "1,200.50" o "1200,50": la última marca decimal si tiene 1-2 dígitos después.
    const m = s.match(/^(-?[\d.,]*?)[.,](\d{1,2})$/);
    n = m ? Number(`${m[1].replace(/[.,]/g, "")}.${m[2]}`) : Number(s.replace(/[.,]/g, ""));
  } else return null;
  if (!Number.isFinite(n) || n <= 0 || n > 10_000_000_000) return null;
  const cents = Math.round(n * 100);
  return cents > 0 ? cents : null;
}

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fmt = (cents: number, currency: string, signed = false) => formatMoney(cents, currency, signed ? { sign: "always" } : {});
const units = (cents: number) => Math.round(cents) / 100;

const TYPE_LABEL: Record<AccountType, string> = {
  checking: "cuenta corriente",
  savings: "ahorros",
  credit: "tarjeta de crédito",
  investment: "inversión",
  cash: "efectivo",
  other: "otra",
};

const KIND_LABEL: Record<TxKind, string> = {
  income: "ingreso",
  expense: "gasto",
  transfer: "transferencia",
  shared: "gasto compartido (lo que pagaste)",
  settlement: "pago entre amigos",
};

// ---------------------------------------------------------------------------------------------
// Declaraciones para Gemini
// ---------------------------------------------------------------------------------------------
export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_overview",
    description:
      "Resumen financiero actual del usuario: cuentas con saldos, ingresos y gastos de este mes, totales de lo que le deben y lo que debe en gastos compartidos, metas activas con su progreso y cobros recurrentes de los próximos 7 días.",
  },
  {
    name: "list_transactions",
    description:
      "Lista movimientos del usuario (más recientes primero) con filtros opcionales y totales del período. Úsalo para preguntas sobre gastos o ingresos específicos (por texto, cuenta o categoría). Para totales por categoría usa spending_by_category.",
    parameters: {
      type: "OBJECT",
      properties: {
        from: { type: "STRING", description: "Fecha inicial YYYY-MM-DD (incluida)." },
        to: { type: "STRING", description: "Fecha final YYYY-MM-DD (incluida)." },
        kind: { type: "STRING", format: "enum", enum: ["income", "expense", "transfer", "settlement"], description: "income = ingresos; expense = gastos (incluye lo que pagaste en gastos compartidos)." },
        category: { type: "STRING", description: "Nombre de la categoría, p. ej. Comida." },
        account: { type: "STRING", description: "Nombre de la cuenta, p. ej. Efectivo." },
        search: { type: "STRING", description: "Texto a buscar en la descripción." },
        limit: { type: "INTEGER", description: "Máximo de filas a mostrar (1-50, por defecto 20)." },
      },
    },
  },
  {
    name: "spending_by_category",
    description:
      "Gasto real del usuario por categoría en un rango de fechas: sus gastos propios más SU PARTE de los gastos compartidos. Úsalo para '¿cuánto gasté en X?' y resúmenes de gasto.",
    parameters: {
      type: "OBJECT",
      properties: {
        from: { type: "STRING", description: "Fecha inicial YYYY-MM-DD (incluida)." },
        to: { type: "STRING", description: "Fecha final YYYY-MM-DD (incluida)." },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "get_shared_balances",
    description: "Quién le debe a quién en los gastos compartidos del usuario: por grupo y por amigo, con montos por moneda.",
  },
  {
    name: "propose_transaction",
    description:
      "Prepara un BORRADOR de gasto o ingreso personal para que el usuario lo confirme con un toque. No guarda nada. Úsalo siempre que el usuario pida registrar, anotar o apuntar un gasto o ingreso propio.",
    parameters: {
      type: "OBJECT",
      properties: {
        kind: { type: "STRING", format: "enum", enum: ["expense", "income"], description: "expense = gasto, income = ingreso." },
        amount: { type: "NUMBER", description: "Monto en unidades de la moneda (850 = 850 pesos), mayor que cero." },
        description: { type: "STRING", description: "Descripción corta, p. ej. Almuerzo." },
        category: { type: "STRING", description: "Nombre de una categoría existente del usuario, si aplica." },
        account: { type: "STRING", description: "Nombre de la cuenta (p. ej. Efectivo). Si no se dice, se usa la predeterminada." },
        date: { type: "STRING", description: "Fecha YYYY-MM-DD. Por defecto hoy." },
      },
      required: ["kind", "amount", "description"],
    },
  },
  {
    name: "propose_shared_expense",
    description:
      "Prepara un BORRADOR de gasto compartido dividido en partes iguales para que el usuario lo confirme. No guarda nada. Úsalo cuando el usuario quiera dividir un gasto con un grupo o un amigo.",
    parameters: {
      type: "OBJECT",
      properties: {
        group: { type: "STRING", description: "Nombre del grupo, o nombre del amigo para gastos directos." },
        description: { type: "STRING", description: "Descripción corta, p. ej. Cena." },
        amount: { type: "NUMBER", description: "Total del gasto en unidades de la moneda del grupo." },
        category: { type: "STRING", description: "Nombre de una categoría de gasto, si aplica." },
        date: { type: "STRING", description: "Fecha YYYY-MM-DD. Por defecto hoy." },
        participants: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Nombres de quienes comparten el gasto. Incluye 'yo' si el usuario también participa (lo normal). Si se omite, participan todos los miembros activos.",
        },
        paid_by: { type: "STRING", description: "'me' si pagó el usuario (por defecto) o el nombre de quien pagó." },
      },
      required: ["group", "description", "amount"],
    },
  },
];

// ---------------------------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------------------------
interface AccountLite {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  institution: string | null;
  last4: string | null;
  is_default: boolean;
  archived_at: string | null;
  balance: number;
}

interface CategoryLite {
  id: string;
  name: string;
  kind: "income" | "expense";
}

type GroupLite = Group & { display: string; me: GroupMember | undefined };

class DataError extends Error {}

function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw new DataError("db_error");
  return (res.data ?? []) as T;
}

const MAX_DRAFTS = 5;

export function createToolbox({ supabase, userId, today: todayInput, currency }: ToolboxOptions) {
  const today = validDate(todayInput) ?? format(new Date(), "yyyy-MM-dd");
  const drafts: Draft[] = [];
  const cache = new Map<string, Promise<unknown>>();
  const once = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key) as Promise<T>;
  };

  const accounts = () =>
    once("accounts", async (): Promise<AccountLite[]> => {
      const [rows, balances] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, name, type, currency, opening_balance, institution, last4, is_default, archived_at")
          .eq("user_id", userId)
          .order("is_default", { ascending: false })
          .order("created_at"),
        supabase.from("account_balances").select("account_id, balance").eq("user_id", userId),
      ]);
      const byId = new Map(check(balances as { data: { account_id: string; balance: number }[] | null; error: unknown }).map((b) => [b.account_id, Number(b.balance)]));
      return check(rows as { data: (Omit<AccountLite, "balance"> & { opening_balance: number })[] | null; error: unknown }).map(({ opening_balance, ...a }) => ({
        ...a,
        balance: byId.get(a.id) ?? Number(opening_balance),
      }));
    });

  const categories = () =>
    once("categories", async (): Promise<CategoryLite[]> =>
      check((await supabase.from("categories").select("id, name, kind").order("sort").order("name")) as { data: CategoryLite[] | null; error: unknown }),
    );

  /** Grupos donde el usuario es miembro activo, sin códigos de invitación ni correos. */
  const groups = () =>
    once("groups", async (): Promise<GroupLite[]> => {
      const rows = check(
        (await supabase
          .from("groups")
          .select("id, name, currency, kind, simplify_debts, created_at, archived_at, members:group_members(id, group_id, profile_id, display_name, role, left_at, created_at)")
          .order("created_at", { ascending: false })) as {
          data: (Omit<Group, "members" | "balances" | "invite_code" | "created_by"> & { members: Omit<GroupMember, "invite_email">[] })[] | null;
          error: unknown;
        },
      );
      const ids = rows.map((g) => g.id);
      const balances = ids.length
        ? check((await supabase.from("group_member_balances").select("*").in("group_id", ids)) as { data: MemberBalance[] | null; error: unknown })
        : [];
      return rows.map((g) => {
        const members: GroupMember[] = [...(g.members ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((m) => ({ ...m, invite_email: null }));
        const group: Group = {
          ...g,
          invite_code: "",
          created_by: null,
          members,
          balances: balances
            .filter((b) => b.group_id === g.id)
            .map((b) => ({
              ...b,
              paid: Number(b.paid ?? 0),
              owed: Number(b.owed ?? 0),
              settled_sent: Number(b.settled_sent ?? 0),
              settled_received: Number(b.settled_received ?? 0),
              net: Number(b.net ?? 0),
            })),
        };
        const me = myMember(group, userId);
        const other = members.find((m) => m.profile_id !== userId && !m.left_at) ?? members.find((m) => m.profile_id !== userId);
        return { ...group, me, display: g.kind === "direct" ? (other?.display_name ?? g.name) : g.name };
      });
    });

  const activeGroups = async () => (await groups()).filter((g) => g.me && !g.archived_at);

  /** Detalle para grupos sin simplificar (deudas por pareja). */
  const groupDetails = () =>
    once("groupDetails", async () => {
      const details = new Map<string, Pick<GroupDetail, "expenses" | "settlements">>();
      const raw = (await activeGroups()).filter((g) => !g.simplify_debts);
      if (!raw.length) return details;
      const ids = raw.map((g) => g.id);
      const [expenses, settlements] = await Promise.all([
        supabase.from("shared_expenses").select("id, group_id, amount, payers:expense_payers(member_id, amount), shares:expense_shares(member_id, amount)").in("group_id", ids),
        supabase.from("settlements").select("id, group_id, from_member, to_member, amount").in("group_id", ids),
      ]);
      type ExpRow = { id: string; group_id: string; amount: number; payers: { member_id: string; amount: number }[]; shares: { member_id: string; amount: number }[] };
      type SetRow = { id: string; group_id: string; from_member: string; to_member: string; amount: number };
      const exps = check(expenses as { data: ExpRow[] | null; error: unknown }).map((e) => ({
        ...e,
        amount: Number(e.amount),
        payers: (e.payers ?? []).map((p) => ({ member_id: p.member_id, amount: Number(p.amount) })),
        shares: (e.shares ?? []).map((s) => ({ member_id: s.member_id, amount: Number(s.amount) })),
      }));
      const sets = check(settlements as { data: SetRow[] | null; error: unknown }).map((s) => ({ ...s, amount: Number(s.amount) }));
      for (const id of ids) {
        details.set(id, {
          expenses: exps.filter((e) => e.group_id === id) as unknown as SharedExpense[],
          settlements: sets.filter((s) => s.group_id === id) as unknown as Settlement[],
        });
      }
      return details;
    });

  const defaultAccount = (list: AccountLite[]) => {
    const active = list.filter((a) => !a.archived_at);
    return active.find((a) => a.is_default) ?? active[0];
  };

  const memberName = (g: GroupLite, id: string) => {
    const m = g.members.find((x) => x.id === id);
    if (!m) return "Alguien";
    return m.profile_id === userId ? "Tú" : m.display_name;
  };

  // -------------------------------------------------------------------------------------------
  // Contexto para el prompt de sistema (solo nombres, sin montos)
  // -------------------------------------------------------------------------------------------
  async function contextSummary(): Promise<string> {
    // Los nombres los escriben personas (incluso otros miembros): una línea, sin marcas, acotados.
    const clean = (s: string) => s.replace(/\s+/g, " ").replace(/[<>{}\[\]`]/g, "").trim().slice(0, 60);
    const [accs, cats, grps] = await Promise.all([accounts(), categories(), activeGroups()]);
    const lines: string[] = [];
    const activeAccs = accs.filter((a) => !a.archived_at);
    lines.push(
      `Cuentas: ${activeAccs.length ? activeAccs.map((a) => `${clean(a.name)} (${TYPE_LABEL[a.type] ?? a.type}, ${a.currency}${a.is_default ? ", predeterminada" : ""})`).join("; ") : "ninguna"}.`,
    );
    lines.push(`Categorías de gasto: ${cats.filter((c) => c.kind === "expense").map((c) => clean(c.name)).join(", ") || "ninguna"}.`);
    lines.push(`Categorías de ingreso: ${cats.filter((c) => c.kind === "income").map((c) => clean(c.name)).join(", ") || "ninguna"}.`);
    const direct = grps.filter((g) => g.kind === "direct").map((g) => `${clean(g.display)} (${g.currency})`);
    const named = grps
      .filter((g) => g.kind === "group")
      .map((g) => `${clean(g.name)} (${g.currency}; con ${g.members.filter((m) => !m.left_at && m.profile_id !== userId).map((m) => clean(m.display_name)).join(", ") || "nadie más"})`);
    lines.push(`Grupos: ${named.length ? named.join("; ") : "ninguno"}.`);
    lines.push(`Amigos con gastos directos: ${direct.length ? direct.join(", ") : "ninguno"}.`);
    return lines.join("\n");
  }

  // -------------------------------------------------------------------------------------------
  // Herramientas de lectura
  // -------------------------------------------------------------------------------------------
  async function getOverview() {
    const month = monthRange(parseDate(today));
    const weekEnd = format(addDays(parseDate(today), 7), "yyyy-MM-dd");
    const [accs, flowRes, goalsRes, recurringRes, grps, details] = await Promise.all([
      accounts(),
      supabase.rpc("cashflow_by_month", { p_from: month.from, p_to: month.to }),
      supabase.from("goals").select("name, target_amount, currency, account_id, deadline, is_private").eq("status", "active").order("created_at"),
      supabase
        .from("recurring_rules")
        .select("description, kind, amount, next_run_on, account_id, frequency")
        .eq("active", true)
        .gte("next_run_on", today)
        .lte("next_run_on", weekEnd)
        .order("next_run_on")
        .limit(10),
      groups(),
      groupDetails(),
    ]);

    const active = accs.filter((a) => !a.archived_at);
    type GoalPrivacy = { account_id: string | null; is_private: boolean };
    const privateAccounts = new Set(
      ((goalsRes as { data: GoalPrivacy[] | null }).data ?? []).filter((g) => g.is_private && g.account_id).map((g) => g.account_id as string),
    );
    const netWorth = new Map<string, number>();
    for (const a of active) netWorth.set(a.currency, (netWorth.get(a.currency) ?? 0) + a.balance);

    const flow = check(flowRes as { data: { currency: string; income: number; expense: number }[] | null; error: unknown });
    const shared = computeSharedOverview(grps, userId, details);

    type GoalRow = { name: string; target_amount: number; currency: string; account_id: string | null; deadline: string | null; is_private: boolean };
    const goals = check(goalsRes as { data: GoalRow[] | null; error: unknown }).map((g) => {
      const target = Number(g.target_amount);
      const acc = g.account_id ? accs.find((a) => a.id === g.account_id) : undefined;
      const percent = acc && target > 0 ? Math.max(0, Math.min(100, Math.round((acc.balance / target) * 100))) : null;
      if (g.is_private) return { name: g.name, private: true, percent, deadline: g.deadline };
      return {
        name: g.name,
        target: fmt(target, g.currency),
        target_cents: target,
        saved: acc ? fmt(acc.balance, acc.currency) : null,
        saved_cents: acc ? acc.balance : null,
        remaining: acc ? fmt(Math.max(0, target - acc.balance), g.currency) : null,
        percent,
        linked_account: acc?.name ?? null,
        deadline: g.deadline,
        note: acc ? undefined : "Sin cuenta vinculada: no se puede medir el progreso.",
      };
    });

    type RecRow = { description: string; kind: "income" | "expense"; amount: number; next_run_on: string; account_id: string; frequency: string };
    const upcoming = check(recurringRes as { data: RecRow[] | null; error: unknown }).map((r) => {
      const acc = accs.find((a) => a.id === r.account_id);
      const cur = acc?.currency ?? currency;
      const signed = r.kind === "income" ? Number(r.amount) : -Number(r.amount);
      return { date: r.next_run_on, description: r.description, kind: KIND_LABEL[r.kind], amount: fmt(signed, cur, true), amount_cents: signed, account: acc?.name ?? null, frequency: r.frequency };
    });

    return {
      today,
      default_currency: currency,
      accounts: active.map((a) => ({
        name: a.name,
        type: TYPE_LABEL[a.type] ?? a.type,
        currency: a.currency,
        // Igual que en la app: el saldo de la cuenta de una meta privada no se muestra.
        balance: privateAccounts.has(a.id) ? "oculto (meta privada)" : fmt(a.balance, a.currency),
        balance_cents: privateAccounts.has(a.id) ? null : a.balance,
        is_default: a.is_default,
      })),
      net_worth: [...netWorth].map(([cur, total]) => ({ currency: cur, total: fmt(total, cur), total_cents: total })),
      this_month: {
        from: month.from,
        to: month.to,
        note: "Gastos incluyen solo tu parte de los gastos compartidos.",
        by_currency: flow.map((f) => {
          const income = Number(f.income);
          const expense = Number(f.expense);
          return {
            currency: f.currency,
            income: fmt(income, f.currency),
            income_cents: income,
            expense: fmt(expense, f.currency),
            expense_cents: expense,
            net: fmt(income - expense, f.currency, true),
            net_cents: income - expense,
          };
        }),
      },
      shared_totals: Object.entries(shared.totals).map(([cur, t]) => ({
        currency: cur,
        owed_to_me: fmt(t.owedToMe, cur),
        owed_to_me_cents: t.owedToMe,
        i_owe: fmt(t.iOwe, cur),
        i_owe_cents: t.iOwe,
      })),
      goals,
      upcoming_recurring_7_days: upcoming,
    };
  }

  async function listTransactions(args: Record<string, unknown>) {
    const from = validDate(args.from);
    const to = validDate(args.to);
    const limit = Math.max(1, Math.min(50, Math.round(Number(args.limit) || 20)));
    const [accs, cats] = await Promise.all([accounts(), categories()]);

    let q = supabase.from("transactions").select("occurred_on, description, kind, amount, category_id, account_id, created_at").eq("user_id", userId);
    const kind = typeof args.kind === "string" ? args.kind : "";
    if (kind === "expense") q = q.in("kind", ["expense", "shared"]);
    else if (kind === "income" || kind === "transfer" || kind === "settlement") q = q.eq("kind", kind);

    const catName = str(args.category, 40);
    let category: CategoryLite | undefined;
    if (catName) {
      const pool = kind === "income" || kind === "expense" ? cats.filter((c) => c.kind === kind) : cats;
      category = bestMatch(pool, catName, (c) => [c.name]) ?? categoryHints(catName).map((h) => bestMatch(pool, h, (c) => [c.name])).find(Boolean);
      if (!category) return { error: `No encontré la categoría "${catName}".`, available_categories: cats.map((c) => c.name) };
      q = q.eq("category_id", category.id);
    }

    const accName = str(args.account, 60);
    let account: AccountLite | undefined;
    if (accName) {
      account = findAccount(accs, accName);
      if (!account) return { error: `No encontré la cuenta "${accName}".`, available_accounts: accs.filter((a) => !a.archived_at).map((a) => a.name) };
      q = q.eq("account_id", account.id);
    }

    if (from) q = q.gte("occurred_on", from);
    if (to) q = q.lte("occurred_on", to);
    const search = str(args.search, 60).replace(/[%_,()*\\]/g, " ").trim();
    if (search) q = q.ilike("description", `%${search}%`);

    type TxRow = { occurred_on: string; description: string; kind: TxKind; amount: number; category_id: string | null; account_id: string };
    const rows = check((await q.order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(500)) as { data: TxRow[] | null; error: unknown });

    const accById = new Map(accs.map((a) => [a.id, a]));
    const catById = new Map(cats.map((c) => [c.id, c]));
    const totals = new Map<string, { income: number; expense: number }>();
    for (const r of rows) {
      const cur = accById.get(r.account_id)?.currency ?? currency;
      const t = totals.get(cur) ?? { income: 0, expense: 0 };
      const amt = Number(r.amount);
      if (r.kind === "income") t.income += amt;
      else if (r.kind === "expense" || r.kind === "shared") t.expense += -amt;
      totals.set(cur, t);
    }

    return {
      filters: { from, to, kind: kind || null, category: category?.name ?? null, account: account?.name ?? null, search: search || null },
      count: rows.length,
      showing: Math.min(limit, rows.length),
      truncated: rows.length >= 500,
      totals: [...totals].map(([cur, t]) => ({
        currency: cur,
        income: fmt(t.income, cur),
        income_cents: t.income,
        expense: fmt(t.expense, cur),
        expense_cents: t.expense,
      })),
      note: "Los gastos compartidos aparecen por lo que pagaste completo; para tu parte real usa spending_by_category.",
      transactions: rows.slice(0, limit).map((r) => {
        const acc = accById.get(r.account_id);
        const cur = acc?.currency ?? currency;
        const amt = Number(r.amount);
        return {
          date: r.occurred_on,
          description: r.description || null,
          kind: KIND_LABEL[r.kind] ?? r.kind,
          category: r.category_id ? (catById.get(r.category_id)?.name ?? null) : null,
          account: acc?.name ?? null,
          amount: units(amt),
          amount_text: fmt(amt, cur, true),
          currency: cur,
        };
      }),
    };
  }

  async function spendingByCategory(args: Record<string, unknown>) {
    const month = monthRange(parseDate(today));
    let from = validDate(args.from) ?? month.from;
    let to = validDate(args.to) ?? month.to;
    if (from > to) [from, to] = [to, from];
    const [res, cats] = await Promise.all([supabase.rpc("spending_by_category", { p_from: from, p_to: to }), categories()]);
    const rows = check(res as { data: { category_id: string | null; currency: string; total: number }[] | null; error: unknown });
    const catById = new Map(cats.map((c) => [c.id, c.name]));
    const byCur = new Map<string, { category: string; total: number }[]>();
    for (const r of rows) {
      const list = byCur.get(r.currency) ?? [];
      list.push({ category: r.category_id ? (catById.get(r.category_id) ?? "Otra") : "Sin categoría", total: Number(r.total) });
      byCur.set(r.currency, list);
    }
    return {
      from,
      to,
      note: "Incluye tus gastos propios y solo tu parte de los gastos compartidos.",
      by_currency: [...byCur].map(([cur, list]) => {
        const total = list.reduce((a, x) => a + x.total, 0);
        return {
          currency: cur,
          total: fmt(total, cur),
          total_cents: total,
          categories: list
            .sort((a, b) => b.total - a.total)
            .map((x) => ({ category: x.category, total: fmt(x.total, cur), total_cents: x.total, percent: total > 0 ? Math.round((x.total / total) * 100) : 0 })),
        };
      }),
    };
  }

  async function getSharedBalances() {
    const [grps, details] = await Promise.all([groups(), groupDetails()]);
    const overview = computeSharedOverview(grps, userId, details);
    const active = grps.filter((g) => g.me && !g.archived_at);

    return {
      totals: Object.entries(overview.totals).map(([cur, t]) => ({
        currency: cur,
        owed_to_me: fmt(t.owedToMe, cur),
        owed_to_me_cents: t.owedToMe,
        i_owe: fmt(t.iOwe, cur),
        i_owe_cents: t.iOwe,
      })),
      friends: overview.friends
        .map((f) => ({
          name: f.name,
          balances: Object.entries(f.amounts)
            .filter(([, v]) => v !== 0)
            .map(([cur, v]) => ({ currency: cur, direction: v > 0 ? "te debe" : "le debes", amount: fmt(Math.abs(v), cur), amount_cents: v })),
          groups: [...new Set(f.groups.map((g) => (g.kind === "direct" ? "directo" : g.name)))],
        }))
        .filter((f) => f.balances.length > 0),
      settled_friends: overview.friends.filter((f) => Object.values(f.amounts).every((v) => v === 0)).map((f) => f.name),
      groups: active.map((g) => {
        const detail = details.get(g.id);
        const debts: Debt[] = g.simplify_debts || !detail ? simplifyDebts(g.balances) : pairwiseDebts(detail.expenses, detail.settlements);
        const myNet = g.balances.find((b) => b.member_id === g.me?.id)?.net ?? 0;
        return {
          name: g.display,
          kind: g.kind === "direct" ? "directo" : "grupo",
          currency: g.currency,
          my_balance: fmt(myNet, g.currency, true),
          my_balance_cents: myNet,
          my_balance_meaning: myNet > 0 ? "te deben" : myNet < 0 ? "debes" : "a mano",
          members: g.members.filter((m) => !m.left_at).map((m) => (m.profile_id === userId ? "Tú" : m.display_name)),
          debts: debts.map((d) => ({ from: memberName(g, d.from), to: memberName(g, d.to), amount: fmt(d.amount, g.currency), amount_cents: d.amount })),
        };
      }),
    };
  }

  // -------------------------------------------------------------------------------------------
  // Propuestas (borradores)
  // -------------------------------------------------------------------------------------------
  function findAccount(list: AccountLite[], name: string): AccountLite | undefined {
    const active = list.filter((a) => !a.archived_at);
    const digits = name.match(/\b(\d{4})\b/)?.[1];
    if (digits) {
      const byLast4 = active.find((a) => a.last4 === digits);
      if (byLast4) return byLast4;
    }
    const byName = bestMatch(active, name, (a) => [a.name, a.institution, a.institution && `${a.institution} ${a.name}`]);
    if (byName) return byName;
    const type = accountTypeHint(name);
    if (type) return active.find((a) => a.type === type && a.is_default) ?? active.find((a) => a.type === type);
    return undefined;
  }

  function findCategory(list: CategoryLite[], kind: "income" | "expense", name: string, description: string): CategoryLite | undefined {
    const pool = list.filter((c) => c.kind === kind);
    const byHints = (text: string) => {
      for (const hint of categoryHints(text)) {
        const found = bestMatch(pool, hint, (c) => [c.name]);
        if (found) return found;
      }
      return undefined;
    };
    if (name) {
      const direct = bestMatch(pool, name, (c) => [c.name]) ?? byHints(name);
      if (direct) return direct;
    }
    return byHints(description);
  }

  async function proposeTransaction(args: Record<string, unknown>) {
    if (drafts.length >= MAX_DRAFTS) return { error: `Solo puedo preparar ${MAX_DRAFTS} borradores por mensaje.` };
    const kind = args.kind === "income" ? "income" : args.kind === "expense" ? "expense" : null;
    if (!kind) return { error: "Indica si es un gasto (expense) o un ingreso (income)." };
    const amount = toCents(args.amount);
    if (!amount) return { error: "El monto debe ser un número mayor que cero." };

    const [accs, cats] = await Promise.all([accounts(), categories()]);
    const warnings: string[] = [];
    const accName = str(args.account, 60);
    let account = accName ? findAccount(accs, accName) : undefined;
    if (accName && !account) warnings.push(`No encontré la cuenta "${accName}"; usé la predeterminada.`);
    account ??= defaultAccount(accs);
    if (!account) warnings.push("El usuario no tiene cuentas; deberá elegir una al editar.");

    const description = str(args.description);
    const category = findCategory(cats, kind, str(args.category, 40), description) ?? null;
    if (str(args.category, 40) && !category) warnings.push(`No encontré la categoría "${str(args.category, 40)}"; quedó sin categoría.`);

    const date = validDate(args.date) ?? today;
    const cur = account?.currency ?? currency;
    const draft: TransactionDraft = {
      type: "transaction",
      id: crypto.randomUUID(),
      kind,
      amount,
      currency: cur,
      description: description || category?.name || (kind === "income" ? "Ingreso" : "Gasto"),
      category_id: category?.id ?? null,
      category_name: category?.name ?? null,
      account_id: account?.id ?? null,
      account_name: account?.name ?? null,
      occurred_on: date,
    };
    drafts.push(draft);
    return {
      ok: true,
      status: "borrador_pendiente",
      draft: {
        kind: kind === "income" ? "ingreso" : "gasto",
        amount: fmt(amount, cur),
        amount_cents: amount,
        description: draft.description,
        category: draft.category_name,
        account: draft.account_name,
        date,
      },
      warnings,
      instruction: "Aún NO está guardado. Dile al usuario que revise la tarjeta y toque Confirmar.",
    };
  }

  async function proposeSharedExpense(args: Record<string, unknown>) {
    if (drafts.length >= MAX_DRAFTS) return { error: `Solo puedo preparar ${MAX_DRAFTS} borradores por mensaje.` };
    const amount = toCents(args.amount);
    if (!amount) return { error: "El monto debe ser un número mayor que cero." };
    const [grps, cats] = await Promise.all([activeGroups(), categories()]);
    if (!grps.length) return { error: "El usuario no tiene grupos ni amigos para compartir gastos. Puede crearlos en Compartido." };

    const groupName = str(args.group, 60);
    // Primero el nombre exacto del grupo/amigo directo; si no, un grupo donde esté esa persona.
    const group =
      bestMatch(grps, groupName, (g) => [g.display]) ??
      bestMatch(
        grps.filter((g) => g.kind === "group"),
        groupName,
        (g) => g.members.filter((m) => !m.left_at && m.profile_id !== userId).map((m) => m.display_name),
        70,
      );
    if (!group || !group.me) {
      return { error: `No encontré el grupo o amigo "${groupName}".`, available: grps.map((g) => (g.kind === "direct" ? `${g.display} (amigo)` : g.display)) };
    }

    const activeMembers = group.members.filter((m) => !m.left_at);
    const me = group.me;
    const findMember = (name: string): GroupMember | undefined =>
      isMeWord(name) ? me : bestMatch(activeMembers, name, (m) => [m.display_name, m.display_name.split(" ")[0]]);

    // Participantes
    const rawParticipants = Array.isArray(args.participants) ? args.participants.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 30) : [];
    let participants: GroupMember[];
    if (!rawParticipants.length || rawParticipants.some((p) => ["todos", "todo el grupo", "all", "everyone"].includes(norm(p)))) {
      participants = activeMembers;
    } else {
      const found = new Map<string, GroupMember>();
      const missing: string[] = [];
      for (const p of rawParticipants) {
        const m = findMember(p);
        if (m) found.set(m.id, m);
        else missing.push(p);
      }
      if (missing.length) {
        return { error: `No encontré a ${missing.join(", ")} en ${group.display}.`, members: activeMembers.map((m) => (m.id === me.id ? "yo" : m.display_name)) };
      }
      // Orden estable según el grupo.
      participants = activeMembers.filter((m) => found.has(m.id));
    }
    if (!participants.length) return { error: "Indica al menos una persona para dividir el gasto." };

    // Quién pagó
    const paidByRaw = str(args.paid_by, 60);
    const payer = !paidByRaw || isMeWord(paidByRaw) ? me : findMember(paidByRaw);
    if (!payer) return { error: `No encontré a "${paidByRaw}" en ${group.display}.`, members: activeMembers.map((m) => (m.id === me.id ? "yo" : m.display_name)) };

    const description = str(args.description) || "Gasto compartido";
    const category = findCategory(cats, "expense", str(args.category, 40), description) ?? null;
    const date = validDate(args.date) ?? today;
    const portions = splitEqual(amount, participants.map((m) => m.id));
    const nameOf = (m: GroupMember) => (m.id === me.id ? "Tú" : m.display_name);
    const shares: DraftShare[] = portions.map((p) => {
      const m = participants.find((x) => x.id === p.member_id)!;
      return { member_id: p.member_id, name: nameOf(m), amount: p.amount, is_me: m.id === me.id };
    });

    const draft: SharedExpenseDraft = {
      type: "shared_expense",
      id: crypto.randomUUID(),
      group_id: group.id,
      group_name: group.display,
      currency: group.currency,
      description,
      amount,
      category_id: category?.id ?? null,
      category_name: category?.name ?? null,
      occurred_on: date,
      payer_member_id: payer.id,
      payer_name: nameOf(payer),
      payer_is_me: payer.id === me.id,
      shares,
    };
    drafts.push(draft);
    return {
      ok: true,
      status: "borrador_pendiente",
      draft: {
        group: group.display,
        kind: group.kind === "direct" ? "gasto directo con un amigo" : "gasto de grupo",
        amount: fmt(amount, group.currency),
        amount_cents: amount,
        description,
        category: draft.category_name,
        date,
        paid_by: draft.payer_name,
        split: shares.map((s) => ({ name: s.name, amount: fmt(s.amount, group.currency) })),
      },
      instruction: "Aún NO está guardado. Dile al usuario que revise la tarjeta y toque Confirmar.",
    };
  }

  // -------------------------------------------------------------------------------------------
  async function execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      switch (name) {
        case "get_overview":
          return await getOverview();
        case "list_transactions":
          return await listTransactions(args);
        case "spending_by_category":
          return await spendingByCategory(args);
        case "get_shared_balances":
          return await getSharedBalances();
        case "propose_transaction":
          return await proposeTransaction(args);
        case "propose_shared_expense":
          return await proposeSharedExpense(args);
        default:
          return { error: `La herramienta ${name} no existe.` };
      }
    } catch {
      return { error: "No pude leer tus datos ahora. Intenta de nuevo." };
    }
  }

  return { drafts, today, declarations: TOOL_DECLARATIONS, execute, contextSummary };
}

export type Toolbox = ReturnType<typeof createToolbox>;
