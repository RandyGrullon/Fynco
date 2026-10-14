// Motor del plan: tu dinero, quincenas, presupuesto, cortes de tarjeta, cuotas y la línea de
// tiempo día a día. Puro: lo usan la pantalla /plan, Inicio y el asistente.
import { cutFor, firstDayAfter, lastCutOnOrBefore, nextCut } from "@/lib/card-dates";
import { shortDate } from "@/lib/dates";
import { addDaysISO, daysInclusive, occurrences } from "./recurring";
import type { BudgetRow, CardCycle, CardGroup, OtherDebtRow, PeriodSummary, PlanAccount, PlanEvent, PlanInput, PlanResult, Rich } from "./types";

const LIQUID = new Set(["checking", "savings", "cash"]);
const ROUND_TO = 5000; // los presupuestos de quincena se redondean a 50

type Fx = { toMain: (amount: number, currency: string) => number; convert: (amount: number, from: string, to: string) => number; rate: (currency: string) => number };

function makeFx(main: string, rates: Record<string, number>, missing: Set<string>): Fx {
  const rate = (cur: string) => {
    if (cur === main) return 1;
    const r = Number(rates[cur]);
    if (r > 0) return r;
    missing.add(cur);
    return 1;
  };
  return {
    rate,
    toMain: (amount, cur) => Math.round(amount * rate(cur)),
    convert: (amount, from, to) => (from === to ? amount : Math.round((amount * rate(from)) / rate(to))),
  };
}

/** Reparte un monto por igual entre días (el resto, al último). */
function spread(total: number, days: string[]): { date: string; amount: number }[] {
  if (!days.length || total <= 0) return [];
  const base = Math.floor(total / days.length);
  return days.map((date, i) => ({ date, amount: i === days.length - 1 ? total - base * (days.length - 1) : base }));
}

