// Herramientas del asistente. Trabajan sobre una copia del plan en memoria;
// la ruta del chat guarda la copia como versión nueva solo si algo cambió.
import type { FunctionDeclaration, GeminiSchema } from "@/lib/assistant/gemini";
import { calcularPlan, cifra, dia, iso, redondear, redondear2 } from "./motor";
import { enMoneda, fechaCorta, rd } from "./formato";
import type { Estado, Moneda, Movimiento, Plan } from "./tipos";

export interface FuentesExternas {
  /** Busca en la memoria, el archivo de conversaciones y el chat. */
  buscar: (consulta: string) => Promise<unknown>;
  /** Lee turnos de la conversación original con Claude (por número). */
  leerConversacion: (desde: number, hasta: number) => Promise<unknown>;
  leerNotas: (tema?: string) => Promise<unknown>;
  guardarNota: (nota: { id?: string; tema: string; texto: string; archivar?: boolean }) => Promise<unknown>;
}

const MONEDAS: Moneda[] = ["DOP", "USD", "EUR"];
const CATEGORIAS = ["día a día", "regalo", "viaje", "otro", "antes del plan"];

class ErrorHerramienta extends Error {}
const fallo = (m: string): never => {
  throw new ErrorHerramienta(m);
};

function fechaValida(v: unknown, campo = "fecha"): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fallo(`${campo} debe ser AAAA-MM-DD`);
  const n = dia(v);
  if (!Number.isFinite(n) || iso(n) !== v) return fallo(`${campo} no es una fecha real`);
  return v;
}
function montoValido(v: unknown, campo = "monto", permitirCero = false): number {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  if (!Number.isFinite(n) || n < 0 || (!permitirCero && n === 0) || n > 50_000_000) return fallo(`${campo} no es válido`);
  return redondear2(n);
}
function texto(v: unknown, campo: string, max = 300): string {
  if (typeof v !== "string" || !v.trim()) return fallo(`falta ${campo}`);
  return v.trim().slice(0, max);
}
const opcional = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const nuevoId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const S = (type: GeminiSchema["type"], description?: string, extra: Partial<GeminiSchema> = {}): GeminiSchema => ({ type, ...(description ? { description } : {}), ...extra });
const obj = (properties: Record<string, GeminiSchema>, required: string[] = []): GeminiSchema => ({ type: "OBJECT", properties, ...(required.length ? { required } : {}) });

