"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, ChevronRight, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Panel, PanelContent } from "@/components/ui/panel";
import { Money, useDefaultCurrency } from "@/components/money";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { useSheets } from "@/components/shell/sheets";
import { NewGroupPanel } from "@/components/shared/new-group-panel";
import { PendingInvites } from "@/components/shared/pending-invites";
import { useUser } from "@/components/providers/session-provider";
import { AvatarStack, MemberAvatar } from "@/components/visuals";
import { useSharedMutations, useSharedOverview } from "@/hooks/queries";
import { db } from "@/lib/data/base";
import { memberKey, type FriendBalance, type SharedOverview } from "@/lib/data/groups";

export default function CompartidoPage() {
  return (
    <Suspense>
      <Compartido />
    </Suspense>
  );
}

function Compartido() {
  const { data, isLoading } = useSharedOverview();
  const currency = useDefaultCurrency();
  const params = useSearchParams();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [friend, setFriend] = useState<FriendBalance | null>(null);

  useEffect(() => {
    if (params.get("nuevo") === "1") {
      setCreating(true);
      router.replace("/compartido");
    }
  }, [params, router]);

  const totals = data?.totals[currency] ?? { owedToMe: 0, iOwe: 0 };
  const groups = (data?.groups ?? []).filter((g) => g.me && !g.archived_at && g.kind === "group");
  const archived = (data?.groups ?? []).filter((g) => g.me && g.archived_at);
  const net = totals.owedToMe - totals.iOwe;
  const otherCurrencies = Object.entries(data?.totals ?? {}).filter(([c, t]) => c !== currency && (t.owedToMe > 0 || t.iOwe > 0));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Compartido"
        actions={
          <Button size="sm" onClick={() => setCreating(true)} className="h-10 px-4">
            <Plus /> Nuevo
          </Button>
        }
      />

      <PendingInvites />

      <section className="grid grid-cols-2 gap-3" aria-label="Resumen">
        <div className="flex flex-col gap-1 rounded-2xl border border-secondary bg-card p-4">
          <span className="text-xs text-muted-foreground">Te deben</span>
          {isLoading ? <Skeleton className="h-7 w-24" /> : <Money amount={totals.owedToMe} currency={currency} className="text-[22px] font-extrabold text-positive" />}
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-secondary bg-card p-4">
          <span className="text-xs text-muted-foreground">Debes</span>
          {isLoading ? <Skeleton className="h-7 w-24" /> : <Money amount={totals.iOwe} currency={currency} className="text-[22px] font-extrabold text-negative" />}
        </div>
        {!isLoading && (totals.owedToMe > 0 || totals.iOwe > 0) && (
          <p className="col-span-2 text-sm text-muted-foreground">
            En total {net >= 0 ? "te deben" : "debes"} <Money amount={Math.abs(net)} currency={currency} className={net >= 0 ? "font-bold text-positive" : "font-bold text-negative"} />.
          </p>
        )}
        {otherCurrencies.map(([cur, t]) => (
          <p key={cur} className="col-span-2 text-sm text-muted-foreground">
            En {cur}: te deben <Money amount={t.owedToMe} currency={cur} className="font-bold text-positive" /> · debes{" "}
            <Money amount={t.iOwe} currency={cur} className="font-bold text-negative" />
          </p>
        ))}
      </section>

      <Tabs defaultValue="grupos">
        <TabsList>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
          <TabsTrigger value="amigos">Amigos</TabsTrigger>
        </TabsList>

        <TabsContent value="grupos" className="flex flex-col gap-2.5">
          {isLoading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />)
          ) : groups.length === 0 ? (
            <EmptyState icon={Users} title="Sin grupos todavía" action={<Button onClick={() => setCreating(true)}>Crear un grupo</Button>}>
              Crea uno para un viaje, el apartamento o la oficina. Fynco calcula quién le debe a quién.
            </EmptyState>
          ) : (
            groups.map((g) => <GroupCard key={g.id} group={g} />)
          )}
          {archived.length > 0 && (
            <details className="mt-2 rounded-2xl border border-secondary">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-muted-foreground">
                <Archive className="h-4 w-4" /> Archivados ({archived.length})
              </summary>
              <div className="flex flex-col gap-2 px-2 pb-2">
                {archived.map((g) => (
                  <GroupCard key={g.id} group={g} />
                ))}
              </div>
            </details>
          )}
        </TabsContent>

        <TabsContent value="amigos" className="flex flex-col gap-2">
          {isLoading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
          ) : (data?.friends ?? []).length === 0 ? (
            <EmptyState icon={Users} title="Aún no compartes gastos" action={<Button onClick={() => setCreating(true)}>Gasto con un amigo</Button>}>
              Tus amigos aparecen aquí cuando compartes un grupo o un gasto con ellos.
            </EmptyState>
          ) : (
            data!.friends.map((f) => <FriendRow key={f.key} friend={f} onClick={() => setFriend(f)} />)
          )}
        </TabsContent>
      </Tabs>

      <NewGroupPanel open={creating} onOpenChange={setCreating} />
      {friend && data && <FriendPanel friend={friend} overview={data} onOpenChange={(o) => !o && setFriend(null)} />}
    </div>
  );
}

