// Importar estados de cuenta: tipos compartidos entre el cliente y la API. Montos en centavos.

export interface ImportTextRequest {
  kind: "text";
  /** Líneas del estado ya filtradas en el teléfono, en partes. */
  chunks: string[];
  account_type: string;
  today: string;
}

export interface ImportImagesRequest {
  kind: "images";
  /** Fotos o páginas escaneadas, JPEG en base64 sin prefijo. */
  images: string[];
  account_type: string;
  today: string;
}

export type ImportRequest = ImportTextRequest | ImportImagesRequest;

export interface ImportedRow {
  date: string;
  description: string;
  /** Con signo: negativo = sale dinero o sube la deuda. */
  amount: number;
  category_id: string | null;
  category_name: string | null;
  /** Pago a una tarjeta de crédito (se registra como transferencia). */
  card_payment: boolean;
}

export interface ImportResult {
  bank: string | null;
  last4: string | null;
  currency: string | null;
  period_from: string | null;
  period_to: string | null;
  /** Tarjetas: fecha de corte y fecha límite de pago de este estado. */
  closing_date: string | null;
  due_date: string | null;
  closing_balance: number | null;
  minimum_payment: number | null;
  credit_limit: number | null;
  rows: ImportedRow[];
  /** Partes que no se pudieron leer, para avisar al usuario. */
  warnings: string[];
}

export const IMPORT_LIMITS = {
  chunks: 12,
  chunkChars: 6000,
  images: 6,
  imageChars: 900_000,
};
