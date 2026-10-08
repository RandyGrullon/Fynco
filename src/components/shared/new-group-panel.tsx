"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Segmented } from "@/components/forms/fields";
import { useDefaultCurrency } from "@/components/money";
import { useSharedMutations } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { CURRENCIES, CURRENCY_CODES } from "@/lib/money";

type Row = { key: number; name: string; email: string };

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function NewGroupPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const m = useSharedMutations();
  const defaultCurrency = useDefaultCurrency();
  const [kind, setKind] = useState<"group" | "direct">("group");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [rows, setRows] = useState<Row[]>([{ key: 1, name: "", email: "" }]);
  const [error, setError] = useState<string | null>(null);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const people = (kind === "direct" ? rows.slice(0, 1) : rows).filter((r) => r.name.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "group" && !name.trim()) return setError("Ponle nombre al grupo.");
    if (!people.length) return setError(kind === "direct" ? "¿Con quién compartes el gasto?" : "Añade al menos a una persona.");
    const badEmail = people.find((p) => p.email.trim() && !isEmail(p.email));
    if (badEmail) return setError(`El correo de ${badEmail.name} no es válido.`);
    setError(null);
    let id: string;
    try {
      id = await m.createGroup.mutateAsync({
        name: kind === "direct" ? people[0].name.trim() : name.trim(),
        currency,
        kind,
        members: people.map((p) => ({ display_name: p.name.trim(), email: p.email.trim() || null })),
      });
    } catch {
      return;
    }
    toast({ title: kind === "direct" ? "Listo" : "Grupo creado", description: "Ya puedes añadir gastos." });
    onOpenChange(false);
    router.push(`/compartido/${id}`);
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title="Compartir gastos" description="Si pones su correo y tiene cuenta en Fynco, verá la invitación al entrar. También puedes invitar con un enlace.">
        <form onSubmit={submit} className="flex flex-col gap-4 pt-1">
          <Segmented
            label="Tipo"
            value={kind}
            onChange={setKind}
            options={[
              { value: "group", label: "Grupo" },
              { value: "direct", label: "Con un amigo" },
            ]}
          />
          {kind === "group" && (
            <Field label="Nombre del grupo" htmlFor="ng-name">
              <Input id="ng-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Viaje a Samaná, Apartamento…" maxLength={60} autoFocus />
            </Field>
          )}
          <Field label="Moneda" htmlFor="ng-cur">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="ng-cur">
                <SelectValue>{`${CURRENCIES[currency]?.symbol ?? currency} · ${CURRENCIES[currency]?.name ?? ""}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_CODES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CURRENCIES[c].symbol} · {CURRENCIES[c].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-1.5 text-[13px] font-semibold text-muted-foreground">{kind === "direct" ? "Tu amigo" : "Personas (además de ti)"}</legend>
            {(kind === "direct" ? rows.slice(0, 1) : rows).map((r, i) => (
              <div key={r.key} className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input aria-label={`Nombre de la persona ${i + 1}`} value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} placeholder="Nombre" maxLength={40} autoFocus={kind === "direct" && i === 0} />
                  <Input aria-label={`Correo de la persona ${i + 1} (opcional)`} type="email" value={r.email} onChange={(e) => update(r.key, { email: e.target.value })} placeholder="Correo (opcional)" />
                </div>
                {kind === "group" && rows.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Quitar a ${r.name || `persona ${i + 1}`}`}>
                    <X />
                  </Button>
                )}
              </div>
            ))}
            {kind === "group" && (
              <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setRows((rs) => [...rs, { key: Date.now(), name: "", email: "" }])}>
                <Plus /> Añadir persona
              </Button>
            )}
          </fieldset>

          {error && (
            <p className="text-sm font-semibold text-negative" role="alert">
              {error}
            </p>
          )}
          <PanelFooter>
            <Button type="submit" className="flex-1" disabled={m.createGroup.isPending}>
              {m.createGroup.isPending ? "Creando…" : kind === "direct" ? "Continuar" : "Crear grupo"}
            </Button>
          </PanelFooter>
        </form>
      </PanelContent>
    </Panel>
  );
}
