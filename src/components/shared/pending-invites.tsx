"use client";

import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePendingInvites, useSharedMutations } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";

/** Invitaciones por correo: nadie entra a un grupo sin aceptarlo. */
export function PendingInvites({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const { data: invites = [] } = usePendingInvites();
  const m = useSharedMutations();
  if (!invites.length) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="Invitaciones pendientes">
      {invites.map((inv) => (
        <div key={inv.member_id} className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary-soft p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Mail className="h-5 w-5" />
            </span>
            <p className="min-w-0 flex-1 text-sm">
              <span className="block font-bold">
                {inv.group_kind === "direct" ? `${inv.invited_by ?? "Alguien"} quiere compartir gastos contigo` : `Te invitaron a “${inv.group_name}”`}
              </span>
              <span className="text-muted-foreground">
                {inv.group_kind === "direct" ? "Gastos directos" : `${inv.members} miembros`} · te agregaron como {inv.invited_as}
                {inv.invited_by && inv.group_kind !== "direct" ? ` · de ${inv.invited_by}` : ""}
              </span>
            </p>
          </div>
          {!compact && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-10"
                disabled={m.declineInvite.isPending}
                onClick={async () => {
                  try {
                    await m.declineInvite.mutateAsync(inv.member_id);
                    toast({ title: "Invitación rechazada" });
                  } catch {}
                }}
              >
                Rechazar
              </Button>
              <Button
                size="sm"
                className="h-10"
                disabled={m.acceptInvite.isPending}
                onClick={async () => {
                  try {
                    const id = await m.acceptInvite.mutateAsync(inv.member_id);
                    toast({ title: "Te uniste", description: inv.group_name });
                    router.push(`/compartido/${id}`);
                  } catch {}
                }}
              >
                Aceptar
              </Button>
            </div>
          )}
          {compact && (
            <Button size="sm" className="h-10" onClick={() => router.push("/compartido")}>
              Ver invitación
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
