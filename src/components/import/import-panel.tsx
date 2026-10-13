"use client";

import { useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { CreditCard, FileUp, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/fields";
import { Money } from "@/components/money";
import { useAccountMutations, useAccounts, useCategories, useProfile, useTransactionMutations } from "@/hooks/queries";
import { useUser } from "@/components/providers/session-provider";
import { toast } from "@/hooks/use-toast";
import { fetchAllTransactions } from "@/lib/data/transactions";
import { parseDate, shortDate, todayISO } from "@/lib/dates";
import { IMPORT_LIMITS, type ImportRequest, type ImportResult, type ImportedRow } from "@/lib/import/types";
import type { Account } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Row extends ImportedRow {
  key: string;
  selected: boolean;
  duplicate: boolean;
  /** Pagos de tarjeta: la otra cuenta de la transferencia ("" = registrar como gasto/ingreso normal). */
  otherAccountId: string;
}

type Stage =
  | { name: "pick" }
  | { name: "working"; label: string }
  | { name: "password"; file: File; wrong: boolean }
  | { name: "review"; result: ImportResult };

const CLIENT_TIMEOUT_MS = 75_000;

function messageForStatus(status: number) {
  if (status === 401) return "Tu sesión expiró. Vuelve a entrar.";
  if (status === 413) return "El archivo es muy grande. Prueba con el PDF del banco.";
  if (status === 429) return "La IA está ocupada o llegaste al límite. Intenta en un minuto.";
  return "No pude leer el archivo. Intenta de nuevo.";
}

/** Marca como repetidos los que ya están en la cuenta (mismo monto, fecha a 3 días o menos). */
function markDuplicates(rows: Row[], existing: { amount: number; occurred_on: string }[]) {
  const pool = existing.map((t) => ({ ...t, used: false }));
  for (const r of rows) {
    const hit = pool.find((t) => !t.used && t.amount === r.amount && Math.abs(differenceInCalendarDays(parseDate(t.occurred_on), parseDate(r.date))) <= 3);
    if (hit) {
      hit.used = true;
      r.duplicate = true;
      r.selected = false;
    }
  }
}

export function ImportPanel({ open, onOpenChange, accountId }: { open: boolean; onOpenChange: (o: boolean) => void; accountId?: string }) {
  const { data: accounts = [] } = useAccounts();
  const { data: profile } = useProfile();
  const user = useUser();
  const { data: categories = [] } = useCategories();
  const txM = useTransactionMutations();
  const accM = useAccountMutations();
  const active = useMemo(() => accounts.filter((a) => !a.archived_at), [accounts]);
  const [selectedAccount, setSelectedAccount] = useState(accountId ?? "");
  const account: Account | undefined = active.find((a) => a.id === (selectedAccount || accountId)) ?? (accountId ? undefined : active.find((a) => a.is_default) ?? active[0]);

  const [stage, setStage] = useState<Stage>({ name: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [password, setPassword] = useState("");
  const [saveCardInfo, setSaveCardInfo] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isCard = account?.type === "credit";
  const otherAccounts = active.filter((a) => a.id !== account?.id && a.currency === account?.currency && (isCard ? a.type !== "credit" : a.type === "credit"));
  const defaultOther = isCard ? (otherAccounts.find((a) => a.is_default) ?? otherAccounts[0]) : otherAccounts[0];

  function close(o: boolean) {
    if (!o) abortRef.current?.abort();
    onOpenChange(o);
  }

  async function processFile(file: File, pass?: string) {
    if (!account) return setError("Primero elige la cuenta del estado.");
    setError(null);
    setStage({ name: "working", label: "Leyendo el archivo…" });
    const extra: string[] = [];
    let body: ImportRequest;
    try {
      const { readStatementFile, ReadError } = await import("@/lib/import/read-file");
      const { compactStatement, chunkLines } = await import("@/lib/import/compact");
      let read;
      try {
        read = await readStatementFile(file, pass);
      } catch (e) {
        throw new Error(e instanceof ReadError ? e.message : "No pude leer el archivo.");
      }
      if (read.kind === "password") {
        setPassword("");
        return setStage({ name: "password", file, wrong: read.wrong });
      }
      if (read.kind === "text") {
        // Tu nombre y correo se quitan aquí, antes de mandar nada.
        const lines = compactStatement(read.text, { redact: [profile?.display_name ?? "", user.email ?? ""] });
        if (lines.length < 3) throw new Error("No encontré texto en el archivo. Si es una foto, súbela como imagen.");
        const { chunks, truncated } = chunkLines(lines, IMPORT_LIMITS.chunkChars, IMPORT_LIMITS.chunks);
        if (truncated) extra.push("El estado es muy largo: leí solo la primera parte.");
        body = { kind: "text", chunks, account_type: account.type, today: todayISO() };
      } else {
        if (read.pages > IMPORT_LIMITS.images) extra.push(`Leí solo las primeras ${IMPORT_LIMITS.images} páginas.`);
        body = { kind: "images", images: read.images.slice(0, IMPORT_LIMITS.images), account_type: account.type, today: todayISO() };
      }
    } catch (e) {
      setStage({ name: "pick" });
      return setError(e instanceof Error ? e.message : "No pude leer el archivo.");
    }

    setStage({ name: "working", label: "Buscando tus movimientos…" });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = window.setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
      const json = (await res.json().catch(() => null)) as (ImportResult & { error?: string }) | null;
      if (!res.ok || !json || !Array.isArray(json.rows)) throw new Error(json?.error || messageForStatus(res.status));

      const list: Row[] = json.rows.map((r, i) => ({
        ...r,
        key: `${i}`,
        selected: true,
        duplicate: false,
        otherAccountId: r.card_payment && ((isCard && r.amount > 0) || (!isCard && r.amount < 0)) ? (defaultOther?.id ?? "") : "",
      }));
      const dates = list.map((r) => r.date).sort();
      if (dates.length) {
        const from = format(addDays(parseDate(dates[0]), -3), "yyyy-MM-dd");
        const to = format(addDays(parseDate(dates[dates.length - 1]), 3), "yyyy-MM-dd");
        const existing = await fetchAllTransactions({ accountId: account.id, from, to }).catch(() => []);
        markDuplicates(list, existing);
      }
      if (json.currency && json.currency !== account.currency) extra.push(`El estado está en ${json.currency} y la cuenta en ${account.currency}. Revisa que sea la cuenta correcta.`);
      if (json.last4 && account.last4 && json.last4 !== account.last4) extra.push(`El estado es de la ···${json.last4} y esta cuenta es la ···${account.last4}.`);
      setNotes([...extra, ...json.warnings]);
      setRows(list);
      setSaveCardInfo(true);
      setStage({ name: "review", result: json });
    } catch (e) {
      setStage({ name: "pick" });
      setError(ctrl.signal.aborted ? "Tardó demasiado. Intenta de nuevo o con menos páginas." : e instanceof TypeError ? "Sin conexión. Revisa tu internet." : e instanceof Error ? e.message : "No pude leer el archivo.");
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  const selected = rows.filter((r) => r.selected);
  const inflow = selected.filter((r) => r.amount > 0).reduce((n, r) => n + r.amount, 0);
  const outflow = selected.filter((r) => r.amount < 0).reduce((n, r) => n + r.amount, 0);
  const update = (key: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const result = stage.name === "review" ? stage.result : null;
  const cardUpdate =
    result && isCard && account
      ? {
          statement_day: result.closing_date ? Number(result.closing_date.slice(8, 10)) : null,
          payment_due_day: result.due_date ? Number(result.due_date.slice(8, 10)) : null,
          credit_limit: result.credit_limit,
        }
      : null;
  const cardChanges =
    cardUpdate && account
      ? {
          ...(cardUpdate.statement_day && cardUpdate.statement_day !== account.statement_day ? { statement_day: cardUpdate.statement_day } : {}),
          ...(cardUpdate.payment_due_day && cardUpdate.payment_due_day !== account.payment_due_day ? { payment_due_day: cardUpdate.payment_due_day } : {}),
          ...(cardUpdate.credit_limit && cardUpdate.credit_limit !== account.credit_limit ? { credit_limit: cardUpdate.credit_limit } : {}),
        }
      : {};
  const hasCardChanges = Object.keys(cardChanges).length > 0;

  async function save() {
    if (!account || saving) return;
    setSaving(true);
    let done = 0;
    let failed = 0;
    try {
      const plain = selected.filter((r) => !r.otherAccountId);
      if (plain.length) {
        done += await txM.createMany.mutateAsync(
          plain.map((r) => ({
            account_id: account.id,
            kind: r.amount > 0 ? ("income" as const) : ("expense" as const),
            amount: Math.abs(r.amount),
            occurred_on: r.date,
            description: r.description,
            category_id: r.card_payment ? null : r.category_id,
            source: "import" as const,
          })),
        );
      }
      for (const r of selected.filter((x) => x.otherAccountId)) {
        try {
          // En la tarjeta el pago entra desde otra cuenta; en una cuenta, el pago sale hacia la tarjeta.
          const [from, to] = r.amount > 0 ? [r.otherAccountId, account.id] : [account.id, r.otherAccountId];
          await txM.transfer.mutateAsync({ from, to, amount: Math.abs(r.amount), occurred_on: r.date, description: r.description });
          done++;
        } catch {
          failed++;
        }
      }
      if (saveCardInfo && hasCardChanges) await accM.update.mutateAsync({ id: account.id, patch: cardChanges }).catch(() => undefined);
    } catch {
      setSaving(false);
      return; // el aviso global ya mostró el error
    }
    setSaving(false);
    toast(failed ? { title: `Importé ${done} movimientos`, description: `${failed} no se pudieron guardar.` } : { title: `Importé ${done} movimientos`, description: account.name });
    close(false);
  }

  const working = stage.name === "working";

  return (
    <Panel open={open} onOpenChange={close}>
      <PanelContent title="Importar estado de cuenta" description={stage.name === "review" ? "Revisa antes de guardar. Nada se guarda hasta que confirmes." : undefined}>
        {stage.name !== "review" && (
          <div className="flex flex-col gap-4 pb-4">
            <Field label="¿De qué cuenta o tarjeta es?" htmlFor="imp-account">
              <Select value={account?.id ?? ""} onValueChange={setSelectedAccount} disabled={working}>
                <SelectTrigger id="imp-account">
                  <SelectValue placeholder="Elige una cuenta">{account ? `${account.name}${account.last4 ? ` ···${account.last4}` : ""}` : "Elige una cuenta"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {active.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.last4 ? ` ···${a.last4}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {stage.name === "password" ? (
              <form
                className="flex flex-col gap-3 rounded-2xl border border-secondary bg-card p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (password) void processFile(stage.file, password);
                }}
              >
                <p className="flex items-center gap-2 text-sm font-bold">
                  <Lock className="h-4 w-4 text-primary" /> El PDF tiene contraseña
                </p>
                <p className="text-xs text-muted-foreground">Muchos bancos usan tu cédula o parte de ella. Se usa solo en tu teléfono para abrir el archivo.</p>
                <Field label="Contraseña del PDF" htmlFor="imp-pass" error={stage.wrong ? "Esa contraseña no abre el archivo." : undefined}>
                  <Input id="imp-pass" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                </Field>
                <Button type="submit" disabled={!password}>
                  Abrir
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={working || !account}
                className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-secondary px-4 py-8 text-center transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {working ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <FileUp className="h-7 w-7 text-primary" />}
                <span className="text-sm font-bold">{working ? stage.label : "Elegir archivo"}</span>
                <span className="text-xs text-muted-foreground">{working ? "Puede tardar unos segundos." : "PDF del banco, Excel, CSV o una foto del estado"}</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.txt,image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void processFile(f);
              }}
            />

            {error && (
              <p className="rounded-xl border border-negative/30 bg-negative/10 p-3 text-sm font-semibold" role="alert">
                {error}
              </p>
            )}
            <p className="flex gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              El archivo se lee en tu teléfono y no se guarda. A la IA solo van las líneas con movimientos (o la imagen, si es una foto). Sirve con Popular, Banreservas, BHD, Scotiabank, APAP, Santa Cruz, Promerica, Caribe, BDI y otros.
            </p>
          </div>
        )}

        {stage.name === "review" && result && account && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-secondary bg-card p-3.5 text-sm">
              <p className="font-bold">
                {[result.bank, result.last4 && `···${result.last4}`].filter(Boolean).join(" ") || account.name}
                {result.period_from && result.period_to && <span className="font-normal text-muted-foreground"> · {shortDate(result.period_from)} – {shortDate(result.period_to)}</span>}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Entradas <Money amount={inflow} currency={account.currency} className="font-semibold text-positive" />
                </span>
                <span>
                  Salidas <Money amount={outflow} currency={account.currency} className="font-semibold text-foreground" />
                </span>
                {result.minimum_payment && (
                  <span>
                    Pago mínimo <Money amount={result.minimum_payment} currency={account.currency} className="font-semibold text-foreground" />
                  </span>
                )}
                {result.closing_balance && (
                  <span>
                    {isCard ? "Saldo al corte" : "Saldo final"} <Money amount={result.closing_balance} currency={account.currency} className="font-semibold text-foreground" />
                  </span>
                )}
              </div>
              {hasCardChanges && (
                <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-t border-secondary pt-3 text-xs">
                  <Checkbox checked={saveCardInfo} onCheckedChange={(v) => setSaveCardInfo(v === true)} className="mt-0.5 h-5 w-5" />
                  <span>
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <CreditCard className="h-3.5 w-3.5" /> Actualizar la tarjeta
                    </span>
                    {[
                      cardChanges.statement_day && `corte día ${cardChanges.statement_day}`,
                      cardChanges.payment_due_day && `pago día ${cardChanges.payment_due_day}`,
                      cardChanges.credit_limit && "límite del estado",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </label>
              )}
            </div>

            {notes.map((n) => (
              <p key={n} className="rounded-xl border border-secondary bg-card p-3 text-xs" role="status">
                {n}
              </p>
            ))}

            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">
                {selected.length} de {rows.length} seleccionados{rows.some((r) => r.duplicate) ? ` · ${rows.filter((r) => r.duplicate).length} ya registrados` : ""}
              </span>
              <button
                type="button"
                className="-my-2 py-2 font-semibold text-primary"
                onClick={() => setRows((list) => list.map((r) => ({ ...r, selected: selected.length < rows.length })))}
              >
                {selected.length < rows.length ? "Marcar todos" : "Quitar todos"}
              </button>
            </div>

            <ul className="flex flex-col divide-y divide-secondary">
              {rows.map((r) => {
                const kind = r.amount > 0 ? "income" : "expense";
                const transferOptions = r.card_payment && ((isCard && r.amount > 0) || (!isCard && r.amount < 0)) ? otherAccounts : [];
                return (
                  <li key={r.key} className={cn("flex gap-3 py-2.5", !r.selected && "opacity-55")}>
                    <Checkbox checked={r.selected} onCheckedChange={(v) => update(r.key, { selected: v === true })} aria-label={`Importar ${r.description}`} className="mt-0.5 h-5 w-5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{r.description}</span>
                        <Money amount={r.amount} currency={account.currency} sign="always" className={cn("shrink-0 text-sm font-bold", r.amount > 0 && "text-positive")} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{shortDate(r.date)}</span>
                        {r.duplicate && <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold text-foreground">Ya registrado</span>}
                        {transferOptions.length > 0 ? (
                          <select
                            aria-label={r.amount > 0 ? "Pagada desde" : "Tarjeta pagada"}
                            value={r.otherAccountId}
                            onChange={(e) => update(r.key, { otherAccountId: e.target.value })}
                            className="h-8 max-w-[13rem] rounded-md border border-secondary bg-card px-2 text-xs text-foreground"
                          >
                            {transferOptions.map((a) => (
                              <option key={a.id} value={a.id}>
                                {r.amount > 0 ? `Pago desde ${a.name}` : `Pago a ${a.name}`}
                              </option>
                            ))}
                            <option value="">{r.amount > 0 ? "Registrar como ingreso" : "Registrar como gasto"}</option>
                          </select>
                        ) : (
                          <select
                            aria-label="Categoría"
                            value={r.category_id ?? ""}
                            onChange={(e) => {
                              const c = categories.find((x) => x.id === e.target.value);
                              update(r.key, { category_id: c?.id ?? null, category_name: c?.name ?? null });
                            }}
                            className="h-8 max-w-[11rem] rounded-md border border-secondary bg-card px-2 text-xs text-foreground"
                          >
                            <option value="">Sin categoría</option>
                            {categories
                              .filter((c) => c.kind === kind)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <PanelFooter>
              <Button type="button" variant="secondary" onClick={() => setStage({ name: "pick" })} disabled={saving}>
                Otro archivo
              </Button>
              <Button type="button" className="flex-1" onClick={save} disabled={saving || !selected.length}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                {saving ? "Guardando…" : `Importar ${selected.length}`}
              </Button>
            </PanelFooter>
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}
