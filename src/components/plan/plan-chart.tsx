"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Money, useHideAmounts } from "@/components/money";
import { dayLabel, shortDate } from "@/lib/dates";
import type { PlanEvent, PlanResult } from "@/lib/plan/types";

const LINE = "#C8F05A";
const NEGATIVE = "#FF8A7A";
const AXIS = "#9AA0AA";
const GRID = "#262A31";

interface Point {
  date: string;
  value: number;
}

/** Saldo de "tu dinero" día a día: línea escalonada, periodos sombreados y el colchón punteado. */
export function PlanChart({ plan, month }: { plan: PlanResult; month?: string | null }) {
  const hide = useHideAmounts();
  const eventsByDay = useMemo(() => {
    const m = new Map<string, PlanEvent[]>();
    for (const e of plan.events) if (!e.past && e.type !== "estimate") m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [plan.events]);
  const data: Point[] = useMemo(
    () => plan.series.filter((p) => !month || p.date.startsWith(month)).map((p) => ({ date: p.date, value: p.balance / 100 })),
    [plan.series, month],
  );
  if (!data.length) return null;
  const first = data[0].date;
  const last = data[data.length - 1].date;
  const compact = new Intl.NumberFormat("es-DO", { notation: "compact", maximumFractionDigits: 1 });

  return (
    <div className="h-[230px] w-full" role="img" aria-label={`Saldo de tu dinero día a día del ${shortDate(first)} al ${shortDate(last)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          {plan.periods.map((p) => {
            const x1 = p.start < first ? first : p.start;
            const x2 = p.end > last ? last : p.end;
            return x1 <= x2 ? <ReferenceArea key={p.id} x1={x1} x2={x2} fill={LINE} fillOpacity={0.07} ifOverflow="hidden" /> : null;
          })}
          {plan.cushion > 0 && <ReferenceLine y={plan.cushion / 100} stroke={NEGATIVE} strokeDasharray="4 4" ifOverflow="extendDomain" />}
          <ReferenceLine y={0} stroke={AXIS} strokeOpacity={0.4} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11 }} tickFormatter={(d: string) => shortDate(d)} minTickGap={28} dy={6} />
          <YAxis hide={hide} width={44} axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11 }} tickFormatter={(v: number) => compact.format(v)} />
          <Tooltip content={<DayTooltip eventsByDay={eventsByDay} currency={plan.currency} />} cursor={{ stroke: AXIS, strokeOpacity: 0.4 }} wrapperStyle={{ zIndex: 10 }} />
          <Line type="stepAfter" dataKey="value" stroke={LINE} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DayTooltip({ active, payload, eventsByDay, currency }: { active?: boolean; payload?: { payload: Point }[]; eventsByDay: Map<string, PlanEvent[]>; currency: string }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  const events = eventsByDay.get(p.date) ?? [];
  return (
    <div className="max-w-[260px] rounded-lg border border-secondary bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-bold">{dayLabel(p.date)}</p>
      {events.slice(0, 5).map((e) => (
        <p key={e.id} className="mt-1 flex justify-between gap-3 text-muted-foreground">
          <span className="truncate">{e.label}</span>
          <Money amount={e.amount} currency={e.currency} sign={e.effect === 0 ? "never" : "always"} className="font-semibold text-foreground" />
        </p>
      ))}
      {events.length > 5 && <p className="mt-1 text-muted-foreground">y {events.length - 5} más</p>}
      <p className="mt-1.5 flex justify-between gap-3 border-t border-secondary pt-1.5">
        <span className="text-muted-foreground">Queda</span>
        <Money amount={Math.round(p.value * 100)} currency={currency} className="font-bold" />
      </p>
    </div>
  );
}
