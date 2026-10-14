import { MESES, dia, miles, redondear } from "./motor";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** RD$ 34,695 (sin decimales). */
export function rd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const v = redondear(n);
  return v < 0 ? `−RD$ ${miles(-v)}` : `RD$ ${miles(v)}`;
}

/** +33,900 / −10,000 */
export function conSigno(n: number): string {
  const v = redondear(n);
  if (v > 0) return `+${miles(v)}`;
  if (v < 0) return `−${miles(-v)}`;
  return "0";
}

/** Monto en su moneda: RD$ 748.80, US$ 47.49, € 124. */
export function enMoneda(monto: number, moneda: string): string {
  const s = Number.isInteger(monto) ? miles(monto) : monto.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (moneda === "USD") return `US$ ${s}`;
  if (moneda === "EUR") return `€ ${s}`;
  return `RD$ ${s}`;
}

/** "16 oct" o "vie 16 oct". */
export function fechaCorta(isoFecha: string, conDia = false): string {
  const n = dia(isoFecha);
  const f = new Date(n * 86_400_000);
  const base = `${f.getUTCDate()} ${MESES[f.getUTCMonth()]}`;
  return conDia ? `${DIAS[f.getUTCDay()]} ${base}` : base;
}

/** "14 oct, 2:26 p. m." en hora de Santo Domingo. */
export function fechaHora(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const fecha = new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", day: "numeric", month: "short" }).format(d).replace(".", "");
  const hora = new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", hour: "numeric", minute: "2-digit" }).format(d);
  return `${fecha}, ${hora}`;
}
