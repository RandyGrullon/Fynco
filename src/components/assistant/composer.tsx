"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, Square, X } from "lucide-react";
import { MAX_RECORDING_MS, MAX_TEXT } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";
import { formatClock, type VoiceRecorder } from "./use-voice-recorder";

/** Botón de micrófono: lima, con anillo pulsante mientras graba. */
export function MicButton({ voice, disabled, size = "md" }: { voice: VoiceRecorder; disabled?: boolean; size?: "md" | "lg" }) {
  const recording = voice.state === "recording";
  const busy = voice.state === "starting" || voice.state === "processing";
  return (
    <button
      type="button"
      onClick={voice.toggle}
      disabled={disabled || busy || !voice.supported}
      aria-label={recording ? "Detener y enviar nota de voz" : "Grabar nota de voz"}
      aria-pressed={recording}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
        size === "lg" ? "h-20 w-20" : "h-11 w-11",
        recording && "animate-pulse-ring",
      )}
    >
      {busy ? (
        <Loader2 className={cn("animate-spin", size === "lg" ? "h-8 w-8" : "h-5 w-5")} aria-hidden="true" />
      ) : recording ? (
        <Square className={cn("fill-current", size === "lg" ? "h-7 w-7" : "h-4 w-4")} aria-hidden="true" />
      ) : (
        <Mic className={size === "lg" ? "h-8 w-8" : "h-5 w-5"} strokeWidth={2.2} aria-hidden="true" />
      )}
    </button>
  );
}

export function Composer({ onSend, voice, pending }: { onSend: (text: string) => void; voice: VoiceRecorder; pending: boolean }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const recording = voice.state === "recording";
  const processing = voice.state === "processing" || voice.state === "starting";
  const canSend = text.trim().length > 0 && !pending;

  // Crece con el texto hasta ~5 líneas.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  function submit() {
    const value = text.trim();
    if (!value || pending) return;
    onSend(value.slice(0, MAX_TEXT));
    setText("");
  }

  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur md:left-64 md:!bottom-0"
      // Encima de la barra inferior del móvil (55 px + área segura).
      style={{ bottom: "calc(55px + max(env(safe-area-inset-bottom), 0.75rem))" }}
    >
      <div className="mx-auto w-full max-w-3xl px-5 pb-3 pt-2.5 md:px-8 md:pb-5">
        {voice.error && (
          <div role="alert" className="mb-2 flex items-start gap-2 rounded-lg bg-negative/10 px-3 py-2 text-xs font-semibold text-negative">
            <span className="flex-1">{voice.error}</span>
            <button type="button" onClick={voice.clearError} aria-label="Cerrar aviso" className="-m-1 rounded p-1 hover:bg-negative/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-end gap-2 rounded-2xl border border-secondary bg-card p-1.5 pl-4"
        >
          {recording || processing ? (
            <div className="flex min-h-11 flex-1 items-center gap-3" aria-live="polite">
              {recording ? (
                <>
                  <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-negative" aria-hidden="true" />
                  <span className="tabular text-sm font-bold">{formatClock(voice.elapsed)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">de {formatClock(MAX_RECORDING_MS)} · toca para enviar</span>
                  <button
                    type="button"
                    onClick={voice.cancel}
                    aria-label="Cancelar grabación"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{voice.state === "starting" ? "Abriendo el micrófono…" : "Procesando audio…"}</span>
              )}
            </div>
          ) : (
            <>
              <label htmlFor="assistant-input" className="sr-only">
                Escribe tu pregunta
              </label>
              <textarea
                id="assistant-input"
                ref={ref}
                rows={1}
                value={text}
                maxLength={MAX_TEXT}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Pregunta o dicta un gasto…"
                enterKeyHint="send"
                autoComplete="off"
                className="max-h-[132px] min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base leading-6 outline-none placeholder:text-muted-foreground md:text-[15px]"
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Enviar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary transition-colors hover:bg-[#30353d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground disabled:opacity-60"
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
              </button>
            </>
          )}
          <MicButton voice={voice} disabled={pending && !recording} />
        </form>
      </div>
    </div>
  );
}
