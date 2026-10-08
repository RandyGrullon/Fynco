import { describe, expect, it } from "vitest";
import { safeNext } from "./auth-helpers";

const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);

describe("safeNext", () => {
  it("acepta rutas internas", () => {
    expect(safeNext("/inicio")).toBe("/inicio");
    expect(safeNext("/unirse/abc?x=1#y")).toBe("/unirse/abc?x=1#y");
  });

  it.each(["//evil.com", "/" + String.fromCharCode(92) + "evil.com", `/${TAB}/evil.com`, `/${LF}/evil.com`, "https://evil.com", "evil.com", "", null])(
    "rechaza %j",
    (v) => {
      expect(safeNext(v as string | null)).toBeNull();
    },
  );
});
