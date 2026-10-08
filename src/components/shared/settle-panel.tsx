"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountSelect, AmountField, DateField, Field } from "@/components/forms/fields";
import { MemberAvatar } from "@/components/visuals";
import { SelectMember } from "./expense-panel";
import { useUser } from "@/components/providers/session-provider";
import { useAccounts, useGroupDetail, useSharedMutations } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { groupDebts, myMember } from "@/lib/data/groups";
import { todayISO } from "@/lib/dates";
import { centsToInput, formatMoney, parseMoney } from "@/lib/money";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  from?: string;
  to?: string;
  amount?: number;
}

export function SettlePanel({ open, onOpenChange, groupId, from: fromProp, to: toProp, amount: amountProp }: Props) {
  const user = useUser();
  const { data: detail, isLoading } = useGroupDetail(groupId);
  const { data: accounts = [] } = useAccounts();
  const m = useSharedMutations();

  const group = detail?.group;
  const me = group ? myMember(group, user.id) : undefined;
  const members = useMemo(() => (group?.members ?? []).filter((mm) => !mm.left_at), [group]);
  const debts = useMemo(() => (detail ? groupDebts(detail) : []), [detail]);

  const [from, setFrom] = useState<string | null>(fromProp ?? null);
  const [to, setTo] = useState<string | null>(toProp ?? null);
  const [amount, setAmount] = useState(amountProp ? centsToInput(amountProp) : "");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sin datos de entrada: proponer la deuda más relevante para mí.
  useEffect(() => {
    if (!detail || !me || from || to) return;
    const mine = debts.find((d) => d.from === me.id) ?? debts.find((d) => d.to === me.id) ?? debts[0];
    if (mine) {
      setFrom(mine.from);
      setTo(mine.to);
      setAmount(centsToInput(mine.amount));
    } else {
      setFrom(me.id);
    }
  }, [detail, me, debts, from, to]);

  const currency = group?.currency ?? "DOP";
  const iAmParty = me && (from === me.id || to === me.id);

  useEffect(() => {
    if (accountId || !accounts.length || !group) return;
    setAccountId((accounts.find((a) => a.is_default && a.currency === currency) ?? accounts.find((a) => a.currency === currency && !a.archived_at))?.id ?? null);
  }, [accounts, accountId, currency, group]);

  const name = (id: string | null) => (id === me?.id ? "Tú" : (members.find((mm) => mm.id === id)?.display_name ?? "…"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!from || !to) return setError("Elige quién paga y quién recibe.");
    if (from === to) return setError("Deben ser dos personas distintas.");
    if (!cents || cents <= 0) return setError("Escribe un monto mayor que cero.");
    setError(null);
    try {
      await m.settle.mutateAsync({ group_id: groupId, from_member: from, to_member: to, amount: cents, occurred_on: date, account_id: iAmParty ? accountId : null, note: note.trim() || null });
    } catch {
      return;
    }
    toast({ title: "Pago registrado", description: `${name(from)} → ${name(to)} · ${formatMoney(cents, currency)}` });
    onOpenChange(false);
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title="Saldar cuentas" description="Registra un pago entre miembros del grupo">
        {isLoading || !group ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-4 pt-2">
              <PartyBadge name={name(from)} seed={members.find((mm) => mm.id === from)?.profile_id ?? from ?? ""} isMe={from === me?.id} />
              <ArrowRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <PartyBadge name={name(to)} seed={members.find((mm) => mm.id === to)?.profile_id ?? to ?? ""} isMe={to === me?.id} />
            </div>
            <AmountField value={amount} onChange={setAmount} currency={currency} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Paga" htmlFor="st-from">
                <SelectMember id="st-from" members={members} value={from} onChange={setFrom} meId={me?.id} label="Quién paga" />
              </Field>
              <Field label="Recibe" htmlFor="st-to">
                <SelectMember id="st-to" members={members} value={to} onChange={setTo} meId={me?.id} label="Quién recibe" />
              </Field>
            </div>
            {iAmParty && (
              <Field label={from === me?.id ? "Pagué desde" : "Lo recibí en"} htmlFor="st-account" hint="Opcional: mueve el saldo de esa cuenta. No cuenta como gasto ni ingreso.">
                <AccountSelect id="st-account" accounts={accounts} currency={currency} value={accountId} onChange={setAccountId} placeholder={`Sin ligar (no tienes cuentas en ${currency})`} />
              </Field>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Fecha" htmlFor="st-date">
                <DateField id="st-date" value={date} onChange={setDate} />
              </Field>
              <Field label="Nota (opcional)" htmlFor="st-note">
                <Input id="st-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Transferencia, efectivo…" maxLength={120} />
              </Field>
            </div>
            {error && (
              <p className="text-sm font-semibold text-negative" role="alert">
                {error}
              </p>
            )}
            <PanelFooter>
              <Button type="submit" className="flex-1" disabled={m.settle.isPending}>
                {m.settle.isPending ? "Guardando…" : "Registrar pago"}
              </Button>
            </PanelFooter>
          </form>
        )}
      </PanelContent>
    </Panel>
  );
}

function PartyBadge({ name, seed, isMe }: { name: string; seed: string; isMe: boolean }) {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <MemberAvatar name={name} seed={seed} isMe={isMe} size={48} />
      <span className="text-sm font-bold">{name}</span>
    </span>
  );
}
