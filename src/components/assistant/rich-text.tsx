import { Fragment } from "react";

/** **negrita** → <strong>. Solo nodos de texto: nada de HTML del modelo. */
function inline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
      <strong key={`${keyBase}-${i}`} className="font-bold text-foreground">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={`${keyBase}-${i}`}>{p.replace(/(^|\s)\*(\S[^*]*\S|\S)\*(?=\s|$|[.,;:!?])/g, "$1$2")}</Fragment>
    ),
  );
}

const LIST_RE = /^\s*(?:[-*•]|\d+[.)])\s+/;

/** Párrafos y listas cortas, que es lo que el asistente devuelve. */
export function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ({ type: "p"; text: string } | { type: "ul"; items: string[] })[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^#{1,6}\s+/, "").trimEnd();
    if (!line.trim()) {
      blocks.push({ type: "p", text: "" });
      continue;
    }
    if (LIST_RE.test(line)) {
      const item = line.replace(LIST_RE, "");
      const last = blocks[blocks.length - 1];
      if (last?.type === "ul") last.items.push(item);
      else blocks.push({ type: "ul", items: [item] });
    } else {
      const last = blocks[blocks.length - 1];
      if (last?.type === "p" && last.text) last.text += `\n${line}`;
      else blocks.push({ type: "p", text: line });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {blocks
        .filter((b) => b.type === "ul" || b.text)
        .map((b, i) =>
          b.type === "ul" ? (
            <ul key={i} className="flex flex-col gap-1">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0">{inline(item, `${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p key={i} className="whitespace-pre-wrap">
              {inline(b.text, String(i))}
            </p>
          ),
        )}
    </div>
  );
}
