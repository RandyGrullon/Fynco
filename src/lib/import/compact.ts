// Reduce el texto de un estado de cuenta a lo útil (encabezado y líneas con fechas o montos)
// y lo parte en pedazos pequeños para la IA. Puro: se usa en el teléfono y en pruebas.

const DATE_RE =
  /\b\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[\s\-/.]?(?:ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?(?:[\s\-/.]?\d{2,4})?\b/i;
const AMOUNT_RE = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+[.,]\d{2}\b/;
const KEY_RE = /corte|l[ií]mite|m[ií]nimo|saldo|per[ií]odo|fecha|tarjeta|cuenta|moneda|RD\$|US\$|\bDOP\b|\bUSD\b|balance|cr[eé]dito|d[eé]bito/i;
const HEADER_LINES = 40;

/** Líneas que importan, en orden. */
export function compactStatement(text: string): string[] {
  const out: string[] = [];
  let seen = 0;
  let last = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim().slice(0, 300);
    if (!line || line === last) continue;
    seen++;
    if (seen <= HEADER_LINES || DATE_RE.test(line) || AMOUNT_RE.test(line) || KEY_RE.test(line)) {
      out.push(line);
      last = line;
    }
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