function BalancePill({ amount, currency }: { amount: number; currency: string }) {
  if (amount === 0) return <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">A mano</span>;
  return (
    <span className="flex flex-col items-end">
      <span className="text-[11px] text-muted-foreground">{amount > 0 ? "te deben" : "debes"}</span>
      <Money amount={Math.abs(amount)} currency={currency} className={amount > 0 ? "text-[15px] font-extrabold text-positive" : "text-[15px] font-extrabold text-negative"} />
    </span>
  );
}

function GroupCard({ group }: { group: SharedOverview["groups"][number] }) {
  const user = useUser();
  const members = group.members.filter((m) => !m.left_at);
  return (
    <Link
      href={`/compartido/${group.id}`}
      className="flex items-center gap-3 rounded-2xl border border-secondary bg-card p-3.5 transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AvatarStack people={members.map((m) => ({ key: m.profile_id ?? m.id, name: m.display_name, isMe: m.profile_id === user.id }))} size={32} max={3} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{group.name}</span>
        <span className="block text-xs text-muted-foreground">
          {members.length} personas{group.simplify_debts ? "" : " · sin simplificar"}
        </span>
      </span>
      <BalancePill amount={group.myNet} currency={group.currency} />
    </Link>
  );
}

function FriendRow({ friend, onClick }: { friend: FriendBalance; onClick: () => void }) {
  const entries = Object.entries(friend.amounts).filter(([, v]) => v !== 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-secondary bg-card p-3.5 text-left transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <MemberAvatar name={friend.name} seed={friend.key} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{friend.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {friend.profileId ? "En Fynco" : "Invitado"}
          {friend.groups.length ? ` · ${friend.groups.map((g) => (g.kind === "direct" ? "directo" : g.name)).join(", ")}` : ""}
        </span>
      </span>
      {entries.length === 0 ? (
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">A mano</span>
      ) : (
        <span className="flex flex-col items-end gap-0.5">
          {entries.map(([cur, v]) => (
            <BalancePill key={cur} amount={v} currency={cur} />
          ))}
        </span>
      )}
    </button>
  );
}

/** Detalle de un amigo: deuda por grupo y atajo a un gasto directo. */
function FriendPanel({ friend, overview, onOpenChange }: { friend: FriendBalance; overview: SharedOverview; onOpenChange: (o: boolean) => void }) {
  const user = useUser();
  const sheets = useSheets();
  const router = useRouter();
  const m = useSharedMutations();
  const currency = useDefaultCurrency();
  const direct = useMemo(
    () =>
      overview.groups.find(
        (g) => g.kind === "direct" && g.me && !g.archived_at && g.members.some((mm) => mm.profile_id !== user.id && !mm.left_at && memberKey(mm) === friend.key),
      ),
    [overview, friend.key, user.id],
  );

  async function startDirect() {
    if (direct) {
      onOpenChange(false);
      return sheets.open({ type: "expense", groupId: direct.id });
    }
    // Si el amigo tiene cuenta, su correo (visible por compartir grupo) lo vincula; si no, queda como invitado.
    let id: string;
    try {
      // Con cuenta: su correo genera una invitación que acepta. Invitado con correo: lo reusamos.
      const email = friend.profileId
        ? ((await db().from("member_profiles").select("email").eq("id", friend.profileId).maybeSingle()).data?.email ?? null)
        : friend.key.startsWith("e:")
          ? friend.key.slice(2)
          : null;
      id = await m.createGroup.mutateAsync({ name: friend.name, currency, kind: "direct", members: [{ display_name: friend.name, email }] });
    } catch {
      return;
    }
    onOpenChange(false);
    router.push(`/compartido/${id}`);
  }

  return (
    <Panel open onOpenChange={onOpenChange}>
      <PanelContent title={friend.name} description={friend.profileId ? "Tiene cuenta en Fynco" : "Invitado sin cuenta"}>
        <div className="flex flex-col gap-3 pb-3">
          {friend.groups.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Están a mano en todos los grupos.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-muted rounded-xl border border-secondary bg-card">
              {friend.groups.map((g) => (
                <li key={g.id}>
                  <Link href={`/compartido/${g.id}`} onClick={() => onOpenChange(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.kind === "direct" ? "Gastos directos" : g.name}</span>
                    <BalancePill amount={g.amount} currency={g.currency} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Button onClick={startDirect} disabled={m.createGroup.isPending}>
            <Plus /> Gasto con {friend.name.split(" ")[0]}
          </Button>
        </div>
      </PanelContent>
    </Panel>
  );
}
