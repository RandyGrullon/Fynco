"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Mic, RotateCw, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { useUser } from "@/components/providers/session-provider";
import { todayISO } from "@/lib/dates";
import { VOICE_PLACEHOLDER, type AssistantErrorBody, type AssistantRequest, type AssistantResponse } from "@/lib/assistant/types";
import type { WavResult } from "@/lib/assistant/wav";
import { cn } from "@/lib/utils";
import { Composer, MicButton } from "./composer";
import { loadConversation, newId, saveConversation, toApiMessages, type UIMessage } from "./conversation";
import { DraftCard, useDraftActions, type DraftActions } from "./draft-card";
import { RichText } from "./rich-text";
import { formatClock, useVoiceRecorder, type VoiceRecorder } from "./use-voice-recorder";

const SUGGESTIONS = ["¿Cuánto gasté en comida este mes?", "¿Quién me debe?", "Registra 850 de almuerzo en efectivo", "¿Cómo voy con mis metas?"];

const CLIENT_TIMEOUT_MS = 40_000;

interface PendingRequest {
  history: UIMessage[];
  audio?: WavResult;
  userMessageId: string;
}

function messageForStatus(status: number) {
  if (status === 401) return "Tu sesión expiró. Vuelve a entrar.";
  if (status === 429) return "Estoy recibiendo muchas preguntas, intenta en un momento.";
  if (status === 413) return "El mensaje es muy grande. Intenta con uno más corto.";
  if (status >= 500) return "El asistente no está disponible ahora. Intenta en un momento.";
  return "No pude responder. Intenta de nuevo.";
}

function FMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-extrabold text-primary-foreground", className)}>
      F
    </span>
  );
}

export function AssistantChat() {
  const user = useUser();
  const params = useSearchParams();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; request: PendingRequest } | null>(null);
  const voiceParam = params.get("voz") === "1";
  const [voiceMode, setVoiceMode] = useState(voiceParam);
  const abortRef = useRef<AbortController | null>(null);
  const actions = useDraftActions();

  // Volver a entrar con ?voz=1 (p. ej. desde Inicio) muestra otra vez el micrófono grande.
  useEffect(() => {
    if (voiceParam) setVoiceMode(true);
  }, [voiceParam]);

  // Conversación guardada en esta pestaña.
  useEffect(() => {
    setMessages(loadConversation(user.id));
    setLoaded(true);
  }, [user.id]);
  useEffect(() => {
    if (loaded) saveConversation(user.id, messages);
  }, [messages, loaded, user.id]);

  // Siempre mostrar lo último.
  useEffect(() => {
    if (!loaded) return;
    window.requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }));
  }, [messages.length, pending, error, loaded]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const request = useCallback(async (req: PendingRequest) => {
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    const timer = window.setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);
    setPending(true);
    setError(null);
    try {
      const payload: AssistantRequest = {
        messages: toApiMessages(req.history),
        today: todayISO(),
        ...(req.audio ? { audio: { mimeType: "audio/wav", data: req.audio.data } } : {}),
      };
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const json = (await res.json().catch(() => null)) as (AssistantResponse & Partial<AssistantErrorBody>) | null;
      if (!res.ok || !json || typeof json.reply !== "string") throw new Error(json?.error || messageForStatus(res.status));
      if (abortRef.current !== ctrl) return;

      const source = req.audio ? "voice" : "assistant";
      setMessages((prev) => {
        const withTranscript = req.audio && json.transcript ? prev.map((m) => (m.id === req.userMessageId ? { ...m, text: json.transcript! } : m)) : prev;
        return [
          ...withTranscript,
          {
            id: newId(),
            role: "model",
            text: json.reply,
            drafts: (json.drafts ?? []).map((draft) => ({ draft, status: "pending" as const, source })),
            at: Date.now(),
          },
        ];
      });
    } catch (e) {
      if (abortRef.current !== ctrl) return; // conversación nueva o pantalla cerrada
      const message = ctrl.signal.aborted
        ? "Tardé demasiado en responder. Intenta de nuevo."
        : e instanceof TypeError
          ? "Sin conexión. Revisa tu internet."
          : e instanceof Error && e.message
            ? e.message
            : "No pude responder. Intenta de nuevo.";
      setError({ message, request: req });
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setPending(false);
      }
    }
  }, []);

  const send = useCallback(
    (text: string, audio?: WavResult) => {
      if (pending) return;
      const userMessage: UIMessage = {
        id: newId(),
        role: "user",
        text: audio ? VOICE_PLACEHOLDER : text,
        ...(audio ? { voice: { durationMs: audio.durationMs } } : {}),
        at: Date.now(),
      };
      const history = [...messages, userMessage];
      setMessages(history);
      setVoiceMode(false);
      void request({ history, audio, userMessageId: userMessage.id });
    },
    [messages, pending, request],
  );

  const voice = useVoiceRecorder((wav) => send("", wav));

  function reset() {
    const ctrl = abortRef.current;
    abortRef.current = null;
    ctrl?.abort();
    voice.cancel();
    setPending(false);
    setError(null);
    setMessages([]);
  }

  function markSaved(messageId: string, draftId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId && m.drafts ? { ...m, drafts: m.drafts.map((d) => (d.draft.id === draftId ? { ...d, status: "saved" as const } : d)) } : m)),
    );
  }

  const empty = loaded && messages.length === 0 && !pending;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Asistente"
        subtitle="Tus finanzas, en tus palabras"
        className="sticky top-0 z-20 -mx-5 bg-background/95 px-5 backdrop-blur md:-mx-8 md:px-8"
        actions={
          <Button variant="secondary" size="icon" aria-label="Nueva conversación" title="Nueva conversación" onClick={reset} disabled={!messages.length && !pending && !error}>
            <SquarePen />
          </Button>
        }
      />

      {empty ? (
        <EmptyChat voiceMode={voiceMode} voice={voice} onPick={(s) => send(s)} />
      ) : (
        <div role="log" aria-live="polite" aria-label="Conversación con Fynco" className="flex flex-col gap-5 pt-3">
          {messages.map((m) => (m.role === "user" ? <UserBubble key={m.id} message={m} /> : <AssistantMessage key={m.id} message={m} actions={actions} onSaved={(draftId) => markSaved(m.id, draftId)} />))}
          {pending && <Typing />}
          {error && !pending && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-negative/30 bg-negative/10 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">{error.message}</p>
              <Button type="button" variant="secondary" className="h-11 rounded-full px-4 text-sm" onClick={() => void request(error.request)}>
                <RotateCw aria-hidden="true" /> Reintentar
              </Button>
            </div>
          )}
          {voiceMode && !pending && <VoicePrompt voice={voice} />}
        </div>
      )}

      {/* Espacio para que el compositor fijo no tape el último mensaje. */}
      <div className="h-20 md:h-28" aria-hidden="true" />

      <Composer onSend={(t) => send(t)} voice={voice} pending={pending} />
    </div>
  );
}

