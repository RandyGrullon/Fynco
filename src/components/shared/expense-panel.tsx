"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Minus, Plus, Trash2 } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountSelect, AmountField, CategoryPicker, DateField, Field, Segmented } from "@/components/forms/fields";
import { Money } from "@/components/money";
import { AvatarStack, MemberAvatar } from "@/components/visuals";
import { useUser } from "@/components/providers/session-provider";
import { useAccounts, useCategories, useGroupDetail, useSharedMutations, useSharedOverview } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { db } from "@/lib/data/base";
import { myMember } from "@/lib/data/groups";
import { todayISO } from "@/lib/dates";
import { centsToInput, currencySymbol, formatMoney, parseMoney } from "@/lib/money";
import { splitByWeights, splitEqual, splitPercent } from "@/lib/split";
import type { GroupMember, Portion, SharedExpense, SplitMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ExpensePreset {
  description?: string;
  amount?: number;
  category_id?: string | null;
  occurred_on?: string;
  payer_member_id?: string;
  /** Quiénes participan (reparto igual). Por defecto, todos. */
  member_ids?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId?: string;
  expense?: SharedExpense;
  preset?: ExpensePreset;
}

export function ExpensePanel(props: Props) {
  const [groupId, setGroupId] = useState(props.groupId ?? props.expense?.group_id);
  if (!groupId) return <PickGroup open={props.open} onOpenChange={props.onOpenChange} onPick={setGroupId} />;
  return <ExpenseForm {...props} groupId={groupId} />;
}

function PickGroup({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (id: string) => void }) {
  const { data, isLoading } = useSharedOverview();
  const user = useUser();
  const groups = (data?.groups ?? []).filter((g) => g.me && !g.archived_at);
  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title="Dividir un gasto" description="¿Con quién lo compartiste?">
        <div className="flex flex-col gap-2 pb-3">
          {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando grupos…</p>}
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onPick(g.id)}
              className="flex items-center gap-3 rounded-xl border border-secondary bg-card p-3 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AvatarStack people={g.members.filter((m) => !m.left_at).map((m) => ({ key: m.profile_id ?? m.id, name: m.display_name, isMe: m.profile_id === user.id }))} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{g.kind === "direct" ? g.members.find((m) => m.profile_id !== user.id)?.display_name : g.name}</span>
                <span className="block text-xs text-muted-foreground">{g.members.filter((m) => !m.left_at).length} personas · {g.currency}</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
          {!isLoading && !groups.length && <p className="py-4 text-center text-sm text-muted-foreground">Aún no tienes grupos.</p>}
          <Button asChild variant="secondary" className="mt-1">
            <Link href="/compartido?nuevo=1" onClick={() => onOpenChange(false)}>
              <Plus /> Nuevo grupo o amigo
            </Link>
          </Button>
        </div>
      </PanelContent>
    </Panel>
  );
}

type PayMode = "single" | "multiple";

