// Tipos y errores comunes del asistente (el proveedor es Groq, ver groq.ts). Solo servidor.

export type ToolType = "OBJECT" | "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ARRAY";

/** Esquema de los parámetros de una herramienta; groq.ts lo pasa a JSON Schema. */
export interface ToolSchema {
  type: ToolType;
  description?: string;
  enum?: string[];
  format?: string;
  nullable?: boolean;
  properties?: Record<string, ToolSchema>;
  required?: string[];
  items?: ToolSchema;
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: ToolSchema;
}

/** Error con mensaje listo para mostrar (español) y el estado HTTP que debe devolver la API. */
export class IAError extends Error {
  readonly status: number;
  readonly code: string;
  /** Diagnóstico para logs (estado HTTP y motivo del proveedor). Nunca contenido del usuario. */
  detail: string;
  constructor(status: number, code: string, message: string, detail = "") {
    super(message);
    this.name = "IAError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export const IA_MESSAGES = {
  rateLimited: "Estoy recibiendo muchas preguntas, intenta en un momento.",
  misconfigured: "El asistente no está configurado correctamente. Intenta más tarde.",
  unavailable: "El asistente no está disponible ahora. Intenta en un momento.",
  timeout: "Tardé demasiado en responder. Intenta de nuevo.",
  network: "No pude conectarme con el asistente. Intenta de nuevo.",
  badRequest: "No pude procesar tu mensaje. Intenta decirlo de otra forma.",
} as const;