export function crearHerramientas(inicial: Estado, hoy: string, fuentes: FuentesExternas) {
  const estado: Estado = structuredClone(inicial);
  const cambios: string[] = [];
  let notasCambiadas = 0;
  const claves = () => estado.tarjetas.map((t) => t.clave);
  const principal = () => estado.cuentas.find((c) => c.principal) ?? estado.cuentas[0];
  const corto = (k: string) => estado.tarjetas.find((t) => t.clave === k)?.corto ?? (k === "efectivo" ? "efectivo" : `débito ${principal().last4 ?? ""}`.trim());
  const aDop = (monto: number, moneda: Moneda) => monto * ({ DOP: 1, USD: estado.tasas.USD, EUR: estado.tasas.EUR } as const)[moneda];

  function medioValido(v: unknown): string {
    const k = typeof v === "string" ? v.trim().toLowerCase() : "";
    if (claves().includes(k) || k === "cuenta" || k === "efectivo") return k;
    return fallo(`tarjeta debe ser una de: ${[...claves(), "cuenta", "efectivo"].join(", ")}`);
  }
  function monedaValida(v: unknown): Moneda {
    const m = (typeof v === "string" ? v.trim().toUpperCase() : "DOP") as Moneda;
    return MONEDAS.includes(m) ? m : fallo("moneda debe ser DOP, USD o EUR");
  }
  function categoriaValida(v: unknown): string {
    const c = typeof v === "string" ? v.trim().toLowerCase() : "día a día";
    const norm = c === "dia a dia" ? "día a día" : c;
    return CATEGORIAS.includes(norm) ? norm : fallo(`categoria debe ser una de: ${CATEGORIAS.join(", ")}`);
  }
  /** Mueve el saldo de la cuenta principal (cobros, pagos y débitos que ya pasaron). */
  function moverSaldo(delta: number, porQue: string) {
    const c = principal();
    c.saldo = redondear2(c.saldo + delta);
    cambios.push(`Saldo de la ${c.last4 ?? c.cuenta}: ${delta >= 0 ? "+" : "−"}${rd(Math.abs(delta))} (${porQue}) → ${rd(c.saldo)}`);
  }
  function upsert<T extends { id: string }>(lista: T[], id: string | undefined, crear: () => T, editar: (x: T) => void): T {
    if (id) {
      const x = lista.find((e) => e.id === id);
      if (!x) return fallo(`no existe ${id}`);
      editar(x);
      return x;
    }
    const x = crear();
    lista.push(x);
    return x;
  }

  // ---------- resumen compacto del plan (lo que el modelo necesita ver) ----------
  function resumen(plan: Plan = calcularPlan(estado, hoy)) {
    const v = (k: string) => cifra(plan, k)?.valor ?? null;
    const t = (k: string) => cifra(plan, k)?.texto ?? "";
    const actual = plan.presupuesto.find((p) => p.estado === "actual");
    return {
      hoy,
      tu_dinero: v("saldo_hoy"),
      banco_dice: v("saldo_banco"),
      prestado_no_se_toca: v("prestado_total"),
      quincena_actual: actual ? { periodo: actual.periodo, puedes: actual.presupuesto, gastado: actual.gastado, queda: actual.queda, hasta: actual.hasta } : null,
      proximo_pago_tarjeta: { monto: v("proximo_pago"), que: t("proximo_pago"), fecha: t("proximo_pago_fecha") },
      punto_mas_bajo: { saldo: v("saldo_minimo"), fecha: t("saldo_minimo") },
      colchon: estado.colchon,
      al_salir_de_viaje: { saldo: v("saldo_salida"), fecha: estado.viaje.inicio },
      al_final_del_plan: { saldo: v("saldo_final"), fecha: estado.horizonte },
      deuda: { con: estado.deuda.acreedor, le_debe: v("deuda_restante"), pagado_en_el_plan: v("deuda_pagada"), termina: t("deuda_fin") },
      viaje: { gastado_eur: v("viaje_gastado_eur"), queda_eur: v("viaje_queda_eur"), presupuesto_eur: estado.viaje.presupuesto_eur },
      proximos: plan.calendario.slice(1, 11).map((e) => `${e.fecha} ${e.concepto} | ${e.medio} | ${e.monto} → queda ${e.saldo}`),
      tarjetas: plan.tarjetas
        .filter((r) => r.estado !== "Pagado")
        .slice(0, 6)
        .map((r) => `${r.id} ${r.tarjeta}: corte ${r.corte}, pagar ${r.pagar}, total ${r.total} (cargado ${r.cargado}, por venir ${r.por_venir}) ${r.estado}`),
    };
  }

  // ---------- declaraciones ----------
  const movProps: Record<string, GeminiSchema> = {
    fecha: S("STRING", "AAAA-MM-DD. Si dice 'hoy', usa la fecha de hoy."),
    tarjeta: S("STRING", `Con qué pagó: ${[...claves(), "cuenta (débito)", "efectivo"].join(", ")}`),
    moneda: S("STRING", "DOP, USD o EUR", { enum: MONEDAS }),
    monto: S("NUMBER", "Monto en esa moneda, positivo"),
    descripcion: S("STRING", "Qué fue, corto (comercio y detalle)"),
    categoria: S("STRING", "día a día (cuenta en la quincena), regalo, viaje u otro", { enum: CATEGORIAS }),
  };
  const declaraciones: FunctionDeclaration[] = [
    { name: "ver_plan", description: "Cifras actuales del plan: tu dinero, quincena, próximos pagos, punto más bajo, tarjetas. Úsala antes de dar cualquier número." },
    {
      name: "ver_movimientos",
      description: "Lista movimientos (con su id) para revisarlos o editarlos.",
      parameters: obj({ desde: S("STRING", "AAAA-MM-DD"), hasta: S("STRING", "AAAA-MM-DD"), tarjeta: S("STRING"), texto: S("STRING", "Palabra a buscar en la descripción") }),
    },
    {
      name: "simular",
      description:
        "Simula una compra SIN guardarla y compara cómo queda el plan (punto más bajo, saldo al salir de viaje, final, quincena y el pago de tarjeta que sube). Sin tarjeta compara todas las opciones. Úsala antes de recomendar si comprar algo o con qué pagar.",
      parameters: obj({ fecha: movProps.fecha, monto: movProps.monto, moneda: movProps.moneda, categoria: movProps.categoria, tarjeta: S("STRING", "Opcional: una sola opción") }, ["fecha", "monto"]),
    },
    {
      name: "registrar_movimiento",
      description:
        "Guarda un gasto o compra. estado 'real' si ya pasó; 'planificado' si es a futuro. Con 'cuenta' (débito) ya hecho se descuenta del saldo de la cuenta, salvo descontar_de_cuenta=false (cuando el saldo que dio Randy ya lo incluye).",
      parameters: obj(
        { ...movProps, estado: S("STRING", "real o planificado", { enum: ["real", "planificado"] }), nota: S("STRING"), descontar_de_cuenta: S("BOOLEAN") },
        ["fecha", "tarjeta", "monto", "descripcion"],
      ),
    },
    {
      name: "editar_movimiento",
      description: "Cambia campos de un movimiento existente (usa su id de ver_movimientos).",
      parameters: obj({ id: S("STRING"), ...movProps, estado: S("STRING", "real o planificado", { enum: ["real", "planificado"] }), nota: S("STRING") }, ["id"]),
    },
    {
      name: "borrar",
      description: "Quita un elemento del plan. Solo si Randy lo pidió claro. Queda en el historial.",
      parameters: obj({ lista: S("STRING", "", { enum: ["movimientos", "ingresos", "otros", "prestado", "deuda", "cortes"] }), id: S("STRING") }, ["lista", "id"]),
    },
    {
      name: "actualizar_saldo",
      description: "Pone el saldo que dice el banco de una cuenta (incluye lo prestado que esté dentro).",
      parameters: obj({ cuenta_id: S("STRING", estado.cuentas.map((c) => `${c.id} = ${c.cuenta}`).join("; ")), saldo: S("NUMBER") }, ["cuenta_id", "saldo"]),
    },
    {
      name: "registrar_corte",
      description: "Guarda el monto con que cortó una tarjeta (lo que dice el estado de cuenta).",
      parameters: obj({ tarjeta: S("STRING", claves().join(", ")), corte: S("STRING", "Fecha del corte AAAA-MM-DD"), dop: S("NUMBER", "Parte en pesos"), usd: S("NUMBER", "Parte en dólares (0 si no hay)") }, ["tarjeta", "corte", "dop"]),
    },
    {
      name: "pagar_tarjeta",
      description: "Marca pagado el corte de una tarjeta y descuenta el pago de la cuenta (o pon ajustar_saldo=false si Randy dará el saldo nuevo).",
      parameters: obj({ tarjeta: S("STRING", claves().join(", ")), corte: S("STRING", "Fecha del corte que pagó, AAAA-MM-DD"), monto: S("NUMBER", "Lo que pagó en RD$; si no lo dice, el total del corte"), ajustar_saldo: S("BOOLEAN") }, ["tarjeta", "corte"]),
    },
    {
      name: "guardar_ingreso",
      description: "Crea o cambia un cobro (nómina, Navidad, bono). Marcarlo 'hecho' suma el monto a la cuenta salvo ajustar_saldo=false.",
      parameters: obj(
        { id: S("STRING", "Para editar uno existente"), fecha: S("STRING"), concepto: S("STRING"), monto: S("NUMBER"), estado: S("STRING", "", { enum: ["pendiente", "hecho"] }), tipo: S("STRING", "nomina marca el inicio de quincena", { enum: ["nomina", "extra"] }), ajustar_saldo: S("BOOLEAN") },
        [],
      ),
    },
    {
      name: "guardar_pago_deuda",
      description: `Crea o cambia una cuota de la deuda con ${estado.deuda.acreedor}. Marcarla 'hecho' la descuenta de la cuenta salvo ajustar_saldo=false.`,
      parameters: obj({ id: S("STRING"), fecha: S("STRING"), concepto: S("STRING"), monto: S("NUMBER"), estado: S("STRING", "", { enum: ["pendiente", "hecho"] }), ajustar_saldo: S("BOOLEAN") }, []),
    },
    {
      name: "guardar_prestado",
      description: "Dinero prestado que está en la cuenta y no es de Randy. 'devuelto' lo saca de la cuenta; 'en la cuenta' desde 'por entrar' lo suma.",
      parameters: obj({ id: S("STRING"), de: S("STRING"), monto: S("NUMBER"), estado: S("STRING", "", { enum: ["en la cuenta", "por entrar", "devuelto"] }), para: S("STRING"), devolver: S("STRING"), ajustar_saldo: S("BOOLEAN") }, []),
    },
    {
      name: "guardar_salida",
      description: "Salida de la cuenta que no es tarjeta ni deuda (cambiar euros, retirar un paquete, débito a futuro). 'hecho' la descuenta de la cuenta salvo ajustar_saldo=false.",
      parameters: obj({ id: S("STRING"), fecha: S("STRING"), concepto: S("STRING"), monto: S("NUMBER", "En RD$"), monto_eur: S("NUMBER", "Si es en euros"), estado: S("STRING", "", { enum: ["planificado", "hecho"] }), categoria: S("STRING"), medio: S("STRING", "Texto para la columna Con, ej. '1848 → efectivo (€)'"), ajustar_saldo: S("BOOLEAN") }, []),
    },
    {
      name: "ajustar_plan",
      description: "Cambia ajustes: presupuesto de casa al mes, colchón, horizonte, tasas, viaje, tarjeta del día a día, o un supuesto del plan.",
      parameters: obj({
        presupuesto_casa_mes: S("NUMBER"),
        colchon: S("NUMBER"),
        horizonte: S("STRING", "Hasta qué fecha se proyecta"),
        tasa_usd: S("NUMBER"),
        tasa_eur: S("NUMBER"),
        tarjeta_dia_a_dia: S("STRING"),
        viaje_inicio: S("STRING"),
        viaje_fin: S("STRING"),
        viaje_presupuesto_eur: S("NUMBER"),
        viaje_efectivo_eur: S("NUMBER"),
        supuesto_id: S("STRING", "Para cambiar o crear un supuesto"),
        supuesto_titulo: S("STRING"),
        supuesto_valor: S("STRING"),
      }),
    },
    {
      name: "guardar_tarjeta",
      description: "Crea una tarjeta o cambia sus días de corte, vencimiento y pago, o su límite.",
      parameters: obj({ clave: S("STRING", "ej. ikea"), nombre: S("STRING"), corto: S("STRING"), corte_dia: S("INTEGER"), vence_dia: S("INTEGER"), pago_dia: S("INTEGER"), limite_dop: S("NUMBER") }, ["clave"]),
    },
    {
      name: "guardar_nota",
      description: "Guarda en la memoria algo que hay que recordar siempre (decisiones, planes, personas, preferencias, regalos). Con id edita una nota; archivar=true la archiva.",
      parameters: obj({ id: S("STRING"), tema: S("STRING", "Tema corto, ej. 'Regalos de Navidad'"), texto: S("STRING", "La nota completa, con fechas y montos"), archivar: S("BOOLEAN") }, ["tema", "texto"]),
    },
    { name: "leer_notas", description: "Lee las notas de memoria completas (todas o de un tema).", parameters: obj({ tema: S("STRING") }) },
    {
      name: "buscar_historial",
      description: "Busca en la memoria, en toda la conversación con Claude (13–14 oct 2026) y en este chat. Úsala antes de decir que no sabes algo.",
      parameters: obj({ consulta: S("STRING", "Palabras clave") }, ["consulta"]),
    },
    {
      name: "leer_conversacion",
      description: "Lee mensajes de la conversación original con Claude por número (0 a 68), para ver el contexto completo de algo que encontraste.",
      parameters: obj({ desde: S("INTEGER"), hasta: S("INTEGER") }, ["desde", "hasta"]),
    },
  ];

  // ---------- ejecución ----------
  async function ejecutar(nombre: string, a: Record<string, unknown>): Promise<unknown> {
    try {
      switch (nombre) {
        case "ver_plan":
          return resumen();

        case "ver_movimientos": {
          const desde = opcional(a.desde);
          const hasta = opcional(a.hasta);
          const tarjeta = opcional(a.tarjeta)?.toLowerCase();
          const q = opcional(a.texto)?.toLowerCase();
          const filas = calcularPlan(estado, hoy).movimientos.filter(
            (m) =>
              (!desde || m.fecha >= desde) &&
              (!hasta || m.fecha <= hasta) &&
              (!tarjeta || m.tarjeta.toLowerCase().includes(tarjeta)) &&
              (!q || m.descripcion.toLowerCase().includes(q)),
          );
          return { total: filas.length, movimientos: filas.slice(0, 40).map((m) => `${m.id} | ${m.fecha} | ${m.descripcion} | ${m.tarjeta} | ${enMoneda(m.monto, m.moneda)} = RD$ ${m.monto_dop} | ${m.categoria} | ${m.estado} | paga ${m.paga_el}`) };
        }

        case "simular": {
          const fecha = fechaValida(a.fecha);
          const monto = montoValido(a.monto);
          const moneda = monedaValida(a.moneda);
          const categoria = categoriaValida(a.categoria);
          const opciones = a.tarjeta ? [medioValido(a.tarjeta)] : [...claves(), "cuenta"];
          const base = calcularPlan(estado, hoy);
          const val = (p: Plan, k: string) => cifra(p, k)?.valor ?? 0;
          const resultados = opciones.map((t) => {
            const e2 = structuredClone(estado);
            const dop = aDop(monto, moneda);
            if (t === "cuenta" || t === "efectivo") {
              // Sale de la cuenta ese día (o del efectivo, que no toca la cuenta).
              if (categoria === "día a día" || fecha <= hoy) e2.movimientos.push({ id: "sim", fecha, tarjeta: t, moneda, monto, descripcion: "(simulación)", categoria, estado: "real" });
              if (t === "cuenta") {
                if (fecha <= hoy) e2.cuentas.find((c) => c.principal)!.saldo -= dop;
                else e2.otros.push({ id: "sim-o", fecha, concepto: "(simulación)", monto: redondear2(dop), estado: "planificado", categoria });
              }
            } else {
              e2.movimientos.push({ id: "sim", fecha, tarjeta: t, moneda, monto, descripcion: "(simulación)", categoria, estado: fecha <= hoy ? "real" : "planificado" });
            }
            const p2 = calcularPlan(e2, hoy);
            const mov = p2.movimientos.find((m) => m.id === "sim");
            const pago = mov && t !== "cuenta" && t !== "efectivo" ? p2.tarjetas.find((r) => r.pagar === mov.paga_el && r.tarjeta === estado.tarjetas.find((x) => x.clave === t)?.nombre) : undefined;
            const pagoAntes = pago ? base.tarjetas.find((r) => r.id === pago.id) : undefined;
            const qa = base.presupuesto.find((p) => p.desde <= fecha && fecha <= p.hasta);
            const qd = p2.presupuesto.find((p) => p.desde <= fecha && fecha <= p.hasta);
            return {
              con: t,
              en_rd: redondear(dop),
              se_paga_el: t === "cuenta" ? fecha : (mov?.paga_el ?? null),
              pago_que_cambia: pago ? { fecha: pago.pagar, antes: pagoAntes?.total ?? 0, despues: pago.total } : null,
              punto_mas_bajo: { antes: val(base, "saldo_minimo"), despues: val(p2, "saldo_minimo"), fecha: cifra(p2, "saldo_minimo")?.texto },
              al_salir_de_viaje: { antes: val(base, "saldo_salida"), despues: val(p2, "saldo_salida") },
              al_final: { antes: val(base, "saldo_final"), despues: val(p2, "saldo_final") },
              quincena: qa && qd ? { periodo: qd.periodo, queda_antes: qa.queda, queda_despues: qd.queda } : null,
              baja_del_colchon: val(p2, "saldo_minimo") < estado.colchon,
            };
          });
          return { colchon: estado.colchon, opciones: resultados, nota: "En 'día a día' el presupuesto ya contaba con gastar; si te pasas de la quincena, ahí sí baja el plan." };
        }

        case "registrar_movimiento": {
          const fecha = fechaValida(a.fecha);
          const tarjeta = medioValido(a.tarjeta);
          const moneda = monedaValida(a.moneda);
          const monto = montoValido(a.monto);
          const descripcion = texto(a.descripcion, "descripcion");
          const categoria = categoriaValida(a.categoria);
          const est = a.estado === "planificado" || (a.estado !== "real" && fecha > hoy) ? "planificado" : "real";
          const nota = opcional(a.nota);
          if (tarjeta === "cuenta" && est === "planificado") {
            // Un débito a futuro es una salida de la cuenta en su fecha.
            const id = nuevoId("otro");
            estado.otros.push({ id, fecha, concepto: descripcion, monto: redondear2(aDop(monto, moneda)), estado: "planificado", categoria, medio: `Sale de la ${principal().last4}` });
            cambios.push(`+ Salida planificada ${fechaCorta(fecha)}: ${descripcion}, ${enMoneda(monto, moneda)}`);
            return { ok: true, id, como: "salida planificada de la cuenta" };
          }
          const id = nuevoId("m");
          const m: Movimiento = { id, fecha, tarjeta, moneda, monto, descripcion, categoria, estado: est, ...(nota ? { nota } : {}) };
          estado.movimientos.push(m);
          cambios.push(`+ ${descripcion}: ${enMoneda(monto, moneda)} con ${corto(tarjeta)} (${fechaCorta(fecha)}${est === "planificado" ? ", planificado" : ""})`);
          if (tarjeta === "cuenta" && a.descontar_de_cuenta !== false) moverSaldo(-aDop(monto, moneda), descripcion);
          const plan = calcularPlan(estado, hoy);
          const fila = plan.movimientos.find((x) => x.id === id);
          return { ok: true, id, se_paga_el: fila?.paga_el, en_rd: fila?.monto_dop, ahora: resumen(plan) };
        }

        case "editar_movimiento": {
          const id = texto(a.id, "id");
          const m = estado.movimientos.find((x) => x.id === id) ?? fallo(`no existe ${id}`);
          const antes = `${m.descripcion} ${enMoneda(m.monto, m.moneda)} ${corto(m.tarjeta)} ${m.fecha}`;
          if (a.fecha !== undefined) m.fecha = fechaValida(a.fecha);
          if (a.tarjeta !== undefined) m.tarjeta = medioValido(a.tarjeta);
          if (a.moneda !== undefined) m.moneda = monedaValida(a.moneda);
          if (a.monto !== undefined) m.monto = montoValido(a.monto);
          if (a.descripcion !== undefined) m.descripcion = texto(a.descripcion, "descripcion");
          if (a.categoria !== undefined) m.categoria = categoriaValida(a.categoria);
          if (a.estado === "real" || a.estado === "planificado") m.estado = a.estado;
          if (a.nota !== undefined) m.nota = opcional(a.nota);
          cambios.push(`Editado: ${antes} → ${m.descripcion} ${enMoneda(m.monto, m.moneda)} ${corto(m.tarjeta)} ${m.fecha}${m.estado === "planificado" ? " (planificado)" : ""}`);
          return { ok: true, ahora: resumen() };
        }

        case "borrar": {
          const lista = String(a.lista);
          const id = texto(a.id, "id");
          const quitar = <T extends { id: string }>(arr: T[], etiqueta: (x: T) => string) => {
            const i = arr.findIndex((x) => x.id === id);
            if (i < 0) fallo(`no existe ${id} en ${lista}`);
            const [x] = arr.splice(i, 1);
            cambios.push(`Quitado de ${lista}: ${etiqueta(x)}`);
          };
          if (lista === "movimientos") quitar(estado.movimientos, (m) => `${m.descripcion} ${enMoneda(m.monto, m.moneda)}`);
          else if (lista === "ingresos") quitar(estado.ingresos, (i) => `${i.concepto} ${rd(i.monto)}`);
          else if (lista === "otros") quitar(estado.otros, (o) => o.concepto);
          else if (lista === "prestado") quitar(estado.prestado, (p) => `${p.de} ${rd(p.monto)}`);
          else if (lista === "deuda") quitar(estado.deuda.plan, (p) => `${p.concepto} ${p.fecha}`);
          else if (lista === "cortes") quitar(estado.cortes_conocidos, (c) => `${c.id}`);
          else fallo("lista no válida");
          return { ok: true, ahora: resumen() };
        }

        case "actualizar_saldo": {
          const id = texto(a.cuenta_id, "cuenta_id");
          const c = estado.cuentas.find((x) => x.id === id) ?? fallo(`no existe la cuenta ${id}`);
          const saldo = montoValido(a.saldo, "saldo", true);
          const antes = c.saldo;
          c.saldo = saldo;
          cambios.push(`Saldo de ${c.cuenta}: ${rd(antes)} → ${rd(saldo)}`);
          return { ok: true, ahora: resumen() };
        }

        case "registrar_corte": {
          const t = medioValido(a.tarjeta);
          if (!claves().includes(t)) fallo("eso no es una tarjeta");
          const corte = fechaValida(a.corte, "corte");
          const dop = montoValido(a.dop, "dop", true);
          const usd = a.usd === undefined ? 0 : montoValido(a.usd, "usd", true);
          const tj = estado.tarjetas.find((x) => x.clave === t)!;
          const id = `${tj.prefijo}-${corte.slice(0, 7)}`;
          const ex = estado.cortes_conocidos.find((k) => k.tarjeta === t && k.corte === corte);
          if (ex) Object.assign(ex, { dop, usd });
          else estado.cortes_conocidos.push({ id, tarjeta: t, corte, dop, usd, estado: "pendiente" });
          cambios.push(`Corte de la ${tj.corto} del ${fechaCorta(corte)}: ${rd(dop)}${usd ? ` + US$ ${usd}` : ""}`);
          return { ok: true, ahora: resumen() };
        }

        case "pagar_tarjeta": {
          const t = medioValido(a.tarjeta);
          if (!claves().includes(t)) fallo("eso no es una tarjeta");
          const corte = fechaValida(a.corte, "corte");
          const plan = calcularPlan(estado, hoy);
          const tj = estado.tarjetas.find((x) => x.clave === t)!;
          const fila = plan.tarjetas.find((r) => r.corte === corte && r.tarjeta === tj.nombre);
          let k = estado.cortes_conocidos.find((x) => x.tarjeta === t && x.corte === corte);
          if (!k) {
            if (!fila) fallo(`no encuentro el corte del ${corte} de la ${tj.corto}`);
            k = { id: fila!.id, tarjeta: t, corte, dop: fila!.cargado, usd: 0, estado: "pendiente" };
            estado.cortes_conocidos.push(k);
          }
          const total = k.dop + k.usd * estado.tasas.USD;
          const monto = a.monto === undefined ? redondear2(total) : montoValido(a.monto);
          k.estado = "pagado";
          cambios.push(`Pagada la ${tj.corto} (corte ${fechaCorta(corte)}): ${rd(monto)}`);
          if (Math.abs(monto - total) > 1) cambios.push(`Ojo: el corte era ${rd(total)} y pagó ${rd(monto)}`);
          if (a.ajustar_saldo !== false) moverSaldo(-monto, `pago ${tj.corto}`);
          return { ok: true, total_del_corte: redondear(total), pagado: monto, ahora: resumen() };
        }

        case "guardar_ingreso": {
          const id = opcional(a.id);
          const antes = id ? estado.ingresos.find((x) => x.id === id)?.estado : undefined;
          const i = upsert(
            estado.ingresos,
            id,
            () => ({ id: nuevoId("ing"), fecha: fechaValida(a.fecha), concepto: texto(a.concepto, "concepto"), monto: montoValido(a.monto, "monto", true), estado: a.estado === "hecho" ? ("hecho" as const) : ("pendiente" as const), tipo: a.tipo === "nomina" ? ("nomina" as const) : ("extra" as const) }),
            (x) => {
              if (a.fecha !== undefined) x.fecha = fechaValida(a.fecha);
              if (a.concepto !== undefined) x.concepto = texto(a.concepto, "concepto");
              if (a.monto !== undefined) x.monto = montoValido(a.monto, "monto", true);
              if (a.estado === "hecho" || a.estado === "pendiente") x.estado = a.estado;
              if (a.tipo === "nomina" || a.tipo === "extra") x.tipo = a.tipo;
            },
          );
          cambios.push(`${id ? "Cobro" : "+ Cobro"}: ${i.concepto} ${rd(i.monto)} el ${fechaCorta(i.fecha)}${i.estado === "hecho" ? " (recibido)" : ""}`);
          if (i.estado === "hecho" && antes !== "hecho" && a.ajustar_saldo !== false) moverSaldo(i.monto, i.concepto);
          return { ok: true, id: i.id, ahora: resumen() };
        }

        case "guardar_pago_deuda": {
          const id = opcional(a.id);
          const antes = id ? estado.deuda.plan.find((x) => x.id === id)?.estado : undefined;
          const p = upsert(
            estado.deuda.plan,
            id,
            () => ({ id: nuevoId("deuda"), fecha: fechaValida(a.fecha), concepto: opcional(a.concepto) ?? "Abono", monto: montoValido(a.monto), estado: a.estado === "hecho" ? ("hecho" as const) : ("pendiente" as const) }),
            (x) => {
              if (a.fecha !== undefined) x.fecha = fechaValida(a.fecha);
              if (a.concepto !== undefined) x.concepto = texto(a.concepto, "concepto");
              if (a.monto !== undefined) x.monto = montoValido(a.monto);
              if (a.estado === "hecho" || a.estado === "pendiente") x.estado = a.estado;
            },
          );
          estado.deuda.plan.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));
          cambios.push(`${estado.deuda.acreedor}: ${p.concepto} ${rd(p.monto)} el ${fechaCorta(p.fecha)}${p.estado === "hecho" ? " (pagado)" : ""}`);
          if (p.estado === "hecho" && antes !== "hecho" && a.ajustar_saldo !== false) moverSaldo(-p.monto, `cuota a ${estado.deuda.acreedor.toLowerCase()}`);
          return { ok: true, id: p.id, ahora: resumen() };
        }

        case "guardar_prestado": {
          const id = opcional(a.id);
          const antes = id ? estado.prestado.find((x) => x.id === id)?.estado : undefined;
          const valEstado = (v: unknown) => (v === "en la cuenta" || v === "por entrar" || v === "devuelto" ? v : undefined);
          const p = upsert(
            estado.prestado,
            id,
            () => ({ id: nuevoId("pr"), de: texto(a.de, "de"), monto: montoValido(a.monto), estado: valEstado(a.estado) ?? "en la cuenta", para: opcional(a.para) ?? "", devolver: opcional(a.devolver) ?? "" }),
            (x) => {
              if (a.de !== undefined) x.de = texto(a.de, "de");
              if (a.monto !== undefined) x.monto = montoValido(a.monto);
              const e = valEstado(a.estado);
              if (e) x.estado = e;
              if (a.para !== undefined) x.para = opcional(a.para) ?? "";
              if (a.devolver !== undefined) x.devolver = opcional(a.devolver) ?? "";
            },
          );
          cambios.push(`Prestado de ${p.de}: ${rd(p.monto)} (${p.estado})`);
          if (a.ajustar_saldo !== false) {
            if (p.estado === "devuelto" && antes === "en la cuenta") moverSaldo(-p.monto, `devuelto a ${p.de}`);
            if (p.estado === "en la cuenta" && antes === "por entrar") moverSaldo(p.monto, `entró lo de ${p.de}`);
          }
          return { ok: true, id: p.id, ahora: resumen() };
        }

        case "guardar_salida": {
          const id = opcional(a.id);
          const antes = id ? estado.otros.find((x) => x.id === id)?.estado : undefined;
          const o = upsert(
            estado.otros,
            id,
            () => {
              const eur = a.monto_eur !== undefined ? montoValido(a.monto_eur, "monto_eur") : undefined;
              return {
                id: nuevoId("otro"),
                fecha: fechaValida(a.fecha),
                concepto: texto(a.concepto, "concepto"),
                ...(eur !== undefined ? { monto_eur: eur } : { monto: montoValido(a.monto) }),
                estado: a.estado === "hecho" ? ("hecho" as const) : ("planificado" as const),
                categoria: opcional(a.categoria) ?? "otro",
                medio: opcional(a.medio) ?? `Sale de la ${principal().last4}`,
              };
            },
            (x) => {
              if (a.fecha !== undefined) x.fecha = fechaValida(a.fecha);
              if (a.concepto !== undefined) x.concepto = texto(a.concepto, "concepto");
              if (a.monto !== undefined) {
                x.monto = montoValido(a.monto);
                delete x.monto_eur;
              }
              if (a.monto_eur !== undefined) {
                x.monto_eur = montoValido(a.monto_eur, "monto_eur");
                delete x.monto;
              }
              if (a.estado === "hecho" || a.estado === "planificado") x.estado = a.estado;
              if (a.categoria !== undefined) x.categoria = opcional(a.categoria);
              if (a.medio !== undefined) x.medio = opcional(a.medio);
            },
          );
          const enRd = o.monto !== undefined ? o.monto : (o.monto_eur ?? 0) * estado.tasas.EUR;
          cambios.push(`Salida: ${o.concepto} ${o.monto_eur !== undefined ? `€ ${o.monto_eur}` : rd(o.monto)} el ${fechaCorta(o.fecha)}${o.estado === "hecho" ? " (hecha)" : ""}`);
          if (o.estado === "hecho" && antes !== "hecho" && a.ajustar_saldo !== false) moverSaldo(-enRd, o.concepto);
          return { ok: true, id: o.id, ahora: resumen() };
        }

        case "ajustar_plan": {
          const hechos: string[] = [];
          if (a.presupuesto_casa_mes !== undefined) {
            estado.presupuesto_casa_mes = montoValido(a.presupuesto_casa_mes);
            hechos.push(`presupuesto de casa ${rd(estado.presupuesto_casa_mes)}/mes`);
          }
          if (a.colchon !== undefined) {
            estado.colchon = montoValido(a.colchon, "colchon", true);
            hechos.push(`colchón ${rd(estado.colchon)}`);
          }
          if (a.horizonte !== undefined) {
            estado.horizonte = fechaValida(a.horizonte, "horizonte");
            hechos.push(`plan hasta el ${fechaCorta(estado.horizonte)}`);
          }
          if (a.tasa_usd !== undefined) {
            estado.tasas.USD = montoValido(a.tasa_usd);
            hechos.push(`dólar a ${estado.tasas.USD}`);
          }
          if (a.tasa_eur !== undefined) {
            estado.tasas.EUR = montoValido(a.tasa_eur);
            hechos.push(`euro a ${estado.tasas.EUR}`);
          }
          if (a.tarjeta_dia_a_dia !== undefined) {
            const t = medioValido(a.tarjeta_dia_a_dia);
            if (!claves().includes(t)) fallo("el día a día va en una tarjeta");
            estado.tarjeta_dia_a_dia = t;
            hechos.push(`día a día con la ${corto(t)}`);
          }
          if (a.viaje_inicio !== undefined) estado.viaje.inicio = fechaValida(a.viaje_inicio, "viaje_inicio");
          if (a.viaje_fin !== undefined) estado.viaje.fin = fechaValida(a.viaje_fin, "viaje_fin");
          if (a.viaje_inicio !== undefined || a.viaje_fin !== undefined) hechos.push(`viaje del ${fechaCorta(estado.viaje.inicio)} al ${fechaCorta(estado.viaje.fin)}`);
          if (a.viaje_presupuesto_eur !== undefined) {
            estado.viaje.presupuesto_eur = montoValido(a.viaje_presupuesto_eur);
            hechos.push(`viaje € ${estado.viaje.presupuesto_eur}`);
          }
          if (a.viaje_efectivo_eur !== undefined) {
            estado.viaje.efectivo_eur = montoValido(a.viaje_efectivo_eur, "viaje_efectivo_eur", true);
            hechos.push(`efectivo € ${estado.viaje.efectivo_eur}`);
          }
          if (estado.viaje.fin < estado.viaje.inicio) fallo("el viaje termina antes de empezar");
          if (estado.viaje.efectivo_eur > estado.viaje.presupuesto_eur) fallo("el efectivo no puede ser más que el presupuesto del viaje");
          if (a.supuesto_id !== undefined) {
            const sid = texto(a.supuesto_id, "supuesto_id", 40);
            const lista = (estado.supuestos ??= []);
            const s = lista.find((x) => x.id === sid);
            const titulo = opcional(a.supuesto_titulo);
            const valor = texto(a.supuesto_valor, "supuesto_valor", 500);
            if (s) {
              s.valor = valor;
              if (titulo) s.supuesto = titulo;
            } else lista.push({ id: sid, supuesto: titulo ?? sid, valor });
            hechos.push(`supuesto "${titulo ?? s?.supuesto ?? sid}"`);
          }
          if (!hechos.length) fallo("no dijiste qué ajustar");
          cambios.push(`Ajustes: ${hechos.join(", ")}`);
          return { ok: true, ahora: resumen() };
        }

        case "guardar_tarjeta": {
          const clave = texto(a.clave, "clave", 20).toLowerCase();
          const dia31 = (v: unknown, c: string) => {
            const n = Number(v);
            return Number.isInteger(n) && n >= 1 && n <= 31 ? n : fallo(`${c} debe ser un día del 1 al 31`);
          };
          let t = estado.tarjetas.find((x) => x.clave === clave);
          if (!t) {
            t = {
              clave,
              prefijo: clave,
              nombre: texto(a.nombre, "nombre", 60),
              corto: opcional(a.corto) ?? texto(a.nombre, "nombre", 20),
              corte_dia: dia31(a.corte_dia, "corte_dia"),
              vence_dia: dia31(a.vence_dia, "vence_dia"),
              pago_dia: dia31(a.pago_dia ?? a.vence_dia, "pago_dia"),
              ...(a.limite_dop !== undefined ? { limite_dop: montoValido(a.limite_dop) } : {}),
            };
            estado.tarjetas.push(t);
            cambios.push(`+ Tarjeta ${t.nombre}: corta el ${t.corte_dia}, vence el ${t.vence_dia}, se paga el ${t.pago_dia}`);
          } else {
            if (a.nombre !== undefined) t.nombre = texto(a.nombre, "nombre", 60);
            if (a.corto !== undefined) t.corto = texto(a.corto, "corto", 20);
            if (a.corte_dia !== undefined) t.corte_dia = dia31(a.corte_dia, "corte_dia");
            if (a.vence_dia !== undefined) t.vence_dia = dia31(a.vence_dia, "vence_dia");
            if (a.pago_dia !== undefined) t.pago_dia = dia31(a.pago_dia, "pago_dia");
            if (a.limite_dop !== undefined) t.limite_dop = montoValido(a.limite_dop);
            cambios.push(`Tarjeta ${t.nombre}: corta el ${t.corte_dia}, vence el ${t.vence_dia}, se paga el ${t.pago_dia}${t.limite_dop ? `, límite ${rd(t.limite_dop)}` : ""}`);
          }
          return { ok: true, ahora: resumen() };
        }

        case "guardar_nota": {
          const r = await fuentes.guardarNota({ id: opcional(a.id), tema: texto(a.tema, "tema", 80), texto: texto(a.texto, "texto", 4000), archivar: a.archivar === true });
          notasCambiadas++;
          return r;
        }
        case "leer_notas":
          return await fuentes.leerNotas(opcional(a.tema));
        case "buscar_historial":
          return await fuentes.buscar(texto(a.consulta, "consulta", 120));
        case "leer_conversacion": {
          const desde = Math.max(0, Math.floor(Number(a.desde) || 0));
          const hasta = Math.min(desde + 6, Math.floor(Number(a.hasta) || desde));
          return await fuentes.leerConversacion(desde, hasta);
        }
        default:
          return { error: `No existe la herramienta ${nombre}` };
      }
    } catch (e) {
      if (e instanceof ErrorHerramienta) return { error: e.message };
      throw e;
    }
  }

  return {
    declaraciones,
    ejecutar,
    resumen,
    get estado() {
      return estado;
    },
    cambios,
    get notasCambiadas() {
      return notasCambiadas;
    },
  };
}

export type Herramientas = ReturnType<typeof crearHerramientas>;