function ExpenseForm({ open, onOpenChange, groupId, expense, preset }: Props & { groupId: string }) {
  const user = useUser();
  const { data: detail, isLoading } = useGroupDetail(groupId);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const m = useSharedMutations();
  const editing = Boolean(expense);

  const group = detail?.group;
  const me = group ? myMember(group, user.id) : undefined;
  const members: GroupMember[] = useMemo(() => {
    if (!group) return [];
    const involved = new Set([...(expense?.payers ?? []), ...(expense?.shares ?? [])].map((p) => p.member_id));
    return group.members.filter((mm) => !mm.left_at || involved.has(mm.id));
  }, [group, expense]);
  const currency = group?.currency ?? "DOP";

  const [description, setDescription] = useState(expense?.description ?? preset?.description ?? "");
  const [amount, setAmount] = useState(expense ? centsToInput(expense.amount) : preset?.amount ? centsToInput(preset.amount) : "");
  const [categoryId, setCategoryId] = useState<string | null>(expense?.category_id ?? preset?.category_id ?? null);
  const [date, setDate] = useState(expense?.occurred_on ?? preset?.occurred_on ?? todayISO());
  const [method, setMethod] = useState<SplitMethod>(expense?.split_method ?? "equal");
  const [payMode, setPayMode] = useState<PayMode>(expense && expense.payers.length > 1 ? "multiple" : "single");
  const [payer, setPayer] = useState<string | null>(expense?.payers[0]?.member_id ?? preset?.payer_member_id ?? null);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries((expense?.payers ?? []).map((p) => [p.member_id, centsToInput(p.amount)])),
  );
  const [included, setIncluded] = useState<Set<string> | null>(() =>
    expense && expense.split_method === "equal"
      ? new Set(expense.shares.filter((s) => s.amount > 0).map((s) => s.member_id))
      : preset?.member_ids?.length
        ? new Set(preset.member_ids)
        : null,
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (expense?.shares ?? []).map((s) => [s.member_id, expense!.split_method === "exact" ? centsToInput(s.amount) : String(s.weight ?? "")]),
    ),
  );
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Valores iniciales que dependen del grupo cargado.
  useEffect(() => {
    if (!group || !me) return;
    setPayer((p) => p ?? me.id);
    setIncluded((s) => s ?? new Set(members.filter((mm) => !mm.left_at).map((mm) => mm.id)));
  }, [group, me, members]);

  // Cuenta: la ligada al gasto si existe; si no, la predeterminada en la moneda del grupo.
  useEffect(() => {
    // Esperar al grupo: su moneda decide qué cuentas sirven.
    if (accountId || !accounts.length || !group) return;
    const fallback = () =>
      setAccountId((accounts.find((a) => a.is_default && a.currency === currency && !a.archived_at) ?? accounts.find((a) => a.currency === currency && !a.archived_at))?.id ?? null);
    if (!expense) return fallback();
    db()
      .from("transactions")
      .select("account_id")
      .eq("shared_expense_id", expense.id)
      .maybeSingle()
      .then(({ data }) => (data?.account_id ? setAccountId(data.account_id) : fallback()));
  }, [accounts, currency, expense, accountId, group]);

  const total = parseMoney(amount) ?? 0;
  // Al editar un reparto por partes, quien no tenía partes guardadas tiene 0 (no 1).
  const defaultParts = expense?.split_method === "shares" && method === "shares" ? "0" : "1";

  const payers: { ok: true; portions: Portion[] } | { ok: false; error: string } = useMemo(() => {
    if (payMode === "single") return payer ? { ok: true, portions: [{ member_id: payer, amount: total }] } : { ok: false, error: "¿Quién pagó?" };
    const portions = members.map((mm) => ({ member_id: mm.id, amount: parseMoney(payerAmounts[mm.id] ?? "") ?? 0 })).filter((p) => p.amount > 0);
    const sum = portions.reduce((a, p) => a + p.amount, 0);
    if (sum !== total) return { ok: false, error: `Lo pagado suma ${formatMoney(sum, currency)}; faltan ${formatMoney(total - sum, currency)}` };
    return { ok: true, portions };
  }, [payMode, payer, total, members, payerAmounts, currency]);

  const shares: { ok: true; portions: Portion[] } | { ok: false; error: string } = useMemo(() => {
    if (method === "equal") {
      const ids = members.filter((mm) => included?.has(mm.id)).map((mm) => mm.id);
      if (!ids.length) return { ok: false, error: "Elige al menos una persona." };
      return { ok: true, portions: splitEqual(total, ids) };
    }
    if (method === "exact") {
      const portions = members.map((mm) => ({ member_id: mm.id, amount: parseMoney(values[mm.id] ?? "") ?? 0 }));
      const sum = portions.reduce((a, p) => a + p.amount, 0);
      if (sum !== total) return { ok: false, error: sum < total ? `Faltan ${formatMoney(total - sum, currency)} por asignar` : `Te pasaste por ${formatMoney(sum - total, currency)}` };
      return { ok: true, portions: portions.filter((p) => p.amount > 0) };
    }
    const weights = members.map((mm) => ({ member_id: mm.id, weight: Number((values[mm.id] ?? (method === "shares" ? defaultParts : "")).replace(",", ".")) || 0 }));
    if (method === "percent") {
      const r = splitPercent(total, weights);
      return r.ok ? { ok: true, portions: r.portions.filter((p) => p.amount > 0 || (p.weight ?? 0) > 0) } : { ok: false, error: r.error };
    }
    if (!weights.some((w) => w.weight > 0)) return { ok: false, error: "Asigna al menos una parte." };
    return { ok: true, portions: splitByWeights(total, weights).filter((p) => (p.weight ?? 0) > 0) };
  }, [method, members, included, total, values, currency, defaultParts]);

  const iPay = payers.ok && me ? payers.portions.some((p) => p.member_id === me.id) : false;
  const shareOf = (id: string) => (shares.ok ? shares.portions.find((p) => p.member_id === id)?.amount ?? 0 : 0);
  const busy = m.saveExpense.isPending || m.deleteExpense.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return setError("Escribe una descripción.");
    if (total <= 0) return setError("Escribe un monto mayor que cero.");
    if (!payers.ok) return setError(payers.error);
    if (!shares.ok) return setError(shares.error);
    setError(null);
    try {
      await m.saveExpense.mutateAsync({
        id: expense?.id,
        group_id: groupId,
        description: description.trim(),
        amount: total,
        occurred_on: date,
        category_id: categoryId,
        split_method: method,
        payers: payers.portions,
        shares: shares.portions,
        account_id: iPay ? accountId : null,
      });
    } catch {
      return;
    }
    toast({ title: editing ? "Gasto actualizado" : "Gasto añadido", description: `${description.trim()} · ${formatMoney(total, currency)}` });
    onOpenChange(false);
  }

  async function remove() {
    if (!expense) return;
    try {
      await m.deleteExpense.mutateAsync(expense.id);
    } catch {
      return;
    }
    toast({ title: "Gasto eliminado" });
    onOpenChange(false);
  }

  const title = editing ? "Editar gasto" : group ? (group.kind === "direct" ? `Gasto con ${members.find((mm) => mm.id !== me?.id)?.display_name ?? ""}` : `Gasto en ${group.name}`) : "Gasto compartido";

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title={title}>
        {isLoading || !group ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <AmountField value={amount} onChange={setAmount} currency={currency} autoFocus={!editing} label="Total del gasto" />
            <Field label="Descripción" htmlFor="ex-desc">
              <Input id="ex-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Cena, gasolina, alquiler…" maxLength={120} required />
            </Field>

            <Field label="Pagó">
              <Segmented
                label="Quién pagó"
                value={payMode}
                onChange={setPayMode}
                options={[
                  { value: "single", label: "Una persona" },
                  { value: "multiple", label: "Varias" },
                ]}
              />
            </Field>
            {payMode === "single" ? (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pagó">
                {members.map((mm) => (
                  <button
                    key={mm.id}
                    type="button"
                    role="radio"
                    aria-checked={payer === mm.id}
                    onClick={() => setPayer(mm.id)}
                    className={cn(
                      "flex h-11 items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      payer === mm.id ? "border-primary bg-primary/10 text-foreground" : "border-secondary bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <MemberAvatar name={mm.display_name} seed={mm.profile_id ?? mm.id} isMe={mm.id === me?.id} size={30} />
                    {mm.id === me?.id ? "Yo" : mm.display_name}
                  </button>
                ))}
              </div>
            ) : (
              <MemberRows members={members} meId={me?.id}>
                {(mm) => (
                  <MoneyCell id={`pay-${mm.id}`} label={`Pagó ${mm.display_name}`} currency={currency} value={payerAmounts[mm.id] ?? ""} onChange={(v) => setPayerAmounts((s) => ({ ...s, [mm.id]: v }))} />
                )}
              </MemberRows>
            )}
            {payMode === "multiple" && !payers.ok && total > 0 && <p className="text-xs font-semibold text-negative">{payers.error}</p>}

            {iPay && (
              <Field label="Pagué con" htmlFor="ex-account" hint="Se descuenta de esa cuenta. En tus estadísticas solo cuenta tu parte.">
                <AccountSelect id="ex-account" accounts={accounts} currency={currency} value={accountId} onChange={setAccountId} placeholder={`Sin ligar (no tienes cuentas en ${currency})`} />
              </Field>
            )}

            <Field label="Cómo se divide">
              <Segmented
                label="Método de reparto"
                value={method}
                onChange={(v) => {
                  setMethod(v);
                  if (v !== method) setValues({});
                }}
                options={[
                  { value: "equal", label: "Igual" },
                  { value: "exact", label: "Exacto" },
                  { value: "percent", label: "%" },
                  { value: "shares", label: "Partes" },
                ]}
              />
            </Field>

            <MemberRows members={members} meId={me?.id}>
              {(mm) => (
                <>
                  {method === "equal" && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={included?.has(mm.id) ?? false}
                      aria-label={`Incluir a ${mm.display_name}`}
                      onClick={() =>
                        setIncluded((s) => {
                          const next = new Set(s ?? []);
                          if (next.has(mm.id)) next.delete(mm.id);
                          else next.add(mm.id);
                          return next;
                        })
                      }
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        included?.has(mm.id) ? "border-primary bg-primary text-primary-foreground" : "border-[#3A3F48]",
                      )}
                    >
                      {included?.has(mm.id) && <Check className="h-4 w-4" strokeWidth={3} />}
                    </button>
                  )}
                  {method === "exact" && (
                    <MoneyCell id={`sh-${mm.id}`} label={`Parte de ${mm.display_name}`} currency={currency} value={values[mm.id] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [mm.id]: v }))} />
                  )}
                  {method === "percent" && (
                    <div className="flex items-center gap-1">
                      <Input
                        aria-label={`Porcentaje de ${mm.display_name}`}
                        inputMode="decimal"
                        className="h-10 w-20 text-right"
                        value={values[mm.id] ?? ""}
                        onChange={(e) => setValues((s) => ({ ...s, [mm.id]: e.target.value.replace(/[^\d.,]/g, "") }))}
                        placeholder="0"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  )}
                  {method === "shares" && (
                    <Stepper
                      label={mm.display_name}
                      value={Number(values[mm.id] ?? defaultParts) || 0}
                      onChange={(n) => setValues((s) => ({ ...s, [mm.id]: String(n) }))}
                    />
                  )}
                  {method !== "exact" && (
                    <Money amount={shareOf(mm.id)} currency={currency} className="w-24 text-right text-sm font-bold text-muted-foreground" />
                  )}
                </>
              )}
            </MemberRows>
            {!shares.ok && total > 0 && <p className="text-xs font-semibold text-negative">{shares.error}</p>}

            <Field label="Categoría">
              <CategoryPicker categories={categories.filter((c) => !c.user_id)} kind="expense" value={categoryId} onChange={setCategoryId} />
            </Field>
            <Field label="Fecha" htmlFor="ex-date">
              <DateField id="ex-date" value={date} onChange={setDate} />
            </Field>

            {error && (
              <p className="text-sm font-semibold text-negative" role="alert">
                {error}
              </p>
            )}
            <PanelFooter>
              {editing && (
                <Button type="button" variant="destructive-ghost" size="icon" onClick={remove} disabled={busy} aria-label="Eliminar gasto">
                  <Trash2 />
                </Button>
              )}
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? "Guardando…" : editing ? "Guardar cambios" : "Añadir gasto"}
              </Button>
            </PanelFooter>
          </form>
        )}
      </PanelContent>
    </Panel>
  );
}

