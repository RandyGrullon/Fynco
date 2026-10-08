import { addMonths, endOfMonth, format, isSameYear, parseISO, startOfMonth, subDays } from "date-fns";
import { es } from "date-fns/locale";

/** Fecha local YYYY-MM-DD (no UTC: en RD a las 9pm sigue siendo "hoy"). */
export function todayISO(d = new Date()) {
  return format(d, "yyyy-MM-dd");
}

export function toISODate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function parseDate(iso: string) {
  return parseISO(iso.length === 10 ? `${iso}T12:00:00` : iso);
}

/** "Hoy", "Ayer", "mié 14 sep", "14 sep 2025" */
export function dayLabel(iso: string) {
  const d = parseDate(iso);
  const today = todayISO();
  if (iso === today) return "Hoy";
  if (iso === toISODate(subDays(new Date(), 1))) return "Ayer";
  return isSameYear(d, new Date()) ? format(d, "EEE d MMM", { locale: es }) : format(d, "d MMM yyyy", { locale: es });
}

export function shortDate(iso: string) {
  const d = parseDate(iso);
  return isSameYear(d, new Date()) ? format(d, "d MMM", { locale: es }) : format(d, "d MMM yy", { locale: es });
}

export function monthDay(iso: string) {
  const d = parseDate(iso);
  return { mon: format(d, "MMM", { locale: es }).replace(".", ""), day: format(d, "d") };
}

export function monthLabel(d: Date) {
  const s = format(d, "MMMM yyyy", { locale: es });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthName(d: Date) {
  return format(d, "MMMM", { locale: es });
}

export function monthRange(d = new Date()) {
  return { from: toISODate(startOfMonth(d)), to: toISODate(endOfMonth(d)) };
}

export function shiftMonth(d: Date, n: number) {
  return addMonths(d, n);
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
