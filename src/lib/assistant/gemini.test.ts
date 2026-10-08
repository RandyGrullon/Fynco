import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiError, runToolLoop } from "./gemini";

const ok = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }] }), { status: 200 });
const fail = (status: number, googleStatus: string, message: string, reason?: string) =>
  new Response(JSON.stringify({ error: { code: status, status: googleStatus, message, details: reason ? [{ reason }] : [] } }), { status });

const base = {
  apiKey: "test",
  systemInstruction: "s",
  contents: [{ role: "user" as const, parts: [{ text: "hola" }] }],
  tools: [],
  executeTool: async () => ({}),
};

afterEach(() => vi.unstubAllGlobals());

describe("runToolLoop", () => {
  it("si un modelo no está disponible, prueba el siguiente", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return url.includes("gemini-3.8-flash") ? fail(404, "NOT_FOUND", "models/gemini-3.8-flash is not found") : ok("listo");
      }),
    );
    const r = await runToolLoop({ ...base, models: ["gemini-3.8-flash", "gemini-3.7-flash"] });
    expect(r.text).toBe("listo");
    expect(r.model).toBe("gemini-3.7-flash");
    expect(calls).toHaveLength(2);
  });

  it("una llave inválida no cambia de modelo y reporta el motivo", async () => {
    const fetchMock = vi.fn(async () => fail(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.", "API_KEY_INVALID"));
    vi.stubGlobal("fetch", fetchMock);
    const err = await runToolLoop({ ...base, models: ["gemini-3.8-flash", "gemini-3.7-flash"] }).catch((e) => e);
    expect(err).toBeInstanceOf(GeminiError);
    expect(err.code).toBe("misconfigured");
    expect(err.detail).toContain("reason=API_KEY_INVALID");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("modelo sin acceso para la cuenta (403 sobre el modelo) también cae al siguiente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("gemini-2.5-flash") ? fail(403, "PERMISSION_DENIED", "This model is not available for your project.") : ok("ok"),
      ),
    );
    const r = await runToolLoop({ ...base, models: ["gemini-2.5-flash", "gemini-3.8-flash"] });
    expect(r.model).toBe("gemini-3.8-flash");
  });
});
