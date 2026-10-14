// Motor del plan: a partir del documento del plan y la fecha de hoy calcula
// todo lo que se ve en la pantalla. Es una función pura y da exactamente los
// mismos números que la página "Mis finanzas" original (generar.py).
import type {
  Estado,
  FilaCalendario,
  FilaDeuda,
  FilaMovimiento,
  FilaPrestado,
  FilaPresupuesto,
  FilaResumen,
  FilaTarjeta,
  Moneda,
  Plan,
  Supuesto,
  Tarjeta,
} from "./tipos";

// ---------- fechas como número de días (UTC), sin horas ni zonas ----------
const DIA_MS = 86_400_000;
export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function dia(s: string): number {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DIA_MS);
}
export function iso(n: number): string {
  return new Date(n * DIA_MS).toISOString().slice(0, 10);
}
function partes(n: number): [number, number, number] {
  const f = new Date(n * DIA_MS);
  return [f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate()];
}
function fecha(y: number, m: number, d: number): number {
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.round(Date.UTC(y, m - 1, Math.min(d, ultimo)) / DIA_MS);
}
function masMes(y: number, m: number, k = 1): [number, number] {
  m += k;
  while (m > 12) {
    y += 1;
    m -= 12;
  }
  return [y, m];
}
export function fd(n: number): string {
  const [, m, d] = partes(n);
  return `${d} ${MESES[m - 1]}`;
}

