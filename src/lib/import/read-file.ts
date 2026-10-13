// Lee un estado de cuenta EN EL TELÉFONO (PDF, Excel, CSV o foto). El archivo no se sube:
// a la IA solo va el texto de los movimientos (o la imagen, si es una foto o un PDF escaneado).
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { PAGE_BREAK } from "./compact";

export type ReadResult =
  | { kind: "text"; text: string; pages: number }
  | { kind: "images"; images: string[]; pages: number }
  | { kind: "password"; wrong: boolean };

export class ReadError extends Error {}

const MAX_PDF_PAGES = 15;
const MAX_SCAN_PAGES = 6;
const MAX_TEXT = 400_000;

export async function readStatementFile(file: File, password?: string): Promise<ReadResult> {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return readPdf(file, password);
  if (file.type.startsWith("image/")) return { kind: "images", images: [await imageToJpeg(file)], pages: 1 };
  if (name.endsWith(".xlsx")) return { kind: "text", text: await readXlsx(file), pages: 1 };
  if (name.endsWith(".xls")) return { kind: "text", text: await readOldExcel(file), pages: 1 };
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type.startsWith("text/")) {
    return { kind: "text", text: (await file.text()).slice(0, MAX_TEXT), pages: 1 };
  }
  throw new ReadError("Ese tipo de archivo no lo puedo leer. Usa el PDF del banco, un Excel (.xlsx), un CSV o una foto.");
}

// ---------------------------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------------------------
/** pdf.js usa Promise.withResolvers, que no existe en iOS anterior a 17.4. */
export function ensurePdfPolyfills() {
  const P = Promise as unknown as { withResolvers?: () => unknown };
  P.withResolvers ??= () => {
    let resolve!: (v: unknown) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

async function loadPdfJs() {
  ensurePdfPolyfills();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  return pdfjs;
}

async function readPdf(file: File, password?: string): Promise<ReadResult> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, password });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (e) {
    if (e instanceof Error && e.name === "PasswordException") {
      return { kind: "password", wrong: (e as Error & { code?: number }).code === pdfjs.PasswordResponses.INCORRECT_PASSWORD };
    }
    throw new ReadError("No pude abrir el PDF. Revisa que no esté dañado.");
  }

  try {
    const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
    const out: string[] = [];
    let chars = 0;
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const lines = toLines(content.items.filter((it): it is TextItem => "str" in it));
      chars += lines.reduce((n, l) => n + l.length, 0);
      out.push(...lines, PAGE_BREAK);
    }
    // Casi sin texto: es un PDF escaneado. Se mandan las páginas como imagen.
    if (chars < 40 * pages) {
      const images: string[] = [];
      for (let i = 1; i <= Math.min(pages, MAX_SCAN_PAGES); i++) images.push(await renderPage(await doc.getPage(i)));
      return { kind: "images", images, pages };
    }
    return { kind: "text", text: out.join("\n").slice(0, MAX_TEXT), pages };
  } finally {
    void task.destroy();
  }
}

/** Arma renglones a partir de los pedazos de texto: misma altura = mismo renglón; columnas separadas por " | ". */
export function toLines(items: TextItem[]): string[] {
  type Piece = { x: number; y: number; w: number; s: string; h: number };
  const pieces: Piece[] = items
    .filter((it) => it.str.trim())
    .map((it) => ({ x: it.transform[4] as number, y: it.transform[5] as number, w: it.width, s: it.str, h: Math.abs(it.transform[3] as number) || 8 }));
  pieces.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: Piece[][] = [];
  for (const p of pieces) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - p.y) <= Math.max(2, p.h * 0.4)) row.push(p);
    else rows.push([p]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let line = "";
    let end = -Infinity;
    for (const p of row) {
      const gap = p.x - end;
      if (line) line += gap > p.h * 1.2 ? " | " : gap > p.h * 0.15 ? " " : "";
      line += p.s.trim();
      end = p.x + p.w;
    }
    return line;
  });
}

type PdfPage = Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfJs>>["getDocument"]>["promise"]> extends { getPage(n: number): Promise<infer P> } ? P : never;

async function renderPage(page: PdfPage): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(2, 1400 / base.width) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return canvasToBase64(canvas);
}

// ---------------------------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------------------------
function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, " ").trim();
}

async function readXlsx(file: File): Promise<string> {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  let sheets: Awaited<ReturnType<typeof readXlsxFile>>;
  try {
    sheets = await readXlsxFile(file);
  } catch {
    throw new ReadError("No pude leer ese Excel. Prueba con el PDF del banco o guárdalo como CSV.");
  }
  return sheets
    .map((s) => s.data.map((row) => row.map(cellText).filter(Boolean).join(" | ")).filter(Boolean).join("\n"))
    .join("\n")
    .slice(0, MAX_TEXT);
}

/** Muchos bancos exportan "Excel" que en realidad es una tabla HTML. El .xls binario viejo no se puede leer aquí. */
async function readOldExcel(file: File): Promise<string> {
  const text = await file.text();
  if (!/<table/i.test(text.slice(0, 20_000)) && !/<table/i.test(text)) {
    throw new ReadError("Ese Excel es del formato viejo (.xls). Ábrelo y guárdalo como .xlsx o CSV, o usa el PDF del banco.");
  }
  const doc = new DOMParser().parseFromString(text, "text/html");
  return [...doc.querySelectorAll("tr")]
    .map((tr) => [...tr.querySelectorAll("td,th")].map((c) => cellText(c.textContent)).filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT);
}

// ---------------------------------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------------------------------
function canvasToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.82).replace(/^data:image\/jpeg;base64,/, "");
}

async function imageToJpeg(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ReadError("No pude abrir esa imagen. Prueba con una captura en JPG o PNG.");
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToBase64(canvas);
}
