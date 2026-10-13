// Fechas de una tarjeta de crédito a partir del día de corte y el día límite de pago.
// Trabaja con fechas YYYY-MM-DD sin horas para no depender de la zona horaria.

type YMD = { y: number; m: number; d: number }; // m: 0-11

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const parse = (iso: string): YMD => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1, d: Number(iso.slice(8, 10)) });
const iso = ({ y, m, d }: YMD) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const cmp = (a: YMD, b: YMD) => a.y - b.y || a.m - b.m || a.d - b.d;

/** Ese día del mes; si el mes es más corto, su último día. */
function on(y: number, m: number, day: number): YMD {
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return { y: yy, m: mm, d: Math.min(day, daysIn(yy, mm)) };
}

/** Primer corte en o después de `from`. */
function cutOnOrAfter(day: number, from: YMD): YMD {
  const here = on(from.y, from.m, day);
  return cmp(here, from) >= 0 ? here : on(from.y, from.m + 1, day);
}

/** Último corte antes de `from`. */
function cutBefore(day: number, from: YMD): YMD {
  const here = on(from.y, from.m, day);
  return cmp(here, from) < 0 ? here : on(from.y, from.m - 1, day);
}

/** Fecha límite del estado que cierra en `cut`: el primer día de pago después del corte. */
function dueAfter(day: number, cut: YMD): YMD {
  const here = on(cut.y, cut.m, day);
  return cmp(here, cut) > 0 ? here : on(cut.y, cut.m + 1, day);
}

export interface CardDates {
  /** Próximo corte (hoy incluido). */
  nextStatement: string | null;
  /** Próxima fecha límite de pago pendiente (hoy incluido). */
  nextDue: string | null;
}

export function cardDates(statementDay: number | null | undefined, dueDay: number | null | undefined, today: string): CardDates {
  const t = parse(today);
  const nextCut = statementDay ? cutOnOrAfter(statementDay, t) : null;
  let nextDue: YMD | null = null;
  if (dueDay) {
    if (statementDay) {
      // El pago del último estado ya cerrado; si ya pasó, el del próximo corte.
      const pending = dueAfter(dueDay, cutBefore(statementDay, t));
      nextDue = cmp(pending, t) >= 0 ? pending : dueAfter(dueDay, nextCut!);
    } else {
      nextDue = cutOnOrAfter(dueDay, t);
    }
  }
  return { nextStatement: nextCut && iso(nextCut), nextDue: nextDue && iso(nextDue) };
}

/** Días desde hoy hasta `date` (0 = hoy). */
export function daysUntil(date: string, today: string): number {
  const a = parse(today);
  const b = parse(date);
  return Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86_400_000);
}

export function inDays(n: number): string {
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  return `en ${n} días`;
}
