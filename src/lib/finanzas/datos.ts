"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { calcularPlan, hoyRD } from "./motor";
import type { MensajeChat, RespuestaChat } from "./chat";
import type { Estado, Plan } from "./tipos";

export const claves = {
  estado: ["pf", "estado"] as const,
  chat: ["pf", "chat"] as const,
  notas: ["pf", "notas"] as const,
  historial: ["pf", "historial"] as const,
  archivo: (q: string) => ["pf", "archivo", q] as const,
  conversacion: ["pf", "conversacion"] as const,
};

export interface FilaEstado {
  datos: Estado;
  version: number;
  actualizado: string;
}

export function useEstado() {
  return useQuery({
    queryKey: claves.estado,
    queryFn: async (): Promise<FilaEstado | null> => {
      const { data, error } = await getSupabase().from("pf_estado").select("datos, version, actualizado").maybeSingle();
      if (error) throw error;
      return (data as FilaEstado | null) ?? null;
    },
  });
}

/** El plan calculado para hoy (Santo Domingo). */
export function usePlan(): { plan: Plan | null; fila: FilaEstado | null | undefined; isLoading: boolean; error: unknown; refetch: () => void } {
  const q = useEstado();
  const hoy = hoyRD();
  const plan = useMemo(() => (q.data ? calcularPlan(q.data.datos, hoy) : null), [q.data, hoy]);
  return { plan, fila: q.data, isLoading: q.isLoading, error: q.error, refetch: () => void q.refetch() };
}

export function useChat() {
  return useQuery({
    queryKey: claves.chat,
    queryFn: async (): Promise<MensajeChat[]> => {
      const { data, error } = await getSupabase().from("pf_chat").select("*").order("id", { ascending: false }).limit(120);
      if (error) throw error;
      return ((data ?? []) as MensajeChat[]).reverse();
    },
  });
}

export class ErrorChat extends Error {
  constructor(
    message: string,
    readonly respuesta?: RespuestaChat,
  ) {
    super(message);
  }
}

export function useEnviar() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async (cuerpo: { texto?: string; audio?: { mimeType: "audio/wav"; data: string } }): Promise<RespuestaChat> => {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
      const json = (await res.json().catch(() => null)) as (RespuestaChat & { error?: string }) | null;
      if (!res.ok || !json?.usuario) throw new ErrorChat(json?.error ?? "No pude enviar el mensaje. Revisa tu conexión.", json?.usuario ? json : undefined);
      return json;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: claves.chat });
      qc.invalidateQueries({ queryKey: claves.estado });
      qc.invalidateQueries({ queryKey: claves.historial });
      qc.invalidateQueries({ queryKey: claves.notas });
    },
  });
}

export function useDeshacer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: number) => {
      const { error } = await getSupabase().rpc("pf_deshacer", { p_chat_id: chatId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claves.chat });
      qc.invalidateQueries({ queryKey: claves.estado });
      qc.invalidateQueries({ queryKey: claves.historial });
    },
  });
}

export interface NotaFila {
  id: string;
  tema: string;
  texto: string;
  origen: string;
  archivada: boolean;
  creado: string;
  actualizado: string;
}

export function useNotas() {
  return useQuery({
    queryKey: claves.notas,
    queryFn: async (): Promise<NotaFila[]> => {
      const { data, error } = await getSupabase().from("pf_memoria").select("*").order("tema").order("creado");
      if (error) throw error;
      return (data ?? []) as NotaFila[];
    },
  });
}

export function useGuardarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (n: { id?: string; tema: string; texto: string; archivada?: boolean }) => {
      const sb = getSupabase();
      const { error } = n.id
        ? await sb.from("pf_memoria").update({ tema: n.tema, texto: n.texto, archivada: Boolean(n.archivada), actualizado: new Date().toISOString() }).eq("id", n.id)
        : await sb.from("pf_memoria").insert({ tema: n.tema, texto: n.texto, origen: "manual" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.notas }),
  });
}

export interface VersionFila {
  id: number;
  version: number;
  motivo: string;
  origen: string;
  cambios: string[] | null;
  creado: string;
}

export function useHistorial() {
  return useQuery({
    queryKey: claves.historial,
    queryFn: async (): Promise<VersionFila[]> => {
      const { data, error } = await getSupabase().from("pf_historial").select("id, version, motivo, origen, cambios, creado").order("version", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as VersionFila[];
    },
  });
}

export function useRestaurar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (version: number) => {
      const { error } = await getSupabase().rpc("pf_restaurar", { p_version: version });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claves.estado });
      qc.invalidateQueries({ queryKey: claves.historial });
    },
  });
}

export interface ArchivoFila {
  fuente: string;
  n: number;
  quien: "randy" | "claude" | "documento";
  fecha: string | null;
  texto: string;
}

export function useBuscarArchivo(q: string) {
  return useQuery({
    queryKey: claves.archivo(q),
    enabled: q.trim().length >= 2,
    queryFn: async (): Promise<ArchivoFila[]> => {
      const { data, error } = await getSupabase().rpc("pf_buscar_archivo", { p_consulta: q.trim(), p_limite: 20 });
      if (error) throw error;
      return (data ?? []) as ArchivoFila[];
    },
  });
}

export function useConversacion(activa: boolean) {
  return useQuery({
    queryKey: claves.conversacion,
    enabled: activa,
    staleTime: Infinity,
    queryFn: async (): Promise<ArchivoFila[]> => {
      const { data, error } = await getSupabase().from("pf_archivo").select("fuente, n, quien, fecha, texto").order("fuente").order("n");
      if (error) throw error;
      return (data ?? []) as ArchivoFila[];
    },
  });
}
