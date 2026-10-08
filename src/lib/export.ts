import type { Account, Category, Transaction } from "./types";

const KIND: Record<Transaction["kind"], string> = {
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
  shared: "Gasto compartido (pagado)",
  settlement: "Pago de deuda",
};

function cell(v: string | number | null | undefined, numeric = false) {
  let s = v == null ? "" : String(v);
  // Un texto que empieza con = + - @ se ejecutaría como fórmula en Excel/Sheets.
  if (!numeric && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con BOM UTF-8 (Excel abre bien los acentos). Montos en unidades con 2 decimales. */
export function transactionsToCsv(transactions: Transaction[], accounts: Account[], categories: Category[]) {
  const acc = new Map(accounts.map((a) => [a.id, a]));
  const cat = new Map(categories.map((c) => [c.id, c]));
  const header = ["Fecha", "Descripción", "Tipo", "Categoría", "Cuenta", "Moneda", "Monto", "Nota"];
  const rows = transactions.map((t) => {
    const a = acc.get(t.account_id);
    return [
      t.occurred_on,
      t.description,
      KIND[t.kind],
      t.category_id ? (cat.get(t.category_id)?.name ?? "") : "",
      a?.name ?? "",
      a?.currency ?? "",
      (t.amount / 100).toFixed(2),
      t.note ?? "",
    ]
      .map((v, i) => cell(v, i === 6)) // la columna 6 es el monto
      .join(",");
  });
  return String.fromCharCode(0xfeff) + [header.join(","), ...rows].join("\r\n");
}

export function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
