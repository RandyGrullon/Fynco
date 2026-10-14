// Tipos que comparten el chat (cliente) y la ruta /api/chat.

export interface CambiosChat {
  version_antes: number;
  version_despues: number;
  resumen: string[];
}

export interface MensajeChat {
  id: number;
  rol: "user" | "assistant";
  texto: string;
  cambios: CambiosChat | null;
  deshecho_en: string | null;
  creado: string;
}

export interface RespuestaChat {
  usuario: MensajeChat;
  asistente: MensajeChat | null;
  transcripcion?: string;
  error?: string;
}
