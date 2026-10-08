"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, LogOut, Pencil, Share2, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Panel, PanelContent } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/fields";
import { MemberAvatar } from "@/components/visuals";
import { useUser } from "@/components/providers/session-provider";
import { useSharedMutations } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { myMember, type GroupDetail } from "@/lib/data/groups";
import { errorMessage } from "@/lib/errors";
import type { GroupMember } from "@/lib/types";

export function GroupSettingsPanel({ open, onOpenChange, detail }: { open: boolean; onOpenChange: (o: boolean) => void; detail: GroupDetail }) {
  const user = useUser();
  const router = useRouter();
  const m = useSharedMutations();
  const { group, expenses, settlements } = detail;
  const me = myMember(group, user.id);
  const [name, setName] = useState(group.name);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [editing, setEditing] = useState<GroupMember | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "leave" | null>(null);

  const link = typeof window !== "undefined" ? `${window.location.origin}/unirse/${group.invite_code}` : "";
  const hasHistory = expenses.length > 0 || settlements.length > 0;
  const balanceOf = (id: string) => group.balances.find((b) => b.member_id === id)?.net ?? 0;

  async function run(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      if (ok) toast({ title: ok });
      return true;
    } catch {
      return false;
    }
  }

  async function share() {
    const text = `Únete a "${group.name}" en Fynco para dividir gastos: ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: "Fynco", text, url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast({ title: "Enlace copiado" });
      }
    } catch {}
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title="Ajustes del grupo">
        <div className="flex flex-col gap-6 pb-4">
          {group.kind === "group" && (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim() && name.trim() !== group.name) run(() => m.updateGroup.mutateAsync({ id: group.id, patch: { name: name.trim() } }), "Nombre actualizado");
              }}
            >
              <Field label="Nombre" htmlFor="gs-name" className="flex-1">
                <Input id="gs-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              </Field>
              <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === group.name}>
                Guardar
              </Button>
            </form>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-muted-foreground">Invitar con enlace</h3>
            <div className="flex items-center gap-2 rounded-xl border border-secondary bg-card p-2 pl-3">
              <span className="min-w-0 flex-1 truncate text-sm">{link.replace(/^https?:\/\//, "")}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copiar enlace"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    toast({ title: "Enlace copiado" });
                  } catch {}
                }}
              >
                <Copy />
              </Button>
              <Button size="sm" onClick={share}>
                <Share2 /> Compartir
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Quien entre por el enlace puede ocupar el lugar de un invitado o unirse como nuevo miembro.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-muted-foreground">Miembros</h3>
            <ul className="flex flex-col divide-y divide-muted rounded-xl border border-secondary bg-card">
              {group.members
                .filter((mm) => !mm.left_at)
                .map((mm) => (
                  <li key={mm.id} className="flex items-center gap-3 px-3 py-2.5">
                    <MemberAvatar name={mm.display_name} seed={mm.profile_id ?? mm.id} isMe={mm.id === me?.id} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{mm.id === me?.id ? `${mm.display_name} (tú)` : mm.display_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{mm.profile_id ? "En Fynco" : mm.invite_email ? `Invitado · ${mm.invite_email}` : "Invitado sin cuenta"}</span>
                    </span>
                    {!mm.profile_id && (
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar a ${mm.display_name}`} onClick={() => setEditing(mm)}>
                        <Pencil />
                      </Button>
                    )}
                    {mm.id !== me?.id && group.kind === "group" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Sacar a ${mm.display_name}`}
                        onClick={() => {
                          if (balanceOf(mm.id) !== 0) return toast({ variant: "destructive", title: "No se puede sacar", description: `${mm.display_name} tiene saldo pendiente. Salden primero.` });
                          run(() => m.removeMember.mutateAsync(mm.id), `${mm.display_name} salió del grupo`);
                        }}
                      >
                        <UserMinus />
                      </Button>
                    )}
                  </li>
                ))}
            </ul>

            {editing && (
              <form
                className="flex flex-col gap-2 rounded-xl border border-secondary p-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const ok = await run(() => m.updateMember.mutateAsync({ memberId: editing.id, name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? "") || null }), "Invitado actualizado");
                  if (ok) setEditing(null);
                }}
              >
                <Input name="name" aria-label="Nombre" defaultValue={editing.display_name} maxLength={40} required />
                <Input name="email" aria-label="Correo (opcional)" type="email" defaultValue={editing.invite_email ?? ""} placeholder="Correo (opcional)" />
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Guardar
                  </Button>
                </div>
              </form>
            )}

            {group.kind === "group" && (
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newName.trim()) return;
                  const ok = await run(() => m.addMember.mutateAsync({ groupId: group.id, name: newName.trim(), email: newEmail.trim() || null }), `${newName.trim()} añadido`);
                  if (ok) {
                    setNewName("");
                    setNewEmail("");
                  }
                }}
              >
                <Input aria-label="Nombre del nuevo miembro" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre" maxLength={40} />
                <Input aria-label="Correo del nuevo miembro (opcional)" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Correo (opcional)" />
                <Button type="submit" variant="secondary" disabled={!newName.trim() || m.addMember.isPending}>
                  <UserPlus /> Añadir
                </Button>
              </form>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-muted-foreground">Grupo</h3>
            <Button
              variant="secondary"
              className="justify-start"
              onClick={() => run(() => m.updateGroup.mutateAsync({ id: group.id, patch: { archived_at: group.archived_at ? null : new Date().toISOString() } }), group.archived_at ? "Grupo restaurado" : "Grupo archivado")}
            >
              {group.archived_at ? <ArchiveRestore /> : <Archive />} {group.archived_at ? "Restaurar grupo" : "Archivar grupo"}
            </Button>
            {group.kind === "group" && me && (
              <Button variant="secondary" className="justify-start" onClick={() => setConfirm("leave")}>
                <LogOut /> Salir del grupo
              </Button>
            )}
            {!hasHistory && (
              <Button variant="destructive-ghost" className="justify-start" onClick={() => setConfirm("delete")}>
                <Trash2 /> Borrar grupo
              </Button>
            )}

            {confirm && (
              <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 p-4" role="alert">
                <p className="text-sm">
                  {confirm === "delete"
                    ? "Se borra el grupo para todos. No tiene gastos, así que nadie pierde historial."
                    : me && balanceOf(me.id) !== 0
                      ? "Tienes saldo pendiente en este grupo. Salda primero para poder salir."
                      : "Dejarás de ver este grupo. Tu historial queda para los demás."}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={confirm === "leave" && Boolean(me && balanceOf(me.id) !== 0)}
                    onClick={async () => {
                      try {
                        if (confirm === "delete") await m.deleteGroup.mutateAsync(group.id);
                        else if (me) await m.removeMember.mutateAsync(me.id);
                      } catch (err) {
                        return toast({ variant: "destructive", title: "No se pudo", description: errorMessage(err) });
                      }
                      onOpenChange(false);
                      router.replace("/compartido");
                    }}
                  >
                    {confirm === "delete" ? "Borrar" : "Salir"}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </PanelContent>
    </Panel>
  );
}
