import { describe, expect, it } from "vitest";
import { PAGE_BREAK, chunkLines, compactStatement } from "./compact";

const filler = Array.from({ length: 45 }, (_, i) => `Texto legal ${i}`).join("\n");

describe("compactStatement", () => {
  it("guarda el encabezado y las líneas con fecha o monto", () => {
    const text = `BANCO POPULAR\nEstado de cuenta\n${filler}\n15/09/2026 | SUPERMERCADO NACIONAL | 3,420.00\nGracias por preferirnos\n16-SEP | GASOLINA | 1200.00\nFecha de corte: 28/09/2026`;
    const lines = compactStatement(text);
    expect(lines[0]).toBe("BANCO POPULAR");
    expect(lines).toContain("15/09/2026 | SUPERMERCADO NACIONAL | 3,420.00");
    expect(lines).toContain("16-SEP | GASOLINA | 1200.00");
    expect(lines).toContain("Fecha de corte: 28/09/2026");
    expect(lines).not.toContain("Gracias por preferirnos");
  });

  it("quita nombre, correo, teléfono y referencias largas (deja 4 dígitos)", () => {
    const text = "RANDY EMMANUEL GRULLON BAEZ\nrandy@example.com\nTel: 8298503804\n20/08 | 19/08 74856106231006172775432 | TASTY ASIA | 1,623.39";
    expect(compactStatement(text, { redact: ["Randy Grullón", "randy@example.com"] })).toEqual(["20/08 | 19/08 #5432 | TASTY ASIA | 1,623.39"]);
    expect(compactStatement("Cliente: RANDY GRULLON | Cuenta No.: 7XX-XXX4821", { redact: ["Randy Grullón"] })).toEqual(["Cliente: | Cuenta No.: 7XX-XXX4821"]);
  });

  it("pega el código del comercio (MCC) a su movimiento", () => {
    const text = "20/08 | 19/08 | SUPERMARKET | POLLENCA | 762.29\n5411 | 061552\n20/08 | 19/08 | BAR | 352.91\n5813 048384";
    expect(compactStatement(text)).toEqual(["20/08 | 19/08 | SUPERMARKET | POLLENCA | 762.29 | MCC 5411", "20/08 | 19/08 | BAR | 352.91 | MCC 5813"]);
  });

  it("dos compras iguales el mismo día no se pierden; el encabezado repetido por página sí se quita", () => {
    const head = "****-5263 | 65,000.00 | 0.00 | 14/09/2026 | 09/10/2026";
    const text = [head, "20/08 | 19/08 7485610623100617277543 | TASTY ASIA | 1,623.39", "20/08 | 19/08 7485610623100617451311 | TASTY ASIA | 1,623.39", PAGE_BREAK, head, "21/08 | 21/08 | Pago Via App | -36,640.78"].join("\n");
    expect(compactStatement(text)).toEqual([head, "20/08 | 19/08 #7543 | TASTY ASIA | 1,623.39", "20/08 | 19/08 #1311 | TASTY ASIA | 1,623.39", "21/08 | 21/08 | Pago Via App | -36,640.78"]);
  });
});

describe("chunkLines", () => {
  it("parte por tamaño sin cortar líneas", () => {
    const { chunks, truncated } = chunkLines(["aaaa", "bbbb", "cccc"], 10, 5);
    expect(chunks).toEqual(["aaaa\nbbbb", "cccc"]);
    expect(truncated).toBe(false);
  });

  it("avisa si no cabe todo", () => {
    const { chunks, truncated } = chunkLines(["aaaa", "bbbb", "cccc", "dddd"], 5, 2);
    expect(chunks).toEqual(["aaaa", "bbbb"]);
    expect(truncated).toBe(true);
  });
});
