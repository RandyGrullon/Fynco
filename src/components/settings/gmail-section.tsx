"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Mail, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { SettingsRow, SettingsSection } from "@/components/settings/settings-ui";
import { useSheets } from "@/components/shell/sheets";
import { useEmailImports, useGmailMutations, useGmailStatus } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { shortDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import type { EmailImport, SyncSummary } from "@/lib/gmail/types";

const rowButton = "h-11 rounded-full px-4 text-[13px]";

const RESULT_TOASTS: Record<string, { title: string; description?: string; variant?: "destructive" }> = {
  conectado: { title: "Gmail conectado", description: "Desde ahora registro las alertas de consumo del banco." },
  cancelado: { title: "No se conectó Gmail", description: "Cancelaste el permiso en Google." },
  "sin-permiso": { title: "Falta el permiso de Gmail", description: "Marca la casilla de leer tu correo al conectar.", variant: "destructive" },
  "sin-configurar": { title: "Gmail no está configurado", description: "Faltan las variables de Google en el servidor.", variant: "destructive" },
  error: { title: "No se pudo conectar Gmail", description: "Intenta de nuevo.", variant: "destructive" },
};

function describe(s: SyncSummary): string {
  const parts = [s.added && `${s.added} ${s.added === 1 ? "registrado" : "registrados"}`, s.review && `${s.review} por revisar`].filter(Boolean);
  if (!parts.length) return "No había alertas nuevas.";
  return `${parts.join(" · ")}.${s.more ? " Quedan más; sigo en la próxima revisión." : ""}`;
}

/** Ajustes → Correo del banco: conectar Gmail y revisar lo que no se pudo registrar solo. */
export function GmailSection() {
  const router = useRouter();
  const { data: status, isLoading } = useGmailStatus();
  const { data: pending = [] } = useEmailImports(Boolean(status));
  const m = useGmailMutations();
  const [confirmOff, setConfirmOff] = useState(false);

  // Resultado de la vuelta desde Google (/ajustes?gmail=…).
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("gmail");
    if (!result) return;
    const t = RESULT_TOASTS[result];
    if (t) toast(t);
    router.replace("/ajustes", { scroll: false });
    if (result === "conectado") m.sync.mutate(true);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function syncNow() {
    try {
      const s = await m.sync.mutateAsync(true);
      if (s.error) toast({ variant: "destructive", title: "No pude revisar tu correo", description: s.error });
      else toast({ title: "Correo revisado", description: describe(s) });
    } catch (e) {
      toast({ variant: "destructive", title: "No pude revisar tu correo", description: errorMessage(e) });
    }
  }

  async function disconnect() {
    try {
      await m.disconnect.mutateAsync();
      setConfirmOff(false);
      toast({ title: "Gmail desconectado", description: "Lo que ya se registró se queda en tus movimientos." });
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo desconectar", description: errorMessage(e) });
    }
  }

  return (
    <SettingsSection title="Correo del banco" description="Fynco lee las alertas de consumo que te llegan a Gmail y registra cada gasto en la tarjeta que termina igual. Solo lectura.">
      {isLoading ? (
        <div className="p-4">
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      ) : !status ? (
        <SettingsRow title="Conectar Gmail" description="Pon los últimos 4 dígitos en cada cuenta para que sepa dónde va cada consumo.">
          <Button asChild className={rowButton}>
            <a href="/api/gmail/connect">
              <Mail className="!size-4" />
              Conectar
            </a>
          </Button>
        </SettingsRow>
      ) : (
        <>
          <SettingsRow
            title={status.google_email}
            description={
              status.last_error ? (
                <span className="text-negative">{status.last_error}</span>
              ) : status.last_synced_at ? (
                `Revisado ${formatDistanceToNow(new Date(status.last_synced_at), { addSuffix: true, locale: es })}. Se revisa solo al abrir la app.`
              ) : (
                "Todavía no se ha revisado."
              )
            }
            stack
          >
            <Button variant="secondary" className={rowButton} onClick={syncNow} disabled={m.sync.isPending}>
              <RefreshCw className={`!size-4 ${m.sync.isPending ? "animate-spin" : ""}`} />
              {m.sync.isPending ? "Revisando…" : "Revisar ahora"}
            </Button>
            {status.last_error && (
              <Button asChild variant="secondary" className={rowButton}>
                <a href="/api/gmail/connect">Volver a conectar</a>
              </Button>
            )}
            <Button variant="destructive-ghost" className={rowButton} onClick={() => setConfirmOff(true)}>
              <Unplug className="!size-4" />
              Desconectar
            </Button>
          </SettingsRow>
          {pending.map((item) => (
            <PendingRow key={item.id} item={item} onResolve={(status, transaction_id) => m.resolve.mutate({ id: item.id, status, transaction_id })} busy={m.resolve.isPending} />
          ))}
        </>
      )}

      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar Gmail?</AlertDialogTitle>
            <AlertDialogDescription>Dejo de leer tus alertas y le quito el permiso a Fynco en Google. Lo que ya registré se queda.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.disconnect.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={m.disconnect.isPending}
              onClick={(e) => {
                e.preventDefault();
                disconnect();
              }}
            >
              {m.disconnect.isPending ? "Desconectando…" : "Desconectar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}

/** Alerta que no se pudo registrar sola: se abre el formulario ya lleno o se descarta. */
function PendingRow({ item, onResolve, busy }: { item: EmailImport; onResolve: (status: "added" | "ignored", transactionId?: string) => void; busy: boolean }) {
  const sheets = useSheets();
  const title = item.merchant || item.subject || "Alerta del banco";
  const amount = item.amount && item.currency ? formatMoney(item.amount, item.currency, { cents: "auto" }) : null;
  const meta = [amount, item.occurred_on && shortDate(item.occurred_on), item.card_last4 && `•••• ${item.card_last4}`].filter(Boolean).join(" · ");
  const income = item.kind === "income" || item.kind === "refund";

  return (
    <SettingsRow
      title={
        <>
          <span className="mr-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Por revisar</span>
          {title}
        </>
      }
      description={[meta, item.note].filter(Boolean).join(" — ")}
      stack
    >
      <Button
        className={rowButton}
        disabled={busy}
        onClick={() =>
          sheets.open({
            type: "transaction",
            kind: income ? "income" : "expense",
            preset: {
              kind: income ? "income" : "expense",
              amount: item.amount ?? undefined,
              description: item.merchant ?? "",
              occurred_on: item.occurred_on ?? undefined,
              account_id: item.account_id ?? undefined,
              note: "Correo del banco",
              source: "email",
            },
            onSaved: (tx) => onResolve("added", tx.id),
          })
        }
      >
        Registrar
      </Button>
      <Button variant="secondary" className={rowButton} disabled={busy} onClick={() => onResolve("ignored")}>
        Descartar
      </Button>
    </SettingsRow>
  );
}
