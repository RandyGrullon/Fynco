"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, Square, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RichText } from "@/components/assistant/rich-text";
import { formatClock, useVoiceRecorder } from "@/components/assistant/use-voice-recorder";
import { toast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import { ErrorChat, useChat, useDeshacer, useEnviar } from "@/lib/finanzas/datos";
import { fechaHora } from "@/lib/finanzas/formato";
import type { MensajeChat } from "@/lib/finanzas/chat";

const SUGERENCIAS = ["¿Cuánto puedo gastar hasta el cobro?", "Gasté 750 en el súper con la tarjeta", "¿Con qué tarjeta me conviene pagar el pádel?", "¿Cómo voy con la deuda?"];

function Burbuja({ m, ultimoConCambios }: { m: MensajeChat; ultimoConCambios: boolean }) {
  const deshacer = useDeshacer();
  const yo = m.rol === "user";
  return (
    <div className={cn("flex flex-col gap-1", yo ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed",
          yo ? "rounded-br-md bg-primary-soft text-foreground" : "rounded-bl-md border border-border bg-card",
        )}
      >
        {yo ? <p className="whitespace-pre-wrap">{m.texto}</p> : <RichText text={m.texto} />}
        {m.cambios && (
          <div className={cn("mt-2.5 rounded-xl border border-dashed p-2.5 text-[12.5px]", m.deshecho_en ? "border-border text-muted-foreground line-through" : "border-primary/40")}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-primary">{m.deshecho_en ? "Deshecho" : `${m.cambios.resumen.length} cambio${m.cambios.resumen.length === 1 ? "" : "s"} guardado${m.cambios.resumen.length === 1 ? "" : "s"}`}</span>
              {!m.deshecho_en && ultimoConCambios && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={deshacer.isPending}
                  onClick={() =>
                    deshacer.mutate(m.id, {
                      onSuccess: () => toast({ title: "Listo, lo deshice", description: "El plan volvió a como estaba antes de ese mensaje." }),
                      onError: (e) =>
                        toast({
                          variant: "destructive",
                          title: "No se pudo deshacer",
                          description: errorMessage(e).includes("hay_cambios_despues") ? "Hubo otros cambios después. Ve a Memoria → Historial y elige la versión." : errorMessage(e),
                        }),
                    })
                  }
                  className="h-7 px-2.5"
                >
                  <Undo2 className="!size-3.5" /> Deshacer
                </Button>
              )}
            </div>
            <ul className="mt-1.5 flex flex-col gap-0.5 text-muted-foreground">
              {m.cambios.resumen.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <span className="px-1 text-[10.5px] text-subtle">{fechaHora(m.creado)}</span>
    </div>
  );
}

export function ChatVista() {
  const chat = useChat();
  const enviar = useEnviar();
  const [texto, setTexto] = useState("");
  const [pendiente, setPendiente] = useState<string | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const mandar = (cuerpo: { texto?: string; audio?: { mimeType: "audio/wav"; data: string } }, mostrar: string) => {
    setPendiente(mostrar);
    enviar.mutate(cuerpo, {
      onSettled: () => setPendiente(null),
      onError: (e) => {
        if (cuerpo.texto && !(e instanceof ErrorChat && e.respuesta)) setTexto(cuerpo.texto);
        toast({ variant: "destructive", title: "No se pudo", description: e.message });
      },
    });
  };

  const voz = useVoiceRecorder((wav) => mandar({ audio: { mimeType: wav.mimeType, data: wav.data } }, "🎙️ Nota de voz…"));

  useEffect(() => {
    if (voz.error) {
      toast({ variant: "destructive", title: "Micrófono", description: voz.error });
      voz.clearError();
    }
  }, [voz]);

  const mensajes = chat.data ?? [];
  const ultimoConCambios = [...mensajes].reverse().find((m) => m.cambios && !m.deshecho_en)?.id;

  useLayoutEffect(() => {
    fin.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length, pendiente]);

  function enviarTexto() {
    const t = texto.trim();
    if (!t || enviar.isPending) return;
    setTexto("");
    mandar({ texto: t }, t);
    area.current?.focus();
  }

  const ocupado = enviar.isPending || voz.state === "processing";

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col pt-4 md:min-h-[calc(100dvh-3rem)] md:pt-8">
      <header className="mb-3">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Chat</h1>
        <p className="text-sm text-muted-foreground">Cuéntale todo. Te dice la verdad, registra lo que le digas y recuerda lo que han hablado.</p>
      </header>

      <div className="flex flex-1 flex-col gap-3 pb-40">
        {chat.isLoading && (
          <>
            <Skeleton className="h-14 w-2/3 self-end" />
            <Skeleton className="h-24 w-4/5" />
          </>
        )}
        {!chat.isLoading && mensajes.length === 0 && !pendiente && (
          <div className="mt-6 flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Prueba con algo como:</p>
            {SUGERENCIAS.map((s) => (
              <button key={s} type="button" onClick={() => mandar({ texto: s }, s)} className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-sm hover:bg-secondary">
                {s}
              </button>
            ))}
          </div>
        )}
        {mensajes.map((m) => (
          <Burbuja key={m.id} m={m} ultimoConCambios={m.id === ultimoConCambios} />
        ))}
        {pendiente && (
          <>
            {!mensajes.some((m) => m.rol === "user" && m.texto === pendiente) && (
              <div className="flex justify-end">
                <div className="max-w-[88%] rounded-2xl rounded-br-md bg-primary-soft px-3.5 py-2.5 text-[14.5px] opacity-80">{pendiente}</div>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pensando y revisando tu plan…
            </div>
          </>
        )}
        <div ref={fin} />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-3 py-2.5 backdrop-blur md:bottom-0 md:left-60">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          {voz.state === "recording" ? (
            <div className="flex h-12 flex-1 items-center justify-between rounded-2xl border border-negative/50 bg-card px-4 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-negative" /> Grabando {formatClock(voz.elapsed)}
              </span>
              <button type="button" onClick={voz.cancel} className="text-muted-foreground hover:text-foreground" aria-label="Cancelar">
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <textarea
              ref={area}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(min-width: 768px)").matches) {
                  e.preventDefault();
                  enviarTexto();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Escribe lo que pasó o pregunta…"
              className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              style={{ height: Math.min(160, 48 + Math.max(0, texto.split("\n").length - 1) * 22) }}
            />
          )}
          {texto.trim() && voz.state !== "recording" ? (
            <Button size="icon" onClick={enviarTexto} disabled={ocupado} aria-label="Enviar" className="h-12 w-12">
              {enviar.isPending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
            </Button>
          ) : (
            voz.supported && (
              <Button
                size="icon"
                variant={voz.state === "recording" ? "destructive" : "default"}
                onClick={voz.toggle}
                disabled={ocupado || voz.state === "starting"}
                aria-label={voz.state === "recording" ? "Detener y enviar" : "Nota de voz"}
                className="h-12 w-12"
              >
                {voz.state === "recording" ? <Square /> : voz.state === "processing" ? <Loader2 className="animate-spin" /> : <Mic />}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