function EmptyChat({ voiceMode, voice, onPick }: { voiceMode: boolean; voice: VoiceRecorder; onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-6 pt-8 text-center md:pt-14">
      {voiceMode ? (
        <VoicePrompt voice={voice} />
      ) : (
        <>
          <FMark className="h-14 w-14 rounded-2xl text-2xl" />
          <div className="flex max-w-sm flex-col gap-1.5">
            <h2 className="text-lg font-extrabold">¿En qué te ayudo?</h2>
            <p className="text-sm text-muted-foreground">Pregúntame por tus cuentas, gastos, deudas y metas, o dicta un gasto para registrarlo.</p>
          </div>
        </>
      )}
      <div className="flex max-w-xl flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="min-h-11 rounded-full border border-secondary bg-card px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Micrófono grande para ?voz=1. No arranca solo: necesita el toque del usuario. */
function VoicePrompt({ voice }: { voice: VoiceRecorder }) {
  const recording = voice.state === "recording";
  const label = !voice.supported
    ? "Tu navegador no permite grabar. Escribe tu mensaje abajo."
    : recording
      ? `Grabando ${formatClock(voice.elapsed)} · toca para enviar`
      : voice.state === "processing"
        ? "Procesando audio…"
        : voice.state === "starting"
          ? "Abriendo el micrófono…"
          : "Toca para hablar";
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <MicButton voice={voice} size="lg" />
      <div className="flex flex-col gap-1" aria-live="polite">
        <p className="text-base font-bold">{label}</p>
        {voice.state === "idle" && voice.supported && <p className="text-sm text-muted-foreground">Por ejemplo: «Gasté 850 en almuerzo con efectivo».</p>}
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: UIMessage }) {
  const isPlaceholder = message.voice && message.text === VOICE_PLACEHOLDER;
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] break-words rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-[15px] leading-relaxed">
        {message.voice && (
          <span className={cn("flex items-center gap-1.5 text-xs font-semibold text-muted-foreground", !isPlaceholder && "mb-1")}>
            <Mic className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Nota de voz · {formatClock(message.voice.durationMs)}
          </span>
        )}
        {!isPlaceholder && <p className="whitespace-pre-wrap">{message.text}</p>}
      </div>
    </div>
  );
}

function AssistantMessage({ message, actions, onSaved }: { message: UIMessage; actions: DraftActions; onSaved: (draftId: string) => void }) {
  return (
    <div className="flex gap-3">
      <FMark className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <span className="sr-only">Fynco:</span>
        <div className="text-[15px] leading-relaxed">
          <RichText text={message.text} />
        </div>
        {message.drafts?.map((d) => <DraftCard key={d.draft.id} item={d} actions={actions} onSaved={() => onSaved(d.draft.id)} />)}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-3" role="status" aria-label="Fynco está escribiendo">
      <FMark />
      <span className="flex items-center gap-1.5 py-2" aria-hidden="true">
        {[0, 160, 320].map((delay) => (
          <span key={delay} className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </span>
    </div>
  );
}
