"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, MessageCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/page-header";
import { GraficoSaldo } from "./grafico";
import { usePlan } from "@/lib/finanzas/datos";
import { cifra } from "@/lib/finanzas/motor";
import { conSigno, enMoneda, fechaCorta, fechaHora, rd } from "@/lib/finanzas/formato";
import type { Plan } from "@/lib/finanzas/tipos";

function Tarjeta({ titulo, nota, children, className, id }: { titulo: string; nota?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <h2 className="text-[15px] font-bold">{titulo}</h2>
      {nota && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Cifra({ etiqueta, valor, sub, tono, barra }: { etiqueta: string; valor: string; sub?: React.ReactNode; tono?: "bien" | "mal"; barra?: number }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-2xl border border-border bg-card p-3.5", tono === "bien" && "border-primary/40", tono === "mal" && "border-negative/50")}>
      <span className="text-xs font-semibold text-muted-foreground">{etiqueta}</span>
      <span className={cn("text-[22px] font-extrabold tabular-nums tracking-tight", tono === "bien" && "text-primary", tono === "mal" && "text-negative")}>{valor}</span>
      {barra !== undefined && (
        <div className="my-1 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className={cn("h-full rounded-full", tono === "mal" ? "bg-negative" : "bg-primary")} style={{ width: `${Math.max(0, Math.min(100, barra))}%` }} />
        </div>
      )}
      {sub && <span className="text-[11.5px] leading-snug text-muted-foreground">{sub}</span>}
    </div>
  );
}

function Chips<T extends string>({ opciones, valor, onChange }: { opciones: { v: T; label: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {opciones.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={valor === o.v}
          className={cn(
            "h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            valor === o.v ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Th = ({ children, num, className }: { children?: React.ReactNode; num?: boolean; className?: string }) => (
  <th className={cn("whitespace-nowrap px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", num && "text-right", className)}>{children}</th>
);
const Td = ({ children, num, className }: { children?: React.ReactNode; num?: boolean; className?: string }) => (
  <td className={cn("px-2 py-2 align-top", num && "whitespace-nowrap text-right tabular-nums", className)}>{children}</td>
);

function Tabla({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full border-collapse text-[13px] [&_tbody_tr]:border-t [&_tbody_tr]:border-border">{children}</table>
    </div>
  );
}

type TipoEv = "todo" | "cobro" | "tarjeta" | "deuda" | "otro";

export function PlanVista() {
  const { plan, fila, isLoading, error, refetch } = usePlan();
  if (isLoading)
    return (
      <div className="flex flex-col gap-3 pt-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  if (error)
    return (
      <div className="pt-10">
        <EmptyState title="No pude cargar tu plan" action={<Button onClick={refetch}>Reintentar</Button>}>
          Revisa tu conexión e intenta de nuevo.
        </EmptyState>
      </div>
    );
  if (!plan || !fila)
    return (
      <div className="pt-10">
        <EmptyState icon={MessageCircle} title="Todavía no hay plan" action={<Button asChild><Link href="/chat">Ir al chat</Link></Button>}>
          Cuéntale al asistente tus cuentas, tarjetas y cobros, y arma el plan contigo.
        </EmptyState>
      </div>
    );
  return <Contenido plan={plan} actualizado={fila.actualizado} estado={fila.datos} />;
}

function Contenido({ plan, actualizado, estado }: { plan: Plan; actualizado: string; estado: NonNullable<ReturnType<typeof usePlan>["fila"]>["datos"] }) {
  const v = (k: string) => cifra(plan, k)?.valor ?? 0;
  const t = (k: string) => cifra(plan, k)?.texto ?? "";
  const acreedor = estado.deuda.acreedor;
  const actual = plan.presupuesto.find((p) => p.estado === "actual") ?? plan.presupuesto[0];
  const minimo = v("saldo_minimo");
  const bajoColchon = minimo < estado.colchon;
  const principal = estado.cuentas.find((c) => c.principal) ?? estado.cuentas[0];

  // Filtros de "Qué entra y qué sale"
  const [tipo, setTipo] = useState<TipoEv>("todo");
  const [mes, setMes] = useState("todos");
  const meses = useMemo(() => [...new Set(plan.calendario.slice(1).map((e) => e.fecha.slice(0, 7)))], [plan.calendario]);
  const eventos = plan.calendario.filter((e, i) => {
    if (i === 0) return true;
    if (mes !== "todos" && !e.fecha.startsWith(mes)) return false;
    if (tipo === "todo") return true;
    if (tipo === "cobro") return e.tipo === "Cobro";
    if (tipo === "tarjeta") return e.tipo === "Tarjeta";
    if (tipo === "deuda") return e.tipo === acreedor;
    return e.tipo === "Otro";
  });

  // Filtros de movimientos
  const [busca, setBusca] = useState("");
  const [con, setCon] = useState("todas");
  const medios = useMemo(() => [...new Set(plan.movimientos.map((m) => m.tarjeta))], [plan.movimientos]);
  const movs = plan.movimientos.filter((m) => (con === "todas" || m.tarjeta === con) && (!busca.trim() || `${m.descripcion} ${m.categoria} ${m.nota}`.toLowerCase().includes(busca.trim().toLowerCase())));

  const viajeDias = v("viaje_dias");
  const gastadoViaje = v("viaje_gastado_eur");
  const nombreMes = (ym: string) => fechaCorta(`${ym}-01`).split(" ")[1] + " " + ym.slice(2, 4);

  return (
    <div className="flex flex-col gap-3 pb-6 pt-4 md:pt-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Mis finanzas</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Tu dinero de verdad hoy es <b className="text-foreground">{rd(v("saldo_hoy"))}</b>
          {v("prestado_total") > 0 && (
            <>
              ; los <b className="text-foreground">{rd(v("prestado_total"))}</b> prestados no se tocan
            </>
          )}
          . Sales de viaje con <b className="text-foreground">{rd(v("saldo_salida"))}</b> y llegas al {fechaCorta(estado.horizonte)} con <b className="text-foreground">{rd(v("saldo_final"))}</b>, con todo pagado.
        </p>
        <p className="mt-1 text-xs text-subtle">Actualizado {fechaHora(actualizado)}</p>
      </header>

      {bajoColchon && (
        <div className="flex gap-3 rounded-2xl border border-negative/40 bg-negative/10 p-3.5 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-negative" />
          <p>
            El <b>{t("saldo_minimo")}</b> tu dinero baja a <b>{rd(minimo)}</b>, por debajo de tu colchón de {rd(estado.colchon)}. Cualquier gasto extra antes de esa fecha lo empeora.
          </p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <Cifra etiqueta="Tu dinero" valor={rd(v("saldo_hoy"))} sub={<>El banco dice {rd(v("saldo_banco"))}{v("prestado_total") > 0 ? ", pero incluye lo prestado" : ""}</>} />
        {actual && (
          <Cifra
            etiqueta="Puedes gastar esta quincena"
            valor={rd(actual.queda)}
            tono={actual.queda < 0 ? "mal" : "bien"}
            barra={actual.presupuesto ? (actual.gastado / actual.presupuesto) * 100 : 0}
            sub={<>Gastado {rd(actual.gastado)} de {rd(actual.presupuesto)}, hasta el {fechaCorta(actual.hasta)}</>}
          />
        )}
        <Cifra etiqueta="Próximo pago de tarjeta" valor={rd(v("proximo_pago"))} sub={<>{t("proximo_pago").replace(/^Pagar /, "")}, el {t("proximo_pago_fecha")}</>} />
        <Cifra
          etiqueta={`Le debes a ${acreedor.toLowerCase()}`}
          valor={rd(v("deuda_restante"))}
          barra={v("deuda_total") ? (v("deuda_pagada") / v("deuda_total")) * 100 : 0}
          sub={<>Pagado {rd(v("deuda_pagada"))} de {rd(v("deuda_total"))}</>}
        />
        <Cifra etiqueta="Punto más bajo" valor={rd(minimo)} tono={bajoColchon ? "mal" : undefined} sub={<>el {t("saldo_minimo")} · colchón {rd(estado.colchon)}</>} />
        <Cifra etiqueta="Te queda al terminar" valor={rd(v("saldo_final"))} sub={<>el {t("saldo_final")}, con todo pagado</>} />
      </section>

      {plan.prestado.length > 0 && (
        <Tarjeta titulo="Dinero prestado: no se toca" nota="Está en tu cuenta pero no es tuyo. Se devuelve completo y no cuenta en ningún cálculo.">
          <Tabla>
            <thead>
              <tr>
                <Th>De</Th>
                <Th num>Monto</Th>
                <Th>Ahora</Th>
                <Th className="hidden sm:table-cell">Devolver</Th>
              </tr>
            </thead>
            <tbody>
              {plan.prestado.map((p) => (
                <tr key={p.id}>
                  <Td className="font-semibold">{p.de}</Td>
                  <Td num>{rd(p.monto)}</Td>
                  <Td>{p.estado}</Td>
                  <Td className="hidden text-muted-foreground sm:table-cell">{p.devolver}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      )}

      <Tarjeta titulo="Tu dinero, día a día" nota={<>Sin lo prestado, con cada cobro y pago hasta el {fechaCorta(estado.horizonte)}. La franja es el viaje; la línea punteada, el colchón. Toca un día para ver qué pasa.</>}>
        <GraficoSaldo calendario={plan.calendario} colchon={estado.colchon} viaje={estado.viaje} hasta={estado.horizonte} />
      </Tarjeta>

      <Tarjeta titulo="Qué entra y qué sale" nota={`Cada cobro y pago en orden, con qué cuenta o tarjeta, y cuánto te queda después. Los pagos "estimado" incluyen lo que falta del presupuesto.`}>
        <Chips<TipoEv>
          valor={tipo}
          onChange={setTipo}
          opciones={[
            { v: "todo", label: "Todo" },
            { v: "cobro", label: "Cobros" },
            { v: "tarjeta", label: "Tarjetas" },
            { v: "deuda", label: acreedor },
            { v: "otro", label: "Otros" },
          ]}
        />
        <Chips<string> valor={mes} onChange={setMes} opciones={[{ v: "todos", label: "Todos los meses" }, ...meses.map((m) => ({ v: m, label: nombreMes(m) }))]} />
        <Tabla>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Qué</Th>
              <Th num>Monto</Th>
              <Th num>Queda</Th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id} className={cn(e.tipo === "Hoy" && "bg-primary-soft")}>
                <Td className="whitespace-nowrap text-muted-foreground">{fechaCorta(e.fecha, true)}</Td>
                <Td>
                  <div className={cn(e.tipo === "Hoy" && "font-semibold")}>{e.concepto}</div>
                  <div className="mt-0.5 inline-block rounded-md bg-secondary px-1.5 py-px text-[11px] text-muted-foreground">{e.medio}</div>
                </Td>
                <Td num className={cn(e.monto > 0 && "text-positive")}>{e.tipo === "Hoy" ? "" : conSigno(e.monto)}</Td>
                <Td num className={cn("font-semibold", e.saldo < estado.colchon && "text-negative")}>{rd(e.saldo)}</Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Tarjeta>

      <div className="grid gap-3 md:grid-cols-2">
        <Tarjeta titulo="Tarjetas" nota={estado.tarjetas.map((x) => `La ${x.corto} corta el ${x.corte_dia}, vence el ${x.vence_dia} y la pagas el ${x.pago_dia}.`).join(" ") + " Siempre el total."}>
          <div className="flex flex-col gap-2">
            {plan.tarjetas.map((r) => (
              <div key={r.id} className={cn("rounded-xl border border-border p-3", r.estado === "Pagado" && "opacity-60")}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{r.tarjeta}</span>
                  <span className="text-base font-extrabold tabular-nums">{rd(r.total)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                  <span>Corte {fechaCorta(r.corte)}</span>
                  <span className="text-foreground">Pagas el {fechaCorta(r.pagar, true)}</span>
                  <span>Vence {fechaCorta(r.vence)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-muted-foreground">
                  <span>Cargado {rd(r.cargado)}{r.usd_cargado ? ` (US$ ${r.usd_cargado})` : ""}</span>
                  {r.por_venir > 0 && <span>Por venir {rd(r.por_venir)}</span>}
                  <span className={cn("font-semibold", r.estado === "En curso" && "text-primary")}>{r.estado}</span>
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta titulo={`Plan con ${acreedor.toLowerCase()}`} nota={<>Después del {fechaCorta(estado.horizonte)} te faltarían {rd(v("deuda_tras_ene"))}. Termina el {t("deuda_fin")} si sigues el plan.</>}>
          <Tabla>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Qué</Th>
                <Th num>Monto</Th>
                <Th num>Después</Th>
              </tr>
            </thead>
            <tbody>
              {plan.papi.map((p) => (
                <tr key={p.id} className={cn(p.estado === "Hecho" && "text-muted-foreground")}>
                  <Td className="whitespace-nowrap">{fechaCorta(p.fecha)}</Td>
                  <Td>
                    {p.concepto}
                    {p.estado === "Hecho" && <span className="ml-1 text-[11px] text-primary">✓</span>}
                  </Td>
                  <Td num>{rd(p.monto)}</Td>
                  <Td num>{rd(p.queda_despues)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Tarjeta titulo="Cuánto puedes gastar" nota={<>En casa: {rd(estado.presupuesto_casa_mes)} al mes, repartidos de cobro a cobro. Solo cuenta el día a día; regalos y viaje van aparte.</>}>
          <div className="flex flex-col gap-2">
            {plan.presupuesto.map((p) => {
              const pct = p.presupuesto ? Math.min(100, (p.gastado / p.presupuesto) * 100) : 0;
              return (
                <div key={p.id} className={cn("rounded-xl border border-border p-3", p.estado === "actual" && "border-primary/50 bg-primary-soft", p.estado === "pasado" && "opacity-60")}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-semibold">{p.periodo}</span>
                    <span className={cn("font-bold tabular-nums", p.queda < 0 && "text-negative")}>Queda {rd(p.queda)}</span>
                  </div>
                  <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className={cn("h-full rounded-full", p.queda < 0 ? "bg-negative" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Gastado {rd(p.gastado)} de {rd(p.presupuesto)}
                  </div>
                </div>
              );
            })}
          </div>
        </Tarjeta>

        <Tarjeta titulo={estado.viaje.nombre ?? "Viaje"} nota={<>{fechaCorta(estado.viaje.inicio)} – {fechaCorta(estado.viaje.fin)} · {viajeDias} días{estado.viaje.incluye ? ` · incluye ${estado.viaje.incluye}` : ""}.</>}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[11px] text-muted-foreground">Para gastar</div>
              <div className="text-lg font-extrabold tabular-nums">€ {estado.viaje.presupuesto_eur.toLocaleString("en-US")}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Gastado</div>
              <div className="text-lg font-extrabold tabular-nums">€ {gastadoViaje.toLocaleString("en-US")}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Queda</div>
              <div className="text-lg font-extrabold tabular-nums text-primary">€ {v("viaje_queda_eur").toLocaleString("en-US")}</div>
            </div>
          </div>
          <div className="my-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (gastadoViaje / (estado.viaje.presupuesto_eur || 1)) * 100)}%` }} />
          </div>
          <p className="text-[13px] text-muted-foreground">
            € {estado.viaje.efectivo_eur} en efectivo y € {estado.viaje.presupuesto_eur - estado.viaje.efectivo_eur} con la {t("viaje_tarjeta_eur").replace(/^Con la /, "")}. Promedio: € {v("viaje_por_dia_eur")} por día.
          </p>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Movimientos" nota="Lo que ya se cargó y lo planificado, con qué se paga y cuándo lo pagas.">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar (ej. regalo, súper)" className="h-10 pl-9" aria-label="Buscar movimientos" />
        </div>
        <Chips<string> valor={con} onChange={setCon} opciones={[{ v: "todas", label: "Todas" }, ...medios.map((m) => ({ v: m, label: m.replace(/^Sale de la /, "Débito ") }))]} />
        <div className="flex flex-col">
          {movs.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nada con ese filtro.</p>}
          {movs.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 border-t border-border py-2.5 text-[13px] first:border-t-0">
              <div className="min-w-0">
                <div className="font-semibold">{m.descripcion}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">
                  {fechaCorta(m.fecha)} · {m.tarjeta} · {m.categoria} · {m.estado === "Cargado" ? `se paga el ${fechaCorta(m.paga_el)}` : m.estado.toLowerCase()}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-bold tabular-nums">{enMoneda(m.monto, m.moneda)}</div>
                {m.moneda !== "DOP" && <div className="text-[11px] text-muted-foreground tabular-nums">{rd(m.monto_dop)}</div>}
              </div>
            </div>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Supuestos del plan" nota="Lo que se asume para calcular. Si algo cambia, díselo al chat.">
        <dl className="flex flex-col gap-2.5 text-[13px]">
          {plan.supuestos.map((s) => (
            <div key={s.id}>
              <dt className="font-semibold">{s.supuesto}</dt>
              <dd className="text-muted-foreground">{s.valor}</dd>
            </div>
          ))}
          <div>
            <dt className="font-semibold">Saldo del banco</dt>
            <dd className="text-muted-foreground">
              {principal.cuenta}: {rd(principal.saldo)}. Cuando cobres o pagues, dile al chat el saldo nuevo.
            </dd>
          </div>
        </dl>
      </Tarjeta>

      <Link href="/chat" className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-secondary p-4 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <MessageCircle className="h-4 w-4" /> Para actualizar, cuéntaselo al chat
      </Link>
    </div>
  );
}
