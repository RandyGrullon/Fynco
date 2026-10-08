"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isRecordingSupported, startRecording, VoiceError, type Recording, type WavResult } from "@/lib/assistant/wav";

export type VoiceState = "idle" | "starting" | "recording" | "processing";

/** Grabadora de notas de voz: un toque empieza, otro detiene y entrega el WAV. */
export function useVoiceRecorder(onResult: (wav: WavResult) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<Recording | null>(null);
  const tokenRef = useRef(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => setSupported(isRecordingSupported()), []);

  const stop = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    const token = tokenRef.current;
    setState("processing");
    try {
      const wav = await rec.stop();
      if (token !== tokenRef.current) return; // se canceló mientras se procesaba
      setState("idle");
      onResultRef.current(wav);
    } catch (e) {
      if (token !== tokenRef.current) return;
      setState("idle");
      setError(e instanceof VoiceError ? e.message : "No pude procesar el audio. Intenta de nuevo.");
    }
  }, []);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const start = useCallback(async () => {
    setError(null);
    const token = ++tokenRef.current;
    setState("starting");
    try {
      const rec = await startRecording({ onLimit: () => void stopRef.current() });
      if (token !== tokenRef.current) {
        // Se canceló mientras pedía permiso.
        rec.cancel();
        return;
      }
      recRef.current = rec;
      setElapsed(0);
      setState("recording");
    } catch (e) {
      if (token !== tokenRef.current) return;
      setState("idle");
      setError(e instanceof VoiceError ? e.message : "No pude usar el micrófono. Intenta de nuevo.");
    }
  }, []);

  const cancel = useCallback(() => {
    tokenRef.current++;
    recRef.current?.cancel();
    recRef.current = null;
    setState("idle");
  }, []);

  const toggle = useCallback(() => {
    if (state === "recording") void stop();
    else if (state === "idle") void start();
  }, [state, start, stop]);

  // Cronómetro mientras graba.
  useEffect(() => {
    if (state !== "recording") return;
    const id = window.setInterval(() => {
      const rec = recRef.current;
      if (rec) setElapsed(Date.now() - rec.startedAt);
    }, 200);
    return () => window.clearInterval(id);
  }, [state]);

  // Al salir de la pantalla se suelta el micrófono.
  useEffect(
    () => () => {
      tokenRef.current++;
      recRef.current?.cancel();
    },
    [],
  );

  return { state, elapsed, error, clearError: () => setError(null), supported, toggle, cancel };
}

export type VoiceRecorder = ReturnType<typeof useVoiceRecorder>;

export function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
