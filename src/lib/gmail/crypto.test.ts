import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

describe("cifrado del token", () => {
  beforeAll(() => {
    process.env.GMAIL_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("ida y vuelta", () => {
    const blob = encryptSecret("1//refresh-token");
    expect(blob.startsWith("v1.")).toBe(true);
    expect(blob).not.toContain("refresh-token");
    expect(decryptSecret(blob)).toBe("1//refresh-token");
  });

  it("cada cifrado es distinto", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  it("detecta si alguien lo alteró", () => {
    const [v, iv, tag, data] = encryptSecret("secreto").split(".");
    const tampered = [v, iv, tag, data.slice(0, -2) + (data.endsWith("A") ? "BB" : "AA")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rechaza una llave que no mide 32 bytes", () => {
    const prev = process.env.GMAIL_TOKEN_KEY;
    process.env.GMAIL_TOKEN_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
    process.env.GMAIL_TOKEN_KEY = prev;
  });
});
