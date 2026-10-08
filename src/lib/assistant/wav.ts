"use client";

// Grabación de notas de voz para el asistente: MediaRecorder → decodificar → 16 kHz mono →
// WAV PCM de 16 bits → base64. WAV porque Gemini no acepta webm y funciona en todos los navegadores.
import { MAX_RECORDING_MS } from "./types";

export const TARGET_SAMPLE_RATE = 16_000;

export type VoiceErrorCode = "unsupported" | "denied" | "no_mic" | "busy" | "empty" | "failed";

export class VoiceError extends Error {
  readonly code: VoiceErrorCode;
  constructor(code: VoiceErrorCode, message: string) {
    super(message);
    this.name = "VoiceError";
    this.code = code;
  }
}

const MESSAGES: Record<VoiceErrorCode, string> = {
  unsupported: "Tu navegador no permite grabar audio. Escribe tu mensaje.",
  denied: "Necesito permiso para usar el micrófono. Actívalo en la configuración del navegador e intenta de nuevo.",
  no_mic: "No encontré un micrófono en este dispositivo.",
  busy: "El micrófono está ocupado por otra aplicación.",
  empty: "No se escuchó nada. Intenta de nuevo y habla cerca del teléfono.",
  failed: "No pude procesar el audio. Intenta de nuevo o escribe tu mensaje.",
};

const voiceError = (code: VoiceErrorCode) => new VoiceError(code, MESSAGES[code]);

export interface WavResult {
  mimeType: "audio/wav";
  /** base64 sin prefijo data: */
  data: string;
  durationMs: number;
}

export interface Recording {
  /** Detiene la grabación y devuelve el WAV listo para enviar. */
  stop: () => Promise<WavResult>;
  /** Descarta la grabación. */
  cancel: () => void;
  startedAt: number;
}

type AudioContextCtor = typeof AudioContext;
type OfflineCtor = typeof OfflineAudioContext;

function audioCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
}

function offlineCtor(): OfflineCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: OfflineCtor }).webkitOfflineAudioContext;
}

export function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window.MediaRecorder !== "undefined" &&
    Boolean(audioCtor())
  );
}

function pickMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/aac"];
  if (typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function mapGetUserMediaError(e: unknown): VoiceError {
  const name = e && typeof e === "object" && "name" in e ? String((e as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return voiceError("denied");
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return voiceError("no_mic");
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return voiceError("busy");
  return voiceError("failed");
}

/**
 * Empieza a grabar. Debe llamarse desde un gesto del usuario (toque).
 * `onLimit` se llama al llegar al máximo (30 s) para que la interfaz detenga y envíe.
 */
export async function startRecording(opts: { maxMs?: number; onLimit?: () => void } = {}): Promise<Recording> {
  if (!isRecordingSupported()) throw voiceError("unsupported");
  const maxMs = opts.maxMs ?? MAX_RECORDING_MS;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    throw mapGetUserMediaError(e);
  }

  const mimeType = pickMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw voiceError("unsupported");
  }

  const chunks: Blob[] = [];
  recorder.addEventListener("dataavailable", (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  });

  const stopped = new Promise<void>((resolve) => recorder.addEventListener("stop", () => resolve(), { once: true }));
  const release = () => stream.getTracks().forEach((t) => t.stop());
  const startedAt = Date.now();
  let finished = false;

  const limitTimer = window.setTimeout(() => opts.onLimit?.(), maxMs);

  recorder.start(250);

  const end = async () => {
    window.clearTimeout(limitTimer);
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    release();
  };

  return {
    startedAt,
    async stop() {
      if (finished) throw voiceError("failed");
      finished = true;
      await end();
      const durationMs = Math.min(Date.now() - startedAt, maxMs + 1000);
      if (!chunks.length || durationMs < 400) throw voiceError("empty");
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      try {
        const wav = await blobToWav(blob, maxMs);
        return { mimeType: "audio/wav", data: await blobToBase64(wav), durationMs };
      } catch (e) {
        if (e instanceof VoiceError) throw e;
        throw voiceError("failed");
      }
    },
    cancel() {
      if (finished) return;
      finished = true;
      void end();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Conversión
// ---------------------------------------------------------------------------------------------

function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // Safari viejo solo tiene la versión con callbacks.
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);
    if (p && typeof p.then === "function") p.then(resolve, reject);
  });
}

async function blobToWav(blob: Blob, maxMs: number): Promise<Blob> {
  const Ctx = audioCtor();
  if (!Ctx) throw voiceError("unsupported");
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await decode(ctx, await blob.arrayBuffer());
  } finally {
    void ctx.close?.().catch(() => {});
  }
  const seconds = Math.min(decoded.duration, maxMs / 1000);
  if (!Number.isFinite(seconds) || seconds < 0.3) throw voiceError("empty");
  const samples = await resampleMono(decoded, seconds);
  if (isSilent(samples)) throw voiceError("empty");
  return encodeWav(samples, TARGET_SAMPLE_RATE);
}

/** 16 kHz mono con OfflineAudioContext; si el navegador no acepta esa frecuencia, a mano. */
async function resampleMono(buffer: AudioBuffer, seconds: number): Promise<Float32Array> {
  const length = Math.max(1, Math.ceil(seconds * TARGET_SAMPLE_RATE));
  const Offline = offlineCtor();
  if (Offline) {
    try {
      const off = new Offline(1, length, TARGET_SAMPLE_RATE);
      const src = off.createBufferSource();
      src.buffer = buffer;
      src.connect(off.destination);
      src.start(0);
      const rendered = await new Promise<AudioBuffer>((resolve, reject) => {
        off.oncomplete = (e) => resolve(e.renderedBuffer);
        const p = off.startRendering() as Promise<AudioBuffer> | undefined;
        if (p && typeof p.then === "function") p.then(resolve, reject);
      });
      return rendered.getChannelData(0).slice(0, length);
    } catch {
      // continúa con el método manual
    }
  }
  return manualResample(buffer, length);
}

export function downmix(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}

/** Promedia ventanas (filtro de caja) para bajar de frecuencia sin mucho aliasing. */
export function resampleLinear(input: Float32Array, fromRate: number, toRate: number, length?: number): Float32Array {
  const ratio = fromRate / toRate;
  const outLen = length ?? Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = i * ratio;
    const end = Math.min(input.length, (i + 1) * ratio);
    let sum = 0;
    let n = 0;
    for (let j = Math.floor(start); j < end; j++) {
      sum += input[j];
      n++;
    }
    out[i] = n ? sum / n : (input[Math.min(input.length - 1, Math.floor(start))] ?? 0);
  }
  return out;
}

function manualResample(buffer: AudioBuffer, length: number): Float32Array {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  return resampleLinear(downmix(channels), buffer.sampleRate, TARGET_SAMPLE_RATE, length);
}

export function isSilent(samples: Float32Array, threshold = 0.003): boolean {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
    if (peak > threshold) return false;
  }
  return true;
}

/** PCM 16 bits little-endian con cabecera WAV de 44 bytes. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // tamaño del bloque fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes por segundo
  view.setUint16(32, 2, true); // bytes por muestra
  view.setUint16(34, 16, true); // bits por muestra
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      const comma = url.indexOf(",");
      resolve(comma >= 0 ? url.slice(comma + 1) : url);
    };
    reader.onerror = () => reject(voiceError("failed"));
    reader.readAsDataURL(blob);
  });
}