function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 800; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/** Nombre común de las tarjetas con el mismo last4 ("Visa 3001 RD$" + "Visa 3001 US$" → "Visa 3001"). */
function commonName(names: string[]): string {
  if (names.length === 1) return names[0];
  let prefix = names[0];
  for (const n of names.slice(1)) while (!n.startsWith(prefix)) prefix = prefix.slice(0, -1);
  const clean = prefix.replace(/[\s·\-–(]+$/, "").trim();
  return clean.length >= 3 ? clean : names[0];
}

const rangeLabel = (start: string, end: string) => (start === end ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`);

export function buildPlan(input: PlanInput): PlanResult {
  const { today, currency: main, settings } = input;
  const missingRates = new Set<string>();
  const fx = makeFx(main, settings.rates ?? {}, missingRates);
  const horizonEnd = addDaysISO(today, Math.max(14, settings.horizon_days || 100));
  const monthStart = `${today.slice(0, 8)}01`;

  const accounts = input.accounts.filter((a) => !a.archived_at);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const isLiquid = (id: string | null | undefined) => Boolean(id && LIQUID.has(byId.get(id)?.type ?? ""));
  const curOf = (id: string) => byId.get(id)?.currency ?? main;
  const nameOf = (id: string | null | undefined) => (id ? (byId.get(id)?.name ?? "Cuenta") : "Cuenta");
  const defaultLiquid = accounts.find((a) => a.is_default && LIQUID.has(a.type)) ?? accounts.find((a) => LIQUID.has(a.type) && a.currency === main) ?? accounts.find((a) => LIQUID.has(a.type));

  // ---------------- Tu dinero ----------------
  const liquid = accounts.filter((a) => LIQUID.has(a.type)).reduce((n, a) => n + fx.toMain(a.balance, a.currency), 0);
  const reservedAccounts = accounts
    .filter((a) => a.type === "other" && a.reserved && a.balance < 0)
    .map((a) => ({ id: a.id, name: a.name, amount: -a.balance, currency: a.currency }));
  const reserved = reservedAccounts.reduce((n, a) => n + fx.toMain(a.amount, a.currency), 0);
  const myMoney = liquid - reserved;

  // ---------------- Quincenas ----------------
  const salary = new Set(input.salaryCategoryIds);
  const salaryRules = input.recurring.filter((r) => r.active && r.kind === "income" && r.category_id && salary.has(r.category_id) && isLiquid(r.account_id));
  let paydays = [...new Set(salaryRules.flatMap((r) => occurrences(r, today, horizonEnd)))].sort();
  let paydaysFrom: "rules" | "default" = "rules";
  let start: string;
  if (paydays.length) {
    // La quincena actual empieza en el último cobro registrado (si fue hace menos de un mes).
    const lastPaid = input.transactions
      .filter((t) => t.kind === "income" && t.amount > 0 && t.category_id && salary.has(t.category_id) && isLiquid(t.account_id) && t.occurred_on <= today && t.occurred_on >= addDaysISO(today, -31))
      .map((t) => t.occurred_on)
      .sort()
      .pop();
    start = lastPaid ?? today;
  } else {
    paydaysFrom = "default";
    paydays = dateRange(addDaysISO(today, 1), horizonEnd).filter((d) => d.endsWith("-01") || d.endsWith("-16"));
    const d = Number(today.slice(8, 10));
    start = `${today.slice(0, 8)}${d >= 16 ? "16" : "01"}`;
  }
  const boundaries = [start, ...paydays.filter((p) => p > start)];
  const quincenas: { start: string; end: string }[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) quincenas.push({ start: boundaries[i], end: addDaysISO(boundaries[i + 1], -1) });
  const lastPayday = boundaries[boundaries.length - 1];

  // Los periodos (viajes) se sacan de las quincenas y forman su propia fila.
  const periods = input.periods.filter((p) => p.end_on >= start && p.start_on <= horizonEnd).sort((a, b) => a.start_on.localeCompare(b.start_on));
  const inPeriod = (d: string) => periods.find((p) => d >= p.start_on && d <= p.end_on);
  const homeSegments: { start: string; end: string }[] = [];
  for (const q of quincenas) {
    let segStart: string | null = null;
    for (const d of dateRange(q.start, q.end)) {
      if (inPeriod(d)) {
        if (segStart) homeSegments.push({ start: segStart, end: addDaysISO(d, -1) });
        segStart = null;
      } else if (!segStart) segStart = d;
    }
    if (segStart) homeSegments.push({ start: segStart, end: q.end });
  }

  // ---------------- Presupuesto y gastado ----------------
  const excluded = new Set(settings.excluded_category_ids ?? []);
  const daily = settings.monthly_budget ? (settings.monthly_budget * 12) / 365 : 0;
  const spentIn = (from: string, to: string, respectExcluded: boolean) => {
    const until = to < today ? to : today;
    if (from > until) return 0;
    let total = 0;
    for (const t of input.transactions) {
      if (t.kind !== "expense" || t.amount >= 0 || t.recurring_rule_id || t.debt_id) continue;
      if (t.occurred_on < from || t.occurred_on > until) continue;
      if (respectExcluded && t.category_id && excluded.has(t.category_id)) continue;
      total += fx.toMain(-t.amount, curOf(t.account_id));
    }
    for (const s of input.shares) {
      if (s.occurred_on < from || s.occurred_on > until) continue;
      if (respectExcluded && s.category_id && excluded.has(s.category_id)) continue;
      total += fx.toMain(s.amount, s.currency);
    }
    return total;
  };

  const budgetRows: BudgetRow[] = homeSegments.map((s) => {
    const days = daysInclusive(s.start, s.end);
    const budget = Math.round((daily * days) / ROUND_TO) * ROUND_TO;
    const spent = spentIn(s.start, s.end, true);
    return { key: `h-${s.start}`, kind: "home", label: rangeLabel(s.start, s.end), start: s.start, end: s.end, days, budget, spent, left: budget - spent, current: s.start <= today && today <= s.end };
  });
  for (const p of periods) {
    const budget = fx.toMain(p.budget, p.currency);
    const spent = spentIn(p.start_on, p.end_on, false);
    budgetRows.push({
      key: `p-${p.id}`,
      kind: "period",
      label: p.name,
      start: p.start_on,
      end: p.end_on,
      days: daysInclusive(p.start_on, p.end_on),
      budget,
      spent,
      left: budget - spent,
      current: p.start_on <= today && today <= p.end_on,
    });
  }
  budgetRows.sort((a, b) => a.start.localeCompare(b.start));
  const currentRow = budgetRows.find((r) => r.current) ?? null;

  // ---------------- Estimados del día a día ----------------
  // Lo que queda de cada fila se reparte por igual entre sus días que faltan.
  type Charge = { date: string; accountId: string | null; amount: number; label: string };
  const charges: Charge[] = [];
  const homeTarget = settings.budget_account_id ?? defaultLiquid?.id ?? null;
  for (const row of budgetRows) {
    if (row.end < today) continue;
    const from = row.current ? addDaysISO(today, 1) : row.start;
    const days = dateRange(from, row.end);
    const remaining = row.current ? Math.max(0, row.left) : row.budget;
    if (row.kind === "home") {
      for (const c of spread(remaining, days)) charges.push({ ...c, accountId: homeTarget, label: "Día a día (estimado)" });
    } else {
      const p = periods.find((x) => `p-${x.id}` === row.key)!;
      const cashShare = p.budget > 0 ? Math.min(1, (p.cash_amount ?? 0) / p.budget) : 0;
      const cash = Math.round(remaining * cashShare);
      for (const c of spread(cash, days)) charges.push({ ...c, accountId: null, label: `${p.name}: efectivo (estimado)` });
      for (const c of spread(remaining - cash, days)) charges.push({ ...c, accountId: p.account_id ?? homeTarget, label: `${p.name} (estimado)` });
    }
  }
  // Después del último cobro planificado, el día a día sigue al mismo ritmo hasta el final del plan.
  if (daily > 0 && lastPayday <= horizonEnd) {
    const tail = dateRange(lastPayday, horizonEnd).filter((d) => d > today && !inPeriod(d));
    for (const d of tail) charges.push({ date: d, accountId: homeTarget, amount: Math.round(daily), label: "Día a día (estimado)" });
  }

  // ---------------- Eventos ----------------
  const events: PlanEvent[] = [];
  let seq = 0;
  const push = (e: Omit<PlanEvent, "id" | "balance">) => events.push({ ...e, id: `e${seq++}`, balance: null });

  // Recurrentes: cobros, compras planificadas y transferencias (cuotas, ahorro, efectivo).
  const cardRecurring = new Map<string, { date: string; amount: number }[]>();
  for (const r of input.recurring) {
    if (!r.active) continue;
    const acc = byId.get(r.account_id);
    if (!acc) continue;
    for (const date of occurrences(r, today, horizonEnd)) {
      if (r.kind === "income") {
        if (!LIQUID.has(acc.type)) continue;
        push({ date, type: "income", label: r.description, with: `Entra a ${acc.name}`, effect: fx.toMain(r.amount, acc.currency), amount: r.amount, currency: acc.currency, past: false, accountIds: [acc.id], action: { kind: "recurring", ruleId: r.id } });
      } else if (r.kind === "expense") {
        if (acc.type === "credit") {
          const list = cardRecurring.get(acc.id) ?? [];
          list.push({ date, amount: r.amount });
          cardRecurring.set(acc.id, list);
        } else if (LIQUID.has(acc.type)) {
          push({ date, type: "purchase", label: r.description, with: `Sale de ${acc.name}`, effect: -fx.toMain(r.amount, acc.currency), amount: -r.amount, currency: acc.currency, past: false, accountIds: [acc.id], action: { kind: "recurring", ruleId: r.id } });
        }
      } else if (r.kind === "transfer" && r.to_account_id) {
        const to = byId.get(r.to_account_id);
        if (!to) continue;
        const fromL = LIQUID.has(acc.type);
        const toL = LIQUID.has(to.type);
        const effect = fromL && !toL ? -fx.toMain(r.amount, acc.currency) : !fromL && toL ? fx.toMain(r.amount, acc.currency) : 0;
        const type = to.type === "other" ? "debt" : to.type === "credit" ? "card" : "transfer";
        push({
          date,
          type,
          label: r.description,
          with: `${acc.name} → ${to.name}`,
          effect,
          amount: effect === 0 ? r.amount : Math.sign(effect) * r.amount,
          currency: acc.currency,
          past: false,
          accountIds: [acc.id, to.id],
          action: { kind: "transfer", from: acc.id, to: to.id, amount: r.amount, description: r.description },
        });
      }
    }
  }

  // Estimados que caen en cuentas líquidas (o en efectivo) mueven tu dinero; los de tarjeta van a sus cortes.
  const cardCharges = new Map<string, { date: string; amount: number }[]>();
  for (const c of charges) {
    const acc = c.accountId ? byId.get(c.accountId) : undefined;
    if (acc?.type === "credit") {
      const list = cardCharges.get(acc.id) ?? [];
      list.push({ date: c.date, amount: fx.convert(c.amount, main, acc.currency) });
      cardCharges.set(acc.id, list);
    } else if (!acc || LIQUID.has(acc.type)) {
      push({ date: c.date, type: "estimate", label: c.label, with: acc ? `Sale de ${acc.name}` : "Efectivo", effect: -c.amount, amount: -c.amount, currency: main, past: false, accountIds: acc ? [acc.id] : [] });
    }
  }

  // ---------------- Tarjetas ----------------
  const credit = accounts.filter((a) => a.type === "credit");
  const groups = new Map<string, PlanAccount[]>();
  for (const a of credit) {
    const key = a.last4 ? `l4-${a.last4}` : a.id;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const cards: CardGroup[] = [];
  for (const [key, members] of groups) {
    members.sort((a, b) => (a.currency === main ? -1 : b.currency === main ? 1 : 0));
    const fromAcc = members.map((m) => (m.pay_from_account_id ? byId.get(m.pay_from_account_id) : undefined)).find(Boolean) ?? defaultLiquid;
    const fromCur = fromAcc?.currency ?? main;
    const name = commonName(members.map((m) => m.name));
    const byPayDate = new Map<string, CardCycle & { parts: { accountId: string; name: string; amount: number; currency: string }[] }>();
    let missing = false;

    for (const m of members) {
      const S = m.statement_day;
      const payDay = m.pay_day ?? m.payment_due_day;
      const dueDay = m.payment_due_day ?? m.pay_day;
      if (!S || !payDay || !dueDay) {
        missing = true;
        continue;
      }
      const debt = Math.max(0, -m.balance);
      const c0 = lastCutOnOrBefore(today, S);
      const txs = input.transactions.filter((t) => t.account_id === m.id && t.amount < 0);
      const chargedAfter = txs.filter((t) => t.occurred_on > c0).reduce((n, t) => n + -t.amount, 0);
      const cycles: CardCycle[] = [];
      // Corte cerrado: lo que se debe menos lo consumido después.
      const closedPending = Math.max(0, debt - chargedAfter);
      const pay0 = firstDayAfter(c0, payDay);
      const due0 = firstDayAfter(c0, dueDay);
      if (closedPending > 0) {
        cycles.push({ cut: c0, payDate: pay0 < today ? today : pay0, dueDate: due0, charged: closedPending, upcoming: 0, total: closedPending, closed: true, overdue: due0 < today });
      }
      // Cortes abiertos y futuros.
      let prev = c0;
      for (let k = 1; k <= 24; k++) {
        const cut = nextCut(prev, S);
        const payDate = firstDayAfter(cut, payDay);
        if (payDate > horizonEnd) break;
        const inCycle = (d: string) => d > prev && d <= cut;
        const charged = k === 1 ? chargedAfter : 0;
        const upcoming =
          (cardRecurring.get(m.id) ?? []).filter((x) => inCycle(x.date)).reduce((n, x) => n + x.amount, 0) +
          (cardCharges.get(m.id) ?? []).filter((x) => inCycle(x.date)).reduce((n, x) => n + x.amount, 0);
        if (charged + upcoming > 0) cycles.push({ cut, payDate, dueDate: firstDayAfter(cut, dueDay), charged, upcoming, total: charged + upcoming, closed: false, overdue: false });
        prev = cut;
      }
      // Doble saldo: lo de la misma fecha se paga junto, convertido a la moneda de la cuenta que paga.
      for (const c of cycles) {
        const slot = byPayDate.get(c.payDate) ?? { ...c, charged: 0, upcoming: 0, total: 0, parts: [] };
        slot.charged += fx.convert(c.charged, m.currency, fromCur);
        slot.upcoming += fx.convert(c.upcoming, m.currency, fromCur);
        slot.total += fx.convert(c.total, m.currency, fromCur);
        slot.overdue ||= c.overdue;
        slot.closed ||= c.closed;
        if (c.cut < slot.cut) slot.cut = c.cut;
        slot.parts.push({ accountId: m.id, name: m.name, amount: c.total, currency: m.currency });
        byPayDate.set(c.payDate, slot);
      }
    }

    const merged = [...byPayDate.values()].sort((a, b) => a.payDate.localeCompare(b.payDate));
    cards.push({
      key,
      name,
      last4: members[0].last4,
      accounts: members.map((m) => ({ id: m.id, name: m.name, currency: m.currency, debt: Math.max(0, -m.balance), limit: m.credit_limit ?? null })),
      fromId: fromAcc?.id ?? null,
      fromName: fromAcc?.name ?? "tu cuenta predeterminada",
      currency: fromCur,
      cycles: merged.map(({ parts: _parts, ...c }) => c),
      missing,
    });
    for (const c of merged) {
      if (c.total <= 0) continue;
      const main_ = members.find((m) => m.currency === fromCur) ?? members[0];
      const part = c.parts.find((p) => p.accountId === main_.id);
      push({
        date: c.payDate,
        type: "card",
        label: `Pago ${name}`,
        with: `${fromAcc?.name ?? "Cuenta"} → ${name}`,
        effect: fromAcc && LIQUID.has(fromAcc.type) ? -fx.toMain(c.total, fromCur) : 0,
        amount: -c.total,
        currency: fromCur,
        past: false,
        accountIds: [...members.map((m) => m.id), ...(fromAcc ? [fromAcc.id] : [])],
        dueDate: c.dueDate,
        overdue: c.overdue,
        parts: c.parts.length > 1 ? c.parts : undefined,
        action: { kind: "card_payment", cardId: main_.id, amount: part?.amount ?? c.total, fromId: fromAcc?.id ?? null },
      });
    }
  }

  // ---------------- Deudas con personas (módulo Deudas) ----------------
  for (const d of input.debts) {
    if (d.remaining <= 0) continue;
    const acc = d.account_id && isLiquid(d.account_id) ? byId.get(d.account_id) : defaultLiquid;
    for (const c of d.installments) {
      if (c.pending <= 0) continue;
      const date = c.due_on < today ? today : c.due_on;
      if (date > horizonEnd) continue;
      const borrowed = d.direction === "borrowed";
      const effect = acc && acc.currency ? (borrowed ? -1 : 1) * fx.toMain(c.pending, d.currency) : 0;
      push({
        date,
        type: "debt",
        label: borrowed ? `Cuota a ${d.person}` : `Cobro a ${d.person}`,
        with: borrowed ? `${acc?.name ?? "Cuenta"} → ${d.person}` : `${d.person} → ${acc?.name ?? "Cuenta"}`,
        effect,
        amount: (borrowed ? -1 : 1) * c.pending,
        currency: d.currency,
        past: false,
        overdue: c.due_on < today,
        accountIds: acc ? [acc.id] : [],
        action: { kind: "debt", debtId: d.id },
      });
    }
  }

  // ---------------- Lo que ya pasó este mes (atenuado, no mueve el saldo) ----------------
  const pastTx = input.transactions.filter((t) => t.occurred_on >= monthStart && t.occurred_on < today);
  for (const t of pastTx) {
    if (t.kind === "income" && t.category_id && salary.has(t.category_id) && isLiquid(t.account_id)) {
      push({ date: t.occurred_on, type: "income", label: t.description || "Cobro", with: `Entró a ${nameOf(t.account_id)}`, effect: 0, amount: t.amount, currency: curOf(t.account_id), past: true, accountIds: [t.account_id] });
    } else if (t.kind === "expense" && t.recurring_rule_id && isLiquid(t.account_id)) {
      push({ date: t.occurred_on, type: "purchase", label: t.description, with: `Salió de ${nameOf(t.account_id)}`, effect: 0, amount: t.amount, currency: curOf(t.account_id), past: true, accountIds: [t.account_id] });
    } else if (t.kind === "transfer" && t.transfer_id && t.amount > 0) {
      const out = pastTx.find((x) => x.transfer_id === t.transfer_id && x.amount < 0);
      const to = byId.get(t.account_id);
      if (!out || !to || !isLiquid(out.account_id) || (to.type !== "credit" && to.type !== "other")) continue;
      push({
        date: t.occurred_on,
        type: to.type === "credit" ? "card" : "debt",
        label: to.type === "credit" ? `Pago ${to.name}` : t.description || `Cuota ${to.name}`,
        with: `${nameOf(out.account_id)} → ${to.name}`,
        effect: 0,
        amount: out.amount,
        currency: curOf(out.account_id),
        past: true,
        accountIds: [out.account_id, to.id],
      });
    }
  }

  // ---------------- Línea de tiempo ----------------
  // Mismo día: primero lo que entra, después lo que sale.
  events.sort((a, b) => a.date.localeCompare(b.date) || Number(b.past) - Number(a.past) || Math.sign(b.effect) - Math.sign(a.effect) || (a.type === "estimate" ? 1 : 0) - (b.type === "estimate" ? 1 : 0));
  let balance = myMoney;
  let low = { date: today, balance: myMoney };
  for (const e of events) {
    if (e.past) continue;
    balance += e.effect;
    e.balance = balance;
    if (balance < low.balance) low = { date: e.date, balance };
  }
  const endBalance = balance;
  const series: { date: string; balance: number }[] = [];
  {
    let b = myMoney;
    const future = events.filter((e) => !e.past);
    let i = 0;
    for (const d of dateRange(today, horizonEnd)) {
      while (i < future.length && future[i].date === d) b += future[i++].effect;
      series.push({ date: d, balance: b });
    }
  }

  // ---------------- Deudas (cuentas other en cuotas y módulo Deudas) ----------------
  const futureEvents = events.filter((e) => !e.past);
  const installmentDebts: OtherDebtRow[] = accounts
    .filter((a) => a.type === "other" && !a.reserved && a.balance < 0)
    .map((a) => {
      const owed = -a.balance;
      const pays = futureEvents.filter((e) => e.type === "debt" && e.action?.kind === "transfer" && e.action.to === a.id);
      let acc = 0;
      let payoff: string | null = null;
      for (const p of pays) {
        acc += Math.abs(p.amount);
        if (!payoff && acc >= owed) payoff = p.date;
      }
      return { id: a.id, name: a.name, source: "account" as const, amount: owed, currency: a.currency, next: pays.slice(0, 3).map((p) => ({ date: p.date, amount: Math.abs(p.amount) })), payoff, leftAtEnd: Math.max(0, owed - acc) };
    });
  for (const d of input.debts) {
    if (d.direction !== "borrowed" || d.remaining <= 0) continue;
    const pend = d.installments.filter((c) => c.pending > 0);
    const inPlan = pend.filter((c) => c.due_on <= horizonEnd);
    const paidInPlan = inPlan.reduce((n, c) => n + c.pending, 0);
    installmentDebts.push({
      id: d.id,
      name: d.person,
      source: "debt",
      amount: d.remaining,
      currency: d.currency,
      next: pend.slice(0, 3).map((c) => ({ date: c.due_on, amount: c.pending })),
      payoff: paidInPlan >= d.remaining ? (inPlan[inPlan.length - 1]?.due_on ?? null) : null,
      leftAtEnd: Math.max(0, d.remaining - paidInPlan),
    });
  }
  const debts = installmentDebts.reduce((n, d) => n + fx.toMain(d.amount, d.currency), 0);

  // ---------------- Periodos ----------------
  const periodSummaries: PeriodSummary[] = periods.map((p) => {
    const row = budgetRows.find((r) => r.key === `p-${p.id}`)!;
    const toCur = (x: number) => fx.convert(x, main, p.currency);
    const spent = toCur(row.spent);
    const left = p.budget - spent;
    const daysLeft = p.start_on > today ? row.days : Math.max(1, daysInclusive(today, p.end_on));
    return {
      id: p.id,
      name: p.name,
      start: p.start_on,
      end: p.end_on,
      currency: p.currency,
      budget: p.budget,
      spent,
      left,
      perDay: p.end_on < today ? 0 : Math.round(Math.max(0, left) / daysLeft),
      cash: p.cash_amount ?? 0,
      card: p.budget - (p.cash_amount ?? 0),
      cardName: p.account_id ? nameOf(p.account_id) : homeTarget ? nameOf(homeTarget) : null,
    };
  });

  // ---------------- Cifras ----------------
  const nextCardEvent = futureEvents.find((e) => e.type === "card" && e.amount < 0 && e.action?.kind === "card_payment");
  const nextCard = nextCardEvent
    ? { amount: -nextCardEvent.amount, currency: nextCardEvent.currency, date: nextCardEvent.date, dueDate: nextCardEvent.dueDate ?? nextCardEvent.date, name: nextCardEvent.label.replace(/^Pago /, ""), from: nextCardEvent.with.split(" → ")[0] }
    : null;
  const canSpend = currentRow ? { amount: currentRow.left, end: currentRow.end, label: currentRow.kind === "period" ? currentRow.label : rangeLabel(currentRow.start, currentRow.end) } : null;

  // ---------------- Resumen y supuestos ----------------
  const money = (amount: number) => ({ amount, currency: main });
  const summary: Rich = ["Tu dinero hoy es ", money(myMoney)];
  if (reserved > 0) summary.push("; lo prestado (", money(reserved), ") no se toca");
  summary.push(".");
  const nextPeriod = periods.find((p) => p.start_on > today && p.start_on <= horizonEnd);
  if (nextPeriod) {
    const before = series.find((s) => s.date === addDaysISO(nextPeriod.start_on, -1))?.balance ?? myMoney;
    const after = series.find((s) => s.date === nextPeriod.end_on)?.balance ?? endBalance;
    summary.push(` Sales a ${nextPeriod.name.toLowerCase()} con `, money(before), ` y llegas al ${shortDate(nextPeriod.end_on)} con `, money(after), ".");
  } else {
    summary.push(` Al ${shortDate(horizonEnd)} tendrías `, money(endBalance), ".");
  }
  const cushion = settings.cushion ?? 0;
  const belowCushion = low.balance < cushion;
  if (belowCushion) summary.push(` Ojo: el ${shortDate(low.date)} bajas a `, money(low.balance), cushion > 0 ? ", por debajo de tu colchón." : ".");

  const assumptions: Rich[] = [];
  const rateList = Object.entries(settings.rates ?? {}).filter(([, v]) => Number(v) > 0);
  if (rateList.length) assumptions.push([`Tasas: ${rateList.map(([c, v]) => `1 ${c} = ${main} ${v}`).join(", ")}.`]);
  if (missingRates.size) assumptions.push([`Falta la tasa de ${[...missingRates].join(", ")}: se tomó 1 a 1. Agrégala en Ajustes del plan.`]);
  if (settings.monthly_budget) {
    assumptions.push(["Día a día: ", money(settings.monthly_budget), " al mes (", money(Math.round(daily)), ` por día)${homeTarget ? `, cargado a ${nameOf(homeTarget)}` : ""}. Lo que queda de cada quincena se reparte por igual entre sus días.`]);
  } else {
    assumptions.push(["Sin presupuesto del día a día: el plan no estima gastos diarios. Ponlo en Ajustes del plan."]);
  }
  assumptions.push([paydaysFrom === "rules" ? "Las quincenas van de un cobro de Salario al siguiente (tus recurrentes)." : "No hay cobros de Salario planificados: las quincenas van del 1 y del 16."]);
  if (excluded.size) assumptions.push([`No cuentan para el presupuesto ${excluded.size === 1 ? "1 categoría excluida" : `${excluded.size} categorías excluidas`}.`]);
  assumptions.push(["Cada tarjeta se paga en su día de pago (o la fecha límite) desde la cuenta indicada (o la predeterminada). Un consumo entra en el corte de ese día o el siguiente."]);
  if (reserved > 0) assumptions.push(["Lo prestado que se devuelve completo (", money(reserved), ") no cuenta como tuyo."]);
  if (cards.some((c) => c.missing)) assumptions.push(["Hay tarjetas sin día de corte o de pago: su pago no se programa."]);
  assumptions.push([`El plan llega hasta el ${shortDate(horizonEnd)}. No incluye gastos que no estén planificados.`]);

  return {
    today,
    horizonEnd,
    currency: main,
    liquid,
    reserved,
    myMoney,
    canSpend,
    nextCard,
    debts,
    endBalance,
    low,
    cushion,
    belowCushion,
    events,
    series,
    cards,
    budgetRows,
    periods: periodSummaries,
    reservedAccounts,
    installmentDebts,
    summary,
    assumptions,
    paydaysFrom,
    hasBudget: Boolean(settings.monthly_budget),
  };
}

/** Corte al que entra un consumo con esa tarjeta y cuándo se paga (para explicarlo en la pantalla y en pruebas). */
export function chargeSchedule(card: Pick<PlanAccount, "statement_day" | "pay_day" | "payment_due_day">, date: string): { cut: string; payDate: string } | null {
  const payDay = card.pay_day ?? card.payment_due_day;
  if (!card.statement_day || !payDay) return null;
  const cut = cutFor(date, card.statement_day);
  return { cut, payDate: firstDayAfter(cut, payDay) };
}
