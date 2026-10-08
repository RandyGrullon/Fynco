"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberAvatar } from "@/components/visuals";
import { groupPreview, joinGroup } from "@/lib/data/groups";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

export function JoinGroup({ code }: { code: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: preview, isLoading } = useQuery({ queryKey: ["group-preview", code], queryFn: () => groupPreview(code) });
  const [claim, setClaim] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Enlace no válido</h1>
        <p className="mt-2 text-muted-foreground">El grupo no existe o fue archivado. Pide un enlace nuevo.</p>
        <Button className="mt-6" onClick={() => router.replace("/compartido")}>
          Ir a Compartido
        </Button>
      </div>
    );
  }

  const guests = preview.members.filter((m) => !m.claimed);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const id = await joinGroup(code, claim);
      await qc.invalidateQueries();
      router.replace(`/compartido/${id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (preview.is_member) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Ya estás en “{preview.name}”</h1>
        <Button className="mt-6" onClick={() => router.replace(`/compartido/${preview.id}`)}>
          Abrir el grupo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Unirte a “{preview.name}”</h1>
        <p className="mt-2 text-muted-foreground">{preview.members.length} miembros · {preview.currency}</p>
      </div>

      {guests.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-muted-foreground">¿Eres alguna de estas personas? Así heredas sus gastos.</legend>
          {guests.map((g) => (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={claim === g.id}
              onClick={() => setClaim(claim === g.id ? null : g.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                claim === g.id ? "border-primary bg-primary/10" : "border-secondary bg-card hover:bg-secondary",
              )}
            >
              <MemberAvatar name={g.display_name} seed={g.id} size={36} />
              <span className="flex-1 font-semibold">Soy {g.display_name}</span>
              {claim === g.id && <Check className="h-5 w-5 text-primary" />}
            </button>
          ))}
        </fieldset>
      )}

      {error && (
        <p className="text-sm font-semibold text-negative" role="alert">
          {error}
        </p>
      )}
      <Button size="lg" onClick={join} disabled={busy}>
        {busy ? "Uniéndote…" : claim ? `Unirme como ${guests.find((g) => g.id === claim)?.display_name}` : "Unirme como nuevo miembro"}
      </Button>
    </div>
  );
}
