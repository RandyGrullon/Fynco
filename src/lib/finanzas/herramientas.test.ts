import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { crearHerramientas, type FuentesExternas } from "./herramientas";
import { calcularPlan, cifra } from "./motor";
import type { Estado } from "./tipos";

const base = JSON.parse(readFileSync(join(__dirname, "__fixtures__", "ejemplo", "estado.json"), "utf8")) as Estado;
const HOY = "2026-10-14";
const fuentes = (): FuentesExternas => ({
  buscar: vi.fn(async () => ({ ok: true })),
  leerConversacion: vi.fn(async () => []),
  leerNotas: vi.fn(async () => []),
  guardarNota: vi.fn(async () => ({ ok: true, id: "n1" })),
});

describe("herramientas del asistente", () => {
  it("registra un gasto con tarjeta sin tocar el original y dice cuándo se paga", async () => {
    const h = crearHerramientas(base, HOY, fuentes());
    const r = (await h.ejecutar("registrar_movimiento", { fecha: HOY, tarjeta: "jetblue", moneda: "DOP", monto: 750, descripcion: "Desayuno", categoria: "día a día" })) as { ok: boolean; se_paga_el: string };
    expect(r.ok).toBe(true);
    expect(r.se_paga_el).toBe("2026-11-19");
    expect(h.estado.movimientos).toHaveLength(base.movimientos.length + 1);
    expect(base.movimientos.some((m) => m.descripcion === "Desayuno")).toBe(false);
    expect(h.cambios[0]).toContain("Desayuno");
    // Gastó del día a día: baja lo que queda en la quincena.
    const antes = calcularPlan(base, HOY).presupuesto.find((p) => p.estado === "actual")!.queda;
    const despues = calcularPlan(h.estado, HOY).presupuesto.find((p) => p.estado === "actual")!.queda;
    expect(antes - despues).toBe(750);
  });

  it("un débito ya hecho se descuenta de la cuenta", async () => {
    const h = crearHerramientas(base, HOY, fuentes());
    await h.ejecutar("registrar_movimiento", { fecha: HOY, tarjeta: "cuenta", monto: 500, descripcion: "Farmacia" });
    expect(h.estado.cuentas[0].saldo).toBe(base.cuentas[0].saldo - 500);
  });

  it("rechaza datos inválidos sin cambiar nada", async () => {
    const h = crearHerramientas(base, HOY, fuentes());
    expect(await h.ejecutar("registrar_movimiento", { fecha: "14/10", tarjeta: "jetblue", monto: 10, descripcion: "x" })).toHaveProperty("error");
    expect(await h.ejecutar("registrar_movimiento", { fecha: HOY, tarjeta: "visa-inventada", monto: 10, descripcion: "x" })).toHaveProperty("error");
    expect(await h.ejecutar("registrar_movimiento", { fecha: HOY, tarjeta: "ikea", monto: -5, descripcion: "x" })).toHaveProperty("error");
    expect(await h.ejecutar("borrar", { lista: "movimientos", id: "no-existe" })).toHaveProperty("error");
    expect(h.cambios).toHaveLength(0);
  });

  it("simular compara tarjetas sin guardar nada", async () => {
    const h = crearHerramientas(base, HOY, fuentes());
    const r = (await h.ejecutar("simular", { fecha: "2026-11-04", monto: 124, moneda: "EUR", categoria: "regalo" })) as { opciones: { con: string; se_paga_el: string; al_final: { antes: number; despues: number } }[] };
    expect(r.opciones.map((o) => o.con)).toEqual(["ikea", "jetblue", "cuenta"]);
    expect(r.opciones.find((o) => o.con === "jetblue")!.se_paga_el).toBe("2026-12-19");
    expect(r.opciones.find((o) => o.con === "ikea")!.se_paga_el).toBe("2026-12-04");
    for (const o of r.opciones) expect(o.al_final.antes - o.al_final.despues).toBe(124 * base.tasas.EUR);
    expect(h.cambios).toHaveLength(0);
    expect(h.estado.movimientos).toHaveLength(base.movimientos.length);
  });

  it("pagar la tarjeta marca el corte y descuenta el pago de la cuenta", async () => {
    const h = crearHerramientas(base, HOY, fuentes());
    const r = (await h.ejecutar("pagar_tarjeta", { tarjeta: "jetblue", corte: "2026-10-01" })) as { pagado: number };
    const corte = base.cortes_conocidos.find((k) => k.tarjeta === "jetblue")!;
    expect(r.pagado).toBe(corte.dop + corte.usd * base.tasas.USD);
    expect(h.estado.cortes_conocidos.find((k) => k.tarjeta === "jetblue")!.estado).toBe("pagado");
    expect(h.estado.cuentas[0].saldo).toBe(base.cuentas[0].saldo - r.pagado);
    // Ya no aparece como pago pendiente, y tu dinero de hoy bajó lo mismo.
    const plan = calcularPlan(h.estado, HOY);
    expect(plan.calendario.some((e) => e.id === "pago-jb-2026-10")).toBe(false);
    expect(cifra(plan, "saldo_final")!.valor).toBe(cifra(calcularPlan(base, HOY), "saldo_final")!.valor);
  });

  it("marcar un cobro como recibido suma a la cuenta y no cambia el final", async () => {
    const h = crearHerramientas(base, "2026-10-16", fuentes());
    const id = base.ingresos.find((i) => i.fecha === "2026-10-16")!.id;
    await h.ejecutar("guardar_ingreso", { id, estado: "hecho" });
    const nomina = base.ingresos.find((i) => i.id === id)!.monto;
    expect(h.estado.cuentas[0].saldo).toBe(base.cuentas[0].saldo + nomina);
    const antes = cifra(calcularPlan(base, "2026-10-16"), "saldo_final")!.valor;
    expect(cifra(calcularPlan(h.estado, "2026-10-16"), "saldo_final")!.valor).toBe(antes);
  });

  it("devolver lo prestado lo saca de la cuenta sin cambiar tu dinero", async () => {
    const h = crearHerramientas(base, HOY, fuentes());
    const p = base.prestado[0];
    await h.ejecutar("guardar_prestado", { id: p.id, estado: "devuelto" });
    const antes = cifra(calcularPlan(base, HOY), "saldo_hoy")!.valor;
    expect(h.estado.cuentas[0].saldo).toBe(base.cuentas[0].saldo - p.monto);
    expect(cifra(calcularPlan(h.estado, HOY), "saldo_hoy")!.valor).toBe(antes);
  });

  it("ajusta el plan y valida el viaje", async () => {
    const h = crearHerramientas(base, HOY, fuentes());
    expect(await h.ejecutar("ajustar_plan", { colchon: 15000, tasa_usd: 63 })).toHaveProperty("ok", true);
    expect(h.estado.colchon).toBe(15000);
    expect(h.estado.tasas.USD).toBe(63);
    expect(await h.ejecutar("ajustar_plan", { viaje_fin: "2026-11-01" })).toHaveProperty("error");
  });

  it("las notas van a la memoria, no al plan", async () => {
    const f = fuentes();
    const h = crearHerramientas(base, HOY, f);
    await h.ejecutar("guardar_nota", { tema: "Pádel", texto: "Juega pádel los jueves, unos RD$ 600" });
    expect(f.guardarNota).toHaveBeenCalledWith({ id: undefined, tema: "Pádel", texto: "Juega pádel los jueves, unos RD$ 600", archivar: false });
    expect(h.cambios).toHaveLength(0);
    expect(h.notasCambiadas).toBe(1);
  });
});
