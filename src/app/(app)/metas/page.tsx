"use client";

import { useMemo, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Lock, Pencil, Plus, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, PanelContent } from "@/components/ui/panel";
import { Money } from "@/components/money";
import { EmptyState, PageHeader, SectionTitle } from "@/components/shell/page-header";
import { useSheets } from "@/components/shell/sheets";
import { PinPad } from "@/components/security/pin-pad";
import { GoalPanel } from "@/components/goals/goal-panel";
import { useAccounts, useGoalMutations, useGoals, useHasPin } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { verifyPin } from "@/lib/data/profile";
import { parseDate, shortDate } from "@/lib/dates";
import type { Account, Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Meses que quedan hasta la fecha límite (redondeado hacia arriba); null si ya pasó. */
function monthsLeft(deadline: string) {
  const days = differenceInCalendarDays(parseDate(deadline), new Date());
  if (days < 0) return null;
  return Math.max(1, Math.ceil(days / 30.44));
}

export default function MetasPage() {
  const { data: goals, isLoading, isError, refetch } = useGoals();
  const { data: accounts = [] } = useAccounts();
  const { data: hasPin } = useHasPin();
  const gm = useGoalMutations();
  const sheets = useSheets();

  // `key` fuerza un formulario limpio cada vez que se abre.
  const [panel, setPanel] = useState<{ key: number; goal?: Goal } | null>(null);
  const [pinFor, setPinFor] = useState<{ goal: Goal; thenEdit?: boolean } | null>(null);
  // Metas privadas desbloqueadas: solo en memoria, durante esta visita.
  const [unlocked, setUnlocked] = useState<ReadonlySet<string>>(() => new Set());
  const [showDone, setShowDone] = useState(false);

  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const active = useMemo(() => (goals ?? []).filter((g) => g.status === "active"), [goals]);
  const done = useMemo(() => (goals ?? []).filter((g) => g.status !== "active"), [goals]);

  // Mientras no sepamos si hay PIN, las privadas quedan ocultas. Sin PIN no hay con qué verificar.
  const isLocked = (g: Goal) => g.is_private && hasPin !== false && !unlocked.has(g.id);

  const openNew = () => setPanel({ key: Date.now() });

  function edit(g: Goal) {
    if (isLocked(g)) setPinFor({ goal: g, thenEdit: true });
    else setPanel({ key: Date.now(), goal: g });
  }

  function lock(g: Goal) {
    setUnlocked((prev) => {
      const next = new Set(prev);
      next.delete(g.id);
      return next;
    });
  }

  function handleUnlocked() {
    if (!pinFor) return;
    const { goal, thenEdit } = pinFor;
    setUnlocked((prev) => new Set(prev).add(goal.id));
    setPinFor(null);
    if (thenEdit) setPanel({ key: Date.now(), goal });
  }

  async function complete(g: Goal) {
    try {
      await gm.update.mutateAsync({ id: g.id, patch: { status: "completed" } });
    } catch {
      return;
    }
    toast({ title: "¡Meta completada!", description: g.name });
  }

  const card = (g: Goal) => (
    <li key={g.id}>
      <GoalCard
        goal={g}
        account={g.account_id ? accById.get(g.account_id) : undefined}
        locked={isLocked(g)}
        completing={gm.update.isPending && gm.update.variables?.id === g.id}
        onUnlock={() => setPinFor({ goal: g })}
        onLock={() => lock(g)}
        onEdit={() => edit(g)}
        onComplete={() => complete(g)}
        onContribute={() => g.account_id && sheets.open({ type: "transfer", preset: { to: g.account_id, description: `Aporte: ${g.name}` } })}
        onWithdraw={() => g.account_id && sheets.open({ type: "transfer", preset: { from: g.account_id, description: `Retiro: ${g.name}` } })}
      />
    </li>
  );

  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageHeader
        title="Metas"
        subtitle="Ahorra con un objetivo"
        actions={
          <Button onClick={openNew} className="h-11 rounded-full px-4 text-sm">
            <Plus />
            Nueva meta
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[210px] w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-secondary bg-card p-6 text-center" role="alert">
          <p className="text-sm text-muted-foreground">No pudimos cargar tus metas.</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : !goals?.length ? (
        <EmptyState
          icon={Target}
          title="Aún no tienes metas"
          action={
            <Button onClick={openNew}>
              <Plus />
              Crear mi primera meta
            </Button>
          }
        >
          Un viaje, el inicial de un carro o tu fondo de emergencia. Te decimos cuánto te falta y cuánto apartar cada mes.
        </EmptyState>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <SectionTitle>Activas</SectionTitle>
            {active.length ? (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{active.map(card)}</ul>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No tienes metas activas.</p>
            )}
          </section>

          {done.length > 0 && (
            <section className="flex flex-col gap-3">
              <button
                type="button"
                aria-expanded={showDone}
                aria-controls="metas-terminadas"
                onClick={() => setShowDone((s) => !s)}
                className="flex h-11 items-center justify-between rounded-lg text-[15px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Completadas y archivadas ({done.length})
                <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", showDone && "rotate-180")} aria-hidden="true" />
              </button>
              {showDone && (
                <ul id="metas-terminadas" className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {done.map(card)}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {panel && <GoalPanel key={panel.key} open onOpenChange={(o) => !o && setPanel(null)} goal={panel.goal} />}
      {pinFor && <PinUnlockPanel goal={pinFor.goal} onClose={() => setPinFor(null)} onUnlocked={handleUnlocked} />}
    </div>
  );
}

function GoalCard({
  goal,
  account,
  locked,
  completing,
  onUnlock,
  onLock,
  onEdit,
  onComplete,
  onContribute,
  onWithdraw,
}: {
  goal: Goal;
  account?: Account;
  locked: boolean;
  completing: boolean;
  onUnlock: () => void;
  onLock: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onContribute: () => void;
  onWithdraw: () => void;
}) {
  const current = Math.max(0, account?.balance ?? 0);
  const pct = goal.target_amount > 0 ? Math.min(100, (current / goal.target_amount) * 100) : 0;
  const reached = current >= goal.target_amount;
  const remaining = Math.max(0, goal.target_amount - current);
  const months = goal.deadline ? monthsLeft(goal.deadline) : null;
  const overdue = Boolean(goal.deadline) && months === null;
  const perMonth = months ? Math.ceil(remaining / months) : null;
  const titleId = `meta-${goal.id}`;
  const meta = [goal.deadline ? `Para el ${shortDate(goal.deadline)}` : "Sin fecha límite", account ? account.name : "Sin cuenta vinculada"].join(" · ");

  return (
    <article aria-labelledby={titleId} className="flex h-full flex-col gap-3.5 rounded-2xl border border-secondary bg-card p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", reached && !locked ? "bg-primary text-primary-foreground" : "bg-secondary text-primary")}
          aria-hidden="true"
        >
          {reached && !locked ? <Trophy className="h-5 w-5" /> : <Target className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="flex items-center gap-1.5 text-[15px] font-bold">
            <span className="truncate">{goal.name}</span>
            {goal.is_private && (
              <>
                <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">(privada)</span>
              </>
            )}
          </h3>
          <p className="truncate text-xs text-muted-foreground">{meta}</p>
          {goal.status === "completed" ? (
            <span className="mt-1.5 inline-flex rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">Completada</span>
          ) : goal.status === "archived" ? (
            <span className="mt-1.5 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Archivada</span>
          ) : reached && !locked ? (
            <span className="mt-1.5 inline-flex rounded-full bg-primary px-2 py-0.5 text-[11px] font-extrabold text-primary-foreground">¡Lograda!</span>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-1" aria-label={`Editar meta ${goal.name}`} onClick={onEdit}>
          <Pencil />
        </Button>
      </div>

      {locked ? (
        <button
          type="button"
          onClick={onUnlock}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-dashed border-secondary px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Lock className="h-4 w-4" aria-hidden="true" />
          Montos ocultos · Ver con tu PIN
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
              <Money amount={current} currency={goal.currency} className="text-xl font-extrabold" />
              <span className="text-[13px] text-muted-foreground">
                de <Money amount={goal.target_amount} currency={goal.currency} className="font-semibold text-foreground" />
              </span>
            </p>
            <span className="tabular text-[15px] font-extrabold text-primary">{Math.floor(pct)}%</span>
          </div>
          <Progress value={pct} aria-label={`Progreso de ${goal.name}`} className="h-2.5 [&>div]:bg-primary" />
          <p className="text-[13px] text-muted-foreground">
            {reached ? (
              "¡Llegaste a tu meta!"
            ) : (
              <>
                Te faltan <Money amount={remaining} currency={goal.currency} className="font-semibold text-foreground" />
                {perMonth ? (
                  <>
                    {" · ~"}
                    <Money amount={perMonth} currency={goal.currency} className="font-semibold text-foreground" /> al mes
                  </>
                ) : null}
                {overdue && " · La fecha límite ya pasó"}
              </>
            )}
          </p>
          {goal.is_private && (
            <button
              type="button"
              onClick={onLock}
              className="flex h-11 items-center gap-1.5 self-start rounded-lg text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Ocultar montos
            </button>
          )}
        </div>
      )}

      {goal.status !== "archived" && (
        <div className="mt-auto flex flex-col gap-2">
          {reached && goal.status === "active" && !locked && (
            <Button onClick={onComplete} disabled={completing}>
              <Check />
              {completing ? "Guardando…" : "Marcar como completada"}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onContribute} disabled={!goal.account_id}>
              <ArrowDownLeft />
              Aportar
            </Button>
            <Button variant="secondary" onClick={onWithdraw} disabled={!goal.account_id}>
              <ArrowUpRight />
              Retirar
            </Button>
          </div>
          {!goal.account_id && <p className="text-xs text-muted-foreground">Vincula una cuenta (toca Editar) para poder aportar.</p>}
        </div>
      )}
    </article>
  );
}

function PinUnlockPanel({ goal, onClose, onUnlocked }: { goal: Goal; onClose: () => void; onUnlocked: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  async function check(pin: string) {
    setBusy(true);
    try {
      const r = await verifyPin(pin);
      if (r.ok) return onUnlocked();
      setError(
        r.reason === "locked"
          ? `Demasiados intentos. Espera hasta las ${new Date(r.locked_until ?? Date.now()).toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit" })}.`
          : r.reason === "no_pin"
            ? "Aún no tienes un PIN. Créalo en Ajustes."
            : `PIN incorrecto${r.attempts_left ? `. Te quedan ${r.attempts_left} intentos` : ""}.`,
      );
    } catch {
      setError("No se pudo verificar. Revisa tu conexión.");
    } finally {
      setBusy(false);
      setAttempt((a) => a + 1);
    }
  }

  return (
    <Panel open onOpenChange={(o) => !o && onClose()}>
      <PanelContent title="Meta privada" description={`Escribe tu PIN para ver los montos de «${goal.name}».`}>
        <div className="flex justify-center pb-8 pt-4">
          <PinPad onComplete={check} disabled={busy} error={error} resetKey={attempt} />
        </div>
      </PanelContent>
    </Panel>
  );
}
