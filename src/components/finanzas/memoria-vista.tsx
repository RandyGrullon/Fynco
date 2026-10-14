"use client";

import { useMemo, useState } from "react";
import { Archive, History, LogOut, Pencil, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field } from "@/components/forms/field";
import { RichText } from "@/components/assistant/rich-text";
import { toast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import { salir } from "@/components/shell/nav";
import { useBuscarArchivo, useConversacion, useGuardarNota, useHistorial, useNotas, useRestaurar, type ArchivoFila, type NotaFila, type VersionFila } from "@/lib/finanzas/datos";
import { fechaHora } from "@/lib/finanzas/formato";

const ORIGEN: Record<string, string> = { semilla: "De la conversación con Claude", chat: "Del chat", manual: "La escribiste tú", restaurar: "Restaurado" };

function EditorNota({ nota, abierto, onCerrar }: { nota: Partial<NotaFila> | null; abierto: boolean; onCerrar: () => void }) {
  const guardar = useGuardarNota();
  const [tema, setTema] = useState(nota?.tema ?? "");
  const [texto, setTexto] = useState(nota?.texto ?? "");
  const listo = tema.trim().length > 0 && texto.trim().length > 0;
  return (
    <Panel open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <PanelContent title={nota?.id ? "Editar nota" : "Nueva nota"} description="El asistente la lee antes de cada respuesta.">
        <div className="flex flex-col gap-3 pt-2">
          <Field label="Tema" htmlFor="tema">
            <Input id="tema" value={tema} onChange={(e) => setTema(e.target.value)} maxLength={80} placeholder="Ej. Regalos de Navidad" />
          </Field>
          <Field label="Nota" htmlFor="texto">
            <Textarea id="texto" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={4000} rows={8} />
          </Field>
        </div>
        <PanelFooter>
          {nota?.id && (
            <Button
              variant="secondary"
              disabled={guardar.isPending}
              onClick={() =>
                guardar.mutate({ id: nota.id, tema, texto, archivada: !nota.archivada }, { onSuccess: () => (toast({ title: nota.archivada ? "Nota recuperada" : "Nota archivada" }), onCerrar()) })
              }
            >
              <Archive /> {nota.archivada ? "Recuperar" : "Archivar"}
            </Button>
          )}
          <Button className="flex-1" disabled={!listo || guardar.isPending} onClick={() => guardar.mutate({ id: nota?.id, tema: tema.trim(), texto: texto.trim(), archivada: nota?.archivada }, { onSuccess: () => (toast({ title: "Nota guardada" }), onCerrar()) })}>
            Guardar
          </Button>
        </PanelFooter>
      </PanelContent>
    </Panel>
  );
}

function Notas() {
  const notas = useNotas();
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [editando, setEditando] = useState<Partial<NotaFila> | null>(null);
  const [busca, setBusca] = useState("");
  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = (notas.data ?? []).filter((n) => n.archivada === verArchivadas && (!q || `${n.tema} ${n.texto}`.toLowerCase().includes(q)));
    const m = new Map<string, NotaFila[]>();
    for (const n of lista) m.set(n.tema, [...(m.get(n.tema) ?? []), n]);
    return [...m.entries()];
  }, [notas.data, verArchivadas, busca]);

  if (notas.isLoading) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar en la memoria" className="h-10 pl-9" />
        </div>
        <Button size="sm" className="h-10" onClick={() => setEditando({})}>
          <Plus className="!size-4" /> Nota
        </Button>
      </div>
      <p className="text-[13px] text-muted-foreground">
        {(notas.data ?? []).filter((n) => !n.archivada).length} notas. El asistente las usa para responderte y agrega nuevas cuando le cuentas algo importante.
      </p>
      {grupos.map(([tema, lista]) => (
        <section key={tema} className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-primary">{tema}</h2>
          <div className="mt-2 flex flex-col gap-3">
            {lista.map((n) => (
              <div key={n.id} className="group flex gap-2">
                <p className="flex-1 text-[13.5px] leading-relaxed">{n.texto}</p>
                <button type="button" onClick={() => setEditando(n)} aria-label="Editar nota" className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
                  <Pencil className="mx-auto h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-subtle">{ORIGEN[lista[0].origen] ?? lista[0].origen}</p>
        </section>
      ))}
      {!grupos.length && <p className="py-6 text-center text-sm text-muted-foreground">No hay notas{busca ? " con esa búsqueda" : ""}.</p>}
      <button type="button" onClick={() => setVerArchivadas((v) => !v)} className="self-center text-[13px] font-semibold text-muted-foreground hover:text-foreground">
        {verArchivadas ? "Ver notas activas" : "Ver archivadas"}
      </button>
      {editando && <EditorNota key={editando.id ?? "nueva"} nota={editando} abierto onCerrar={() => setEditando(null)} />}
    </div>
  );
}

function Historial() {
  const h = useHistorial();
  const restaurar = useRestaurar();
  const [elegida, setElegida] = useState<VersionFila | null>(null);
  if (h.isLoading) return <Skeleton className="h-40 w-full" />;
  const lista = h.data ?? [];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-muted-foreground">Cada cambio del plan queda guardado. Puedes volver a cualquier versión; nada se borra.</p>
      {lista.map((v, i) => (
        <div key={v.id} className={cn("rounded-2xl border border-border bg-card p-3.5", i === 0 && "border-primary/50")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold">
                v{v.version} · {v.motivo}
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                {fechaHora(v.creado)} · {v.origen === "chat" ? "desde el chat" : v.origen === "restaurar" ? "restaurada" : v.origen === "semilla" ? "plan inicial" : "a mano"}
                {i === 0 && " · actual"}
              </div>
            </div>
            {i > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setElegida(v)}>
                <History className="!size-3.5" /> Volver
              </Button>
            )}
          </div>
          {v.cambios && v.cambios.length > 1 && (
            <ul className="mt-2 flex flex-col gap-0.5 text-[12px] text-muted-foreground">
              {v.cambios.map((c, j) => (
                <li key={j}>• {c}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <AlertDialog open={Boolean(elegida)} onOpenChange={(o) => !o && setElegida(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Volver a la versión {elegida?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              El plan queda como estaba en ese momento ({elegida ? fechaHora(elegida.creado) : ""}). Se guarda como una versión nueva, así que también puedes deshacerlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                elegida &&
                restaurar.mutate(elegida.version, {
                  onSuccess: () => toast({ title: `Volviste a la versión ${elegida.version}` }),
                  onError: (e) => toast({ variant: "destructive", title: "No se pudo", description: errorMessage(e) }),
                })
              }
            >
              Volver a esa versión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Turno({ r }: { r: ArchivoFila }) {
  const yo = r.quien === "randy";
  return (
    <div className={cn("rounded-2xl border p-3 text-[13.5px] leading-relaxed", yo ? "border-primary/30 bg-primary-soft" : "border-border bg-card")}>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {yo ? "Tú" : r.quien === "claude" ? "Claude" : "Documento"} · #{r.n}
        {r.fecha ? ` · ${r.fecha}` : ""}
      </div>
      {yo ? <p className="whitespace-pre-wrap">{r.texto}</p> : <RichText text={r.texto} />}
    </div>
  );
}

function Conversacion() {
  const [q, setQ] = useState("");
  const [completa, setCompleta] = useState(false);
  const res = useBuscarArchivo(q);
  const todo = useConversacion(completa);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">Toda tu conversación con Claude (13 y 14 de octubre de 2026) está guardada aquí. El asistente busca en ella cuando hace falta.</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar (ej. zapatos, visa, papi)" className="h-10 pl-9" />
      </div>
      {q.trim().length >= 2 ? (
        res.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (res.data ?? []).length ? (
          (res.data ?? []).map((r) => <Turno key={`${r.fuente}-${r.n}`} r={r} />)
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">No encontré nada con eso.</p>
        )
      ) : completa ? (
        todo.isLoading ? <Skeleton className="h-40 w-full" /> : (todo.data ?? []).map((r) => <Turno key={`${r.fuente}-${r.n}`} r={r} />)
      ) : (
        <Button variant="secondary" onClick={() => setCompleta(true)}>
          Ver la conversación completa
        </Button>
      )}
    </div>
  );
}

export function MemoriaVista() {
  return (
    <div className="flex flex-col pb-8 pt-4 md:pt-8">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Memoria</h1>
          <p className="text-sm text-muted-foreground">Lo que el asistente sabe de ti, cada versión del plan y toda la conversación.</p>
        </div>
        <Button size="icon-sm" variant="ghost" className="md:hidden" onClick={() => void salir()} aria-label="Salir">
          <LogOut />
        </Button>
      </header>
      <Tabs defaultValue="notas">
        <TabsList>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="conversacion">Conversación</TabsTrigger>
        </TabsList>
        <TabsContent value="notas">
          <Notas />
        </TabsContent>
        <TabsContent value="historial">
          <Historial />
        </TabsContent>
        <TabsContent value="conversacion">
          <Conversacion />
        </TabsContent>
      </Tabs>
    </div>
  );
}