function MemberRows({ members, meId, children }: { members: GroupMember[]; meId?: string; children: (m: GroupMember) => React.ReactNode }) {
  return (
    <ul className="flex flex-col divide-y divide-muted rounded-xl border border-secondary bg-card">
      {members.map((mm) => (
        <li key={mm.id} className="flex items-center gap-3 px-3 py-2">
          <MemberAvatar name={mm.display_name} seed={mm.profile_id ?? mm.id} isMe={mm.id === meId} size={32} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{mm.id === meId ? "Yo" : mm.display_name}</span>
          {children(mm)}
        </li>
      ))}
    </ul>
  );
}

function MoneyCell({ id, label, currency, value, onChange }: { id: string; label: string; currency: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground" aria-hidden="true">
        {currencySymbol(currency)}
      </span>
      <Input id={id} aria-label={label} inputMode="decimal" className="h-10 w-28 text-right" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" />
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Quitar una parte a ${label}`}>
        <Minus />
      </Button>
      <span className="tabular w-6 text-center text-sm font-bold" aria-live="polite">
        {value}
      </span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(Math.min(99, value + 1))} aria-label={`Añadir una parte a ${label}`}>
        <Plus />
      </Button>
    </div>
  );
}

export function SelectMember({ members, value, onChange, meId, id, label }: { members: GroupMember[]; value: string | null; onChange: (v: string) => void; meId?: string; id?: string; label?: string }) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label}>
        <SelectValue placeholder="Elige">{value ? (value === meId ? "Yo" : members.find((mm) => mm.id === value)?.display_name) : undefined}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {members.map((mm) => (
          <SelectItem key={mm.id} value={mm.id}>
            {mm.id === meId ? "Yo" : mm.display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
