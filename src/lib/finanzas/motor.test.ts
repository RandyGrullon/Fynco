import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calcularPlan, dia, hoyRD, iso, miles, redondear, redondear2 } from "./motor";
import type { Estado, Plan } from "./tipos";

// Los resultados esperados salen del motor original en Python (generar.py)
// corrido sobre el mismo plan. El plan de ejemplo usa datos inventados.
// Con FINANZAS_REAL=/carpeta se compara también contra un plan real local
// (estado.json + esperado-AAAA-MM-DD.json), que nunca se sube al repo.
const CALCULADOS = ["s-usd", "s-eur", "s-prestado", "s-casa", "s-viaje", "s-pagos", "s-estimado"];

function comparar(dir: string) {
  const estado = JSON.parse(readFileSync(join(dir, "estado.json"), "utf8")) as Estado;
  const fechas = readdirSync(dir)
    .filter((f) => /^esperado-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.slice(9, 19));
  expect(fechas.length).toBeGreaterThan(0);
  for (const hoy of fechas) {
    const esperado = JSON.parse(readFileSync(join(dir, `esperado-${hoy}.json`), "utf8"));
    const plan = calcularPlan(estado, hoy);
    for (const k of ["calendario", "tarjetas", "papi", "presupuesto", "movimientos", "prestado"] as const) {
      expect(plan[k], `${k} al ${hoy}`).toEqual(esperado[k]);
    }
    expect(plan.resumen.filter((r) => r.clave !== "actualizado"), `resumen al ${hoy}`).toEqual(esperado.resumen);
    const sup = plan.supuestos.filter((s) => CALCULADOS.includes(s.id));
    const esp = (esperado.supuestos as Plan["supuestos"]).filter((s) => CALCULADOS.includes(s.id));
    expect(Object.fromEntries(sup.map((s) => [s.id, s])), `supuestos al ${hoy}`).toEqual(
      Object.fromEntries(esp.map((s) => [s.id, s])),
    );
  }
}

describe("motor del plan", () => {
  it("da los mismos números que el motor original (plan de ejemplo, 5 fechas)", () => {
    comparar(join(__dirname, "__fixtures__", "ejemplo"));
  });

  it.runIf(Boolean(process.env.FINANZAS_REAL))("da los mismos números con el plan real", () => {
    comparar(process.env.FINANZAS_REAL!);
  });

  it("redondea como Python", () => {
    expect(redondear(2.5)).toBe(2);
    expect(redondear(3.5)).toBe(4);
    expect(redondear(-0.4)).toBe(0);
    expect(redondear(1150.68)).toBe(1151);
    expect(redondear2(47.494)).toBe(47.49);
    expect(miles(123456)).toBe("123,456");
    expect(miles(-36672)).toBe("-36,672");
  });

  it("maneja fechas sin zonas horarias", () => {
    expect(iso(dia("2026-12-31") + 1)).toBe("2027-01-01");
    expect(hoyRD(new Date("2026-10-15T02:30:00Z"))).toBe("2026-10-14"); // 10:30 p. m. en Santo Domingo
  });

  it("un consumo el día de corte entra en ese corte", () => {
    const estado = JSON.parse(
      readFileSync(join(__dirname, "__fixtures__", "ejemplo", "estado.json"), "utf8"),
    ) as Estado;
    const e: Estado = {
      ...estado,
      movimientos: [
        { id: "x1", fecha: "2026-11-13", tarjeta: "ikea", moneda: "DOP", monto: 1000, descripcion: "En el corte", categoria: "otro", estado: "real" },
        { id: "x2", fecha: "2026-11-14", tarjeta: "ikea", moneda: "DOP", monto: 2000, descripcion: "Después", categoria: "otro", estado: "real" },
      ],
    };
    const mov = calcularPlan(e, "2026-11-01").movimientos;
    expect(mov.find((m) => m.id === "x1")?.paga_el).toBe("2026-12-04");
    expect(mov.find((m) => m.id === "x2")?.paga_el).toBe("2027-01-04");
  });
});