/** Hoy en Santo Domingo, como YYYY-MM-DD. */
export function hoyRD(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

// ---------- redondeo igual que Python ----------
/** round(x) de Python: al par más cercano en los empates. */
export function redondear(x: number): number {
  const piso = Math.floor(x);
  const resto = x - piso;
  let r: number;
  if (resto > 0.5) r = piso + 1;
  else if (resto < 0.5) r = piso;
  else r = piso % 2 === 0 ? piso : piso + 1;
  return r === 0 ? 0 : r;
}
/** round(x, 2) de Python. */
export function redondear2(x: number): number {
  const r = Number(x.toFixed(2));
  return r === 0 ? 0 : r;
}
/** f"{x:,}" de Python para enteros. */
export function miles(x: number): string {
  const neg = x < 0;
  const s = String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg ? `-${s}` : s;
}

// ---------- motor ----------
interface MovN {
  id: string;
  fecha: string;
  tarjeta: string;
  moneda: Moneda;
  monto: number;
  descripcion: string;
  categoria: string;
  estado: "real" | "planificado";
  nota?: string;
  f: number;
  c: number | null;
  pg: number;
  dop: number;
}

interface DocCorte {
  tarjeta: string;
  corte: number;
  vence: number;
  pagar: number;
  real_dop: number;
  real_usd: number;
  plan_dop: number;
  est_dop: number;
  fijo: boolean;
  estado: string;
  id: string;
}

export function calcularPlan(E: Estado, hoyIso: string): Plan {
  const HOY = dia(hoyIso);
  const HORIZ = dia(E.horizonte);
  const USD = E.tasas.USD;
  const EUR = E.tasas.EUR;
  const V_INI = dia(E.viaje.inicio);
  const V_FIN = dia(E.viaje.fin);

  const principal = E.cuentas.find((c) => c.principal) ?? E.cuentas[0];
  const otraCuenta = E.cuentas.find((c) => c !== principal);
  const L4 = principal.last4 ?? "";
  const tarjetas = new Map<string, Tarjeta>(E.tarjetas.map((t) => [t.clave, t]));
  const esTarjeta = (k: string) => tarjetas.has(k);

  const aDop = (monto: number, moneda: Moneda) => monto * ({ DOP: 1, USD, EUR } as const)[moneda];

  const corteDe = (k: string, d: number): number => {
    const t = tarjetas.get(k)!;
    let [y, m] = partes(d);
    if (partes(d)[2] > t.corte_dia) [y, m] = masMes(y, m);
    return fecha(y, m, t.corte_dia);
  };
  // El vencimiento (o el pago) es el primer día X después del corte.
  const despuesDelCorte = (c: number, diaX: number, diaCorte: number): number => {
    const [y, m] = partes(c);
    if (diaX > diaCorte) return fecha(y, m, diaX);
    const [y2, m2] = masMes(y, m);
    return fecha(y2, m2, diaX);
  };
  const venceDe = (k: string, c: number) => {
    const t = tarjetas.get(k)!;
    return despuesDelCorte(c, t.vence_dia, t.corte_dia);
  };
  const pagoDe = (k: string, c: number) => {
    const t = tarjetas.get(k)!;
    return despuesDelCorte(c, t.pago_dia, t.corte_dia);
  };
  const nombre = (k: string) =>
    tarjetas.get(k)?.nombre ?? (k === "efectivo" ? "Efectivo" : `Débito ${L4}`);
  const con = (k: string) =>
    tarjetas.get(k)?.corto ?? (k === "efectivo" ? "Efectivo" : `Débito ${L4}`);

  // ---- periodos de presupuesto (de cobro a cobro) ----
  const esNomina = (i: Estado["ingresos"][number]) =>
    i.tipo ? i.tipo === "nomina" && i.monto > 0 : i.monto > 0 && !i.concepto.includes("Navidad");
  const cobros = E.ingresos.filter(esNomina).map((i) => dia(i.fecha)).sort((a, b) => a - b);
  const diaCasa = (E.presupuesto_casa_mes * 12) / 365;
  const INICIO_PLAN = dia(E.inicio_plan);
  type Periodo = ["casa" | "viaje", number, number];
  let periodos: Periodo[] = [];
  let inicio = INICIO_PLAN;
  const limites = [...cobros.filter((c) => c > INICIO_PLAN), HORIZ + 14];
  for (const c of limites) {
    const fin = c - 1;
    if (inicio < V_INI && V_INI <= fin) {
      periodos.push(["casa", inicio, V_INI - 1]);
      inicio = V_INI;
    }
    if (V_INI <= inicio && inicio <= V_FIN) {
      if (fin <= V_FIN) {
        inicio = c;
        continue;
      }
      periodos.push(["viaje", V_INI, V_FIN]);
      inicio = V_FIN + 1;
    }
    if (inicio <= fin) periodos.push(["casa", inicio, fin]);
    inicio = c;
  }
  const vistos = new Set<string>();
  periodos = periodos.filter((p) => {
    const k = p.join("|");
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  const etiqueta = (a: number, b: number) => {
    const [, ma, da] = partes(a);
    const [, mb, db] = partes(b);
    if (ma === mb) return `${da}–${db} ${MESES[ma - 1]}`;
    return `${fd(a)}–${fd(b)}`;
  };

  // ---- movimientos normalizados ----
  const movs: MovN[] = E.movimientos.map((m) => {
    const f = dia(m.fecha);
    const dop = aDop(m.monto, m.moneda);
    if (!esTarjeta(m.tarjeta)) return { ...m, f, c: null, pg: f, dop };
    const c = m.corte ? dia(m.corte) : corteDe(m.tarjeta, f);
    return { ...m, f, c, pg: pagoDe(m.tarjeta, c), dop };
  });

  const gastadoCasa = (a: number, b: number) => {
    let t = 0;
    // Lo planificado del día a día también consume la quincena (si no, se contaría dos veces con el estimado).
    for (const m of movs) if (m.categoria === "día a día" && a <= m.f && m.f <= b) t += m.dop;
    return t;
  };
  const gastadoViajeDop = () => {
    let t = 0;
    for (const m of movs)
      if (m.categoria === "viaje" && m.estado === "real" && V_INI - 30 <= m.f && m.f <= V_FIN) t += m.dop;
    // (Los "otros" del viaje, como cambiar euros, no cuentan como gastado: es efectivo apartado.)
    return t;
  };

  const viajeTotalDop = E.viaje.presupuesto_eur * EUR;
  const efectivoDop = E.viaje.efectivo_eur * EUR;
  const viajeTarjetaDop = viajeTotalDop - efectivoDop;

  // ---- estimado diario de lo que falta del presupuesto ----
  const estim: [number, string, number][] = [];
  const filasPres: FilaPresupuesto[] = [];
  const estadoPeriodo = (a: number, b: number): FilaPresupuesto["estado"] =>
    a <= HOY && HOY <= b ? "actual" : b < HOY ? "pasado" : "próximo";
  for (const [tipo, a, b] of periodos) {
    const dias = b - a + 1;
    if (tipo === "casa") {
      const pres = redondear((diaCasa * dias) / 50) * 50;
      const gast = gastadoCasa(a, b);
      const queda = pres - gast;
      if (b >= HOY) {
        const d0 = Math.max(a, HOY);
        const resto = b - d0 + 1;
        for (let k = 0; k < resto; k++) estim.push([d0 + k, E.tarjeta_dia_a_dia, Math.max(queda, 0) / resto]);
      }
      filasPres.push({
        id: `p-${iso(a)}`,
        periodo: etiqueta(a, b),
        desde: iso(a),
        hasta: iso(b),
        tipo: "En casa",
        presupuesto: pres,
        gastado: redondear(gast),
        queda: redondear(queda),
        estado: estadoPeriodo(a, b),
      });
    } else {
      let gastTarj = 0;
      for (const m of movs) if (m.categoria === "viaje" && m.estado === "real" && V_INI <= m.f && m.f <= V_FIN) gastTarj += m.dop;
      const quedaTarj = viajeTarjetaDop - gastTarj;
      const d0 = Math.max(a, HOY);
      const resto = b - d0 + 1;
      for (let k = 0; k < resto; k++) estim.push([d0 + k, E.viaje.tarjeta, Math.max(quedaTarj, 0) / resto]);
      const gast = gastadoViajeDop();
      filasPres.push({
        id: `p-${iso(a)}`,
        periodo: "Viaje " + etiqueta(a, b),
        desde: iso(a),
        hasta: iso(b),
        tipo: "Viaje",
        presupuesto: redondear(viajeTotalDop),
        gastado: redondear(gast),
        queda: redondear(viajeTotalDop - gast),
        estado: estadoPeriodo(a, b),
      });
    }
  }

  // ---- estados de cuenta ----
  const cortes = new Map<string, DocCorte>();
  const docCorte = (t: string, c: number): DocCorte => {
    const k = `${t}|${c}`;
    let d = cortes.get(k);
    if (!d) {
      const [y, m] = partes(c);
      d = {
        tarjeta: t,
        corte: c,
        vence: venceDe(t, c),
        pagar: pagoDe(t, c),
        real_dop: 0,
        real_usd: 0,
        plan_dop: 0,
        est_dop: 0,
        fijo: false,
        estado: "pendiente",
        id: `${tarjetas.get(t)!.prefijo}-${y}-${String(m).padStart(2, "0")}`,
      };
      cortes.set(k, d);
    }
    return d;
  };
  for (const k of E.cortes_conocidos) {
    if (!esTarjeta(k.tarjeta)) continue;
    const doc = docCorte(k.tarjeta, dia(k.corte));
    doc.fijo = true;
    doc.estado = k.estado;
    doc.real_dop = k.dop + k.usd * USD;
    doc.real_usd = k.usd;
  }
  for (const m of movs) {
    if (m.c === null) continue;
    const doc = docCorte(m.tarjeta, m.c);
    if (doc.fijo) continue;
    if (m.estado === "real") {
      doc.real_dop += m.dop;
      if (m.moneda !== "DOP") doc.real_usd += m.dop / USD;
    } else {
      doc.plan_dop += m.dop;
    }
  }
  for (const [f, t, dop] of estim) {
    if (!esTarjeta(t)) continue;
    const doc = docCorte(t, corteDe(t, f));
    if (doc.fijo) continue;
    doc.est_dop += dop;
  }

  const filasTarj: FilaTarjeta[] = [];
  const ordenados = [...cortes.values()].sort((x, y) =>
    x.vence !== y.vence ? x.vence - y.vence : x.tarjeta < y.tarjeta ? -1 : x.tarjeta > y.tarjeta ? 1 : 0,
  );
  for (const d of ordenados) {
    if (d.vence > HORIZ + 31 || (d.estado === "pagado" && d.vence < HOY - 40)) continue;
    const total = d.real_dop + d.plan_dop + d.est_dop;
    let est: string;
    if (d.fijo) est = "Corte cerrado";
    else if (d.corte <= HOY) est = "Corte cerrado";
    else if (d.corte > HOY && d.corte - 31 <= HOY) est = "En curso";
    else est = "Futuro (estimado)";
    if (d.estado === "pagado") est = "Pagado";
    filasTarj.push({
      id: d.id,
      tarjeta: nombre(d.tarjeta),
      corte: iso(d.corte),
      pagar: iso(d.pagar),
      vence: iso(d.vence),
      cargado: redondear(d.real_dop),
      por_venir: redondear(d.plan_dop + d.est_dop),
      total: redondear(total),
      usd_cargado: redondear2(d.real_usd),
      estado: est,
    });
  }

  // ---- deuda ----
  const P = E.deuda;
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const deudaTotal = P.deuda_original - sum(P.abonos_previos.map((a) => a.monto));
  const pagado = sum(P.plan.filter((p) => p.estado === "hecho").map((p) => p.monto));
  const filasDeuda: FilaDeuda[] = [];
  let rest = P.deuda_original;
  for (const a of [...P.abonos_previos, ...P.plan]) {
    rest -= a.monto;
    filasDeuda.push({
      id: a.id,
      fecha: a.fecha,
      concepto: a.concepto,
      monto: a.monto,
      queda_despues: redondear(rest),
      estado: a.estado === "hecho" ? "Hecho" : "Pendiente",
    });
  }
  const deudaRestante = deudaTotal - pagado;
  const finDeuda = P.plan.length ? Math.max(...P.plan.map((p) => dia(p.fecha))) : HOY;
  const planHastaHoriz = P.plan.filter((p) => dia(p.fecha) <= HORIZ);
  const ultimaAntesHoriz = planHastaHoriz.length ? Math.max(...planHastaHoriz.map((p) => dia(p.fecha))) : HORIZ;

  // ---- calendario de la cuenta ----
  interface Ev {
    id: string;
    fecha: number;
    tipo: string;
    concepto: string;
    monto: number;
    medio: string;
  }
  const ev: Ev[] = [];
  for (const i of E.ingresos)
    if (dia(i.fecha) >= HOY && i.estado !== "hecho")
      ev.push({ id: i.id, fecha: dia(i.fecha), tipo: "Cobro", concepto: i.concepto, monto: i.monto, medio: `Entra a la ${L4}` });
  for (const p of P.plan)
    if (p.estado !== "hecho")
      ev.push({
        id: p.id,
        fecha: dia(p.fecha),
        tipo: P.acreedor,
        concepto: `${P.acreedor}: ${p.concepto.toLowerCase()}`,
        monto: -p.monto,
        medio: `Sale de la ${L4}`,
      });
  for (const d of cortes.values()) {
    if (d.estado === "pagado" || d.pagar < HOY) continue;
    if (d.pagar > HORIZ) continue;
    const tot = d.real_dop + d.plan_dop + d.est_dop;
    const tag = d.fijo || d.corte <= HOY ? "" : " (estimado)";
    ev.push({
      id: "pago-" + d.id,
      fecha: d.pagar,
      tipo: "Tarjeta",
      concepto: `Pagar ${nombre(d.tarjeta)} · corte ${fd(d.corte)}${tag}`,
      monto: -redondear(tot),
      medio: `${L4} → ${con(d.tarjeta)}`,
    });
  }
  const montoOtro = (o: Estado["otros"][number]) => (o.monto !== undefined ? o.monto : (o.monto_eur ?? 0) * EUR);
  for (const o of E.otros) {
    if (o.estado === "hecho") continue;
    ev.push({
      id: o.id,
      fecha: dia(o.fecha),
      tipo: "Otro",
      concepto: o.concepto,
      monto: -redondear(montoOtro(o)),
      medio: o.medio ?? `Sale de la ${L4}`,
    });
  }
  const orden = (t: string) => (t === "Cobro" ? 0 : t === P.acreedor ? 1 : t === "Tarjeta" ? 2 : 3);
  ev.sort((a, b) => a.fecha - b.fecha || orden(a.tipo) - orden(b.tipo));

  const PREST = E.prestado ?? [];
  const prestEnCuenta = sum(PREST.filter((p) => p.estado === "en la cuenta").map((p) => p.monto));
  const prestTotal = sum(PREST.filter((p) => p.estado !== "devuelto").map((p) => p.monto));
  const propio = principal.saldo - prestEnCuenta;
  let saldo = propio;
  const filasCal: FilaCalendario[] = [
    {
      id: "hoy",
      fecha: iso(HOY),
      tipo: "Hoy",
      concepto: "Tu dinero hoy (sin lo prestado)",
      medio: `Cuenta ${L4}`,
      monto: 0,
      saldo: redondear(saldo),
    },
  ];
  let minimo: [number, number] = [saldo, HOY];
  let saldoSalida: number | null = null;
  for (const e of ev) {
    if (e.fecha > HORIZ) continue;
    saldo += e.monto;
    filasCal.push({
      id: e.id,
      fecha: iso(e.fecha),
      tipo: e.tipo,
      concepto: e.concepto,
      medio: e.medio,
      monto: redondear(e.monto),
      saldo: redondear(saldo),
    });
    if (saldo < minimo[0]) minimo = [saldo, e.fecha];
    if (e.fecha <= V_INI) saldoSalida = saldo;
  }

  // ---- resumen ----
  const actual = filasPres.find((p) => p.estado === "actual") ?? filasPres[0];
  const prox = filasCal.slice(1).find((e) => e.tipo === "Tarjeta");
  const gvEur = gastadoViajeDop() / EUR;
  const diasViaje = V_FIN - V_INI + 1;
  const acreedor = P.acreedor.toLowerCase();
  const tarjViaje = con(E.viaje.tarjeta);
  const res: FilaResumen[] = [
    { clave: "saldo_hoy", valor: redondear(propio), texto: `Tu dinero en la ${L4}, sin lo prestado` },
    { clave: "saldo_banco", valor: principal.saldo, texto: "Lo que dice el banco hoy" },
    { clave: "prestado_total", valor: prestTotal, texto: "Prestado para la carta del banco, no se toca" },
    {
      clave: "deuda_tras_ene",
      valor: redondear(deudaTotal - sum(planHastaHoriz.map((p) => p.monto))),
      texto: `Lo que le faltaría a ${acreedor} después del ${fd(ultimaAntesHoriz)}`,
    },
    { clave: "saldo_1948", valor: otraCuenta?.saldo ?? 0, texto: otraCuenta?.cuenta ?? "" },
    { clave: "periodo_queda", valor: actual?.queda ?? 0, texto: actual?.periodo ?? "" },
    { clave: "periodo_presupuesto", valor: actual?.presupuesto ?? 0, texto: actual?.periodo ?? "" },
    { clave: "periodo_gastado", valor: actual?.gastado ?? 0, texto: actual?.periodo ?? "" },
    { clave: "periodo_hasta", valor: null, texto: actual ? fd(dia(actual.hasta)) : "" },
    { clave: "proximo_pago", valor: prox ? -prox.monto : 0, texto: prox ? prox.concepto : "" },
    { clave: "proximo_pago_fecha", valor: null, texto: prox ? fd(dia(prox.fecha)) : "" },
    {
      clave: "deuda_total",
      valor: redondear(deudaTotal),
      texto: `RD$ ${miles(P.deuda_original)} menos lo que ya le diste`,
    },
    { clave: "deuda_pagada", valor: redondear(pagado), texto: "Pagado desde el plan" },
    { clave: "deuda_restante", valor: redondear(deudaRestante), texto: "Le falta por pagar" },
    { clave: "deuda_fin", valor: null, texto: fd(finDeuda) },
    {
      clave: "saldo_salida",
      valor: redondear(saldoSalida ?? propio),
      texto: `Saldo al salir de viaje (${fd(V_INI)})`,
    },
    { clave: "viaje_inicio", valor: null, texto: iso(V_INI) },
    { clave: "viaje_fin", valor: null, texto: iso(V_FIN) },
    { clave: "saldo_minimo", valor: redondear(minimo[0]), texto: fd(minimo[1]) },
    { clave: "saldo_final", valor: redondear(saldo), texto: fd(HORIZ) },
    { clave: "colchon", valor: E.colchon, texto: "Mínimo que no queremos tocar" },
    { clave: "viaje_presupuesto_eur", valor: E.viaje.presupuesto_eur, texto: "Total para gastar en Europa" },
    { clave: "viaje_efectivo_eur", valor: E.viaje.efectivo_eur, texto: "En efectivo" },
    {
      clave: "viaje_tarjeta_eur",
      valor: E.viaje.presupuesto_eur - E.viaje.efectivo_eur,
      texto: `Con la ${tarjViaje}`,
    },
    { clave: "viaje_gastado_eur", valor: redondear2(gvEur), texto: "Gastado del viaje" },
    { clave: "viaje_queda_eur", valor: redondear2(E.viaje.presupuesto_eur - gvEur), texto: "Queda del viaje" },
    { clave: "viaje_dias", valor: diasViaje, texto: `${fd(V_INI)} – ${fd(V_FIN)}` },
    {
      clave: "viaje_por_dia_eur",
      valor: redondear2(E.viaje.presupuesto_eur / diasViaje),
      texto: "Promedio por día",
    },
    { clave: "casa_mes", valor: E.presupuesto_casa_mes, texto: "Presupuesto en casa por mes" },
    { clave: "actualizado", valor: null, texto: E.actualizado ?? "" },
  ];

  // ---- movimientos ----
  const filasMov: FilaMovimiento[] = [];
  for (const m of movs)
    filasMov.push({
      id: m.id,
      fecha: m.fecha,
      tarjeta: con(m.tarjeta),
      moneda: m.moneda,
      monto: m.monto,
      monto_dop: redondear(m.dop),
      descripcion: m.descripcion,
      categoria: m.categoria,
      estado: m.estado === "real" ? "Cargado" : "Planificado",
      paga_el: iso(m.pg),
      nota: m.nota ?? "",
    });
  for (const o of E.otros)
    filasMov.push({
      id: o.id,
      fecha: o.fecha,
      tarjeta: o.medio ?? `Sale de la ${L4}`,
      moneda: o.monto_eur !== undefined ? "EUR" : "DOP",
      monto: o.monto_eur ?? o.monto ?? 0,
      monto_dop: redondear(montoOtro(o)),
      descripcion: o.concepto,
      categoria: o.categoria ?? "otro",
      estado: o.estado === "hecho" ? "Hecho" : "Planificado",
      paga_el: o.fecha,
      nota: "",
    });
  filasMov.sort((a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

  // ---- supuestos: los del documento + los que salen de los números ----
  const notaUsd = E.tasas_nota?.USD ? ` (${E.tasas_nota.USD})` : "";
  const notaEur = E.tasas_nota?.EUR ? ` (${E.tasas_nota.EUR})` : "";
  const pagos = E.tarjetas
    .map((t, i) => `${t.corto} el ${t.pago_dia}${i === 0 ? " de cada mes" : ""} (vence el ${t.vence_dia})`)
    .join("; ");
  const calculados: Supuesto[] = [
    { id: "s-usd", supuesto: "Tasa del dólar", valor: `RD$ ${USD.toFixed(2)}${notaUsd}` },
    { id: "s-eur", supuesto: "Tasa del euro", valor: `RD$ ${EUR.toFixed(2)}${notaEur}` },
    {
      id: "s-prestado",
      supuesto: "Dinero prestado",
      valor: `Los RD$ ${miles(prestEnCuenta)} prestados están dentro de los RD$ ${miles(principal.saldo)} del banco. No cuentan como tuyos`,
    },
    {
      id: "s-casa",
      supuesto: "Gasto en casa",
      valor: `RD$ ${miles(E.presupuesto_casa_mes)} al mes (≈ RD$ ${miles(redondear(diaCasa))} al día), se estima en la ${con(E.tarjeta_dia_a_dia)}`,
    },
    {
      id: "s-viaje",
      supuesto: "Viaje",
      valor: `€ ${miles(E.viaje.presupuesto_eur)} en total (${E.viaje.efectivo_eur} en efectivo, resto con la ${tarjViaje})${E.viaje.incluye ? `, incluye ${E.viaje.incluye}` : ""}`,
    },
    { id: "s-pagos", supuesto: "Cuándo pagas las tarjetas", valor: `${pagos}. Siempre el total` },
    {
      id: "s-estimado",
      supuesto: "Cómo se estiman las tarjetas",
      valor: "Lo ya cargado + regalos planificados + lo que falta del presupuesto de cada quincena",
    },
  ];
  const propios = E.supuestos ?? [];
  const supuestos = [...propios, ...calculados.filter((c) => !propios.some((p) => p.id === c.id))];

  const filasPrest: FilaPrestado[] = PREST.map((p) => ({
    id: p.id,
    de: p.de,
    monto: p.monto,
    estado: p.estado.charAt(0).toUpperCase() + p.estado.slice(1).toLowerCase(),
    para: p.para,
    devolver: p.devolver,
  }));

  return {
    hoy: iso(HOY),
    resumen: res,
    calendario: filasCal,
    tarjetas: filasTarj,
    papi: filasDeuda,
    presupuesto: filasPres,
    movimientos: filasMov,
    supuestos,
    prestado: filasPrest,
  };
}

/** Valor de una cifra del resumen. */
export function cifra(plan: Plan, clave: string): FilaResumen | undefined {
  return plan.resumen.find((r) => r.clave === clave);
}
