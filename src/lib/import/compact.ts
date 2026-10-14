// Reduce el texto de un estado de cuenta a lo útil (encabezado y líneas con fechas o montos),
// quita datos personales y lo parte en pedazos pequeños para la IA. Puro: se usa en el teléfono y en pruebas.

const DATE_RE =
  /\b\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[\s\-/.]?(?:ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?(?:[\s\-/.]?\d{2,4})?\b/i;
const AMOUNT_RE = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+[.,]\d{2}\b/;
const KEY_RE = /corte|l[ií]mite|m[ií]nimo|saldo|per[ií]odo|fecha|tarjeta|cuenta|moneda|RD\$|US\$|\bDOP\b|\bUSD\b|balance|cr[eé]dito|d[eé]bito/i;
const HEADER_LINES = 40;

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE_RE = /\b(?:tel[eé]fono|tel|cel(?:ular)?|m[oó]vil)\b\.?:?\s*[+\d][\d\s().-]{6,}\d/gi;
/** Referencias, cédulas y teléfonos: se dejan solo los últimos 4 dígitos para distinguir filas iguales. */
const LONG_DIGITS_RE = /\d{10,}/g;
/** Segundo renglón con el código del comercio (MCC) y la autorización, p. ej. "5812 049844". */
const MCC_RE = /^(\d{4})\s*\|?\s*\d{6}$/;
/** Separador de páginas que pone el lector de PDF. */
export const PAGE_BREAK = "\f";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LOOSE: Record<string, string> = { a: "[aáàä]", e: "[eéèë]", i: "[iíìï]", o: "[oóòö]", u: "[uúùü]", n: "[nñ]" };
/** "Pérez" también encuentra "PEREZ". */
const loose = (w: string) =>
  escapeRe(w.normalize("NFD").replace(/[̀-ͯ]/g, ""))
    .split("")
    .map((c) => LOOSE[c.toLowerCase()] ?? c)
    .join("");

export interface CompactOptions {
  /** Nombre, correo, etc. del usuario: se quitan antes de mandar nada. */
  redact?: string[];
}

/** Líneas que importan, en orden, sin datos personales. */
export function compactStatement(text: string, opts: CompactOptions = {}): string[] {
  const words = (opts.redact ?? [])
    .flatMap((s) => (s.includes("@") ? [s] : s.split(/\s+/)))
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  const wordRe = words.length ? new RegExp(`(?<![\\p{L}\\d])(?:${words.map(loose).join("|")})(?![\\p{L}\\d])`, "giu") : null;

  const out: string[] = [];
  const earlierPages = new Set<string>();
  let thisPage = new Set<string>();
  let seen = 0;
  let prevKept = false;
  for (const raw of text.split(/\r?\n/)) {
    if (raw === PAGE_BREAK) {
      // Encabezados y pies repetidos en cada página se mandan una sola vez.
      for (const l of thisPage) earlierPages.add(l);
      thisPage = new Set();
      prevKept = false;
      continue;
    }
    let line = raw.replace(/\s+/g, " ").trim().slice(0, 300);
    const mcc = line.match(MCC_RE);
    if (mcc) {
      if (prevKept && out.length) out[out.length - 1] += ` | MCC ${mcc[1]}`;
      continue;
    }
    line = line
      .replace(EMAIL_RE, "")
      .replace(PHONE_RE, "")
      .replace(LONG_DIGITS_RE, (d) => `#${d.slice(-4)}`);
    if (wordRe && line.search(wordRe) >= 0) {
      line = line.replace(wordRe, "");
      // Lo que queda de un renglón con el nombre (segundo nombre, apellido) tampoco se manda.
      if (!/\d/.test(line)) line = "";
    }
    line = line
      .replace(/\s+/g, " ")
      .replace(/(?:\s*\|\s*)+/g, " | ")
      .replace(/^[\s|:.,-]+|[\s|:,-]+$/g, "")
      .trim();
    if (!line) {
      prevKept = false;
      continue;
    }
    seen++;
    const useful = seen <= HEADER_LINES || DATE_RE.test(line) || AMOUNT_RE.test(line) || KEY_RE.test(line);
    const keep = useful && !earlierPages.has(line);
    thisPage.add(line);
    if (keep) out.push(line);
    prevKept = keep;
  }
  return out;
}

/** Parte las líneas en pedazos de hasta `maxChars`. Si no caben en `maxChunks`, avisa. */
export function chunkLines(lines: string[], maxChars: number, maxChunks: number): { chunks: string[]; truncated: boolean } {
  const chunks: string[] = [];
  let current: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (size + line.length + 1 > maxChars && current.length) {
      chunks.push(current.join("\n"));
      if (chunks.length === maxChunks) return { chunks, truncated: true };
      current = [];
      size = 0;
    }
    current.push(line);
    size += line.length + 1;
  }
  if (current.length) chunks.push(current.join("\n"));
  return { chunks, truncated: false };
}
