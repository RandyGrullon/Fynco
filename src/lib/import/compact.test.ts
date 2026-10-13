import { describe, expect, it } from "vitest";
import { chunkLines, compactStatement } from "./compact";

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

  it("quita espacios de más y líneas repetidas seguidas", () => {
    expect(compactStatement("  a   b  \n  a b\n\nc")).toEqual(["a b", "c"]);
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
