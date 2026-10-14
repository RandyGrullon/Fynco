"use client";

import { useMemo, useRef, useState } from "react";
import { dia, iso } from "@/lib/finanzas/motor";
import { conSigno, fechaCorta, rd } from "@/lib/finanzas/formato";
import type { FilaCalendario } from "@/lib/finanzas/tipos";

const W = 340;
const H = 170;
const M = { l: 6, r: 6, t: 14, b: 20 };

/** Saldo día a día (escalonado), con el viaje sombreado y el colchón punteado. Tocar muestra el día. */
export function GraficoSaldo({ calendario, colchon, viaje, hasta }: { calendario: FilaCalendario[]; colchon: number; viaje: { inicio: string; fin: string }; hasta: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<number | null>(null);

  const datos = useMemo(() => {
    if (!calendario.length) return null;
    const d0 = dia(calendario[0].fecha);
    const d1 = Math.max(dia(hasta), dia(calendario[calendario.length - 1].fecha));
    const n = d1 - d0 + 1;
    const saldo: number[] = new Array(n);
    const eventos: FilaCalendario[][] = Array.from({ length: n }, () => []);
    let actual = calendario[0].saldo;
    let k = 1;
    for (let i = 0; i < n; i++) {
      while (k < calendario.length && dia(calendario[k].fecha) === d0 + i) {
        actual = calendario[k].saldo;
        eventos[i].push(calendario[k]);
        k++;
      }
      saldo[i] = actual;
    }
    const min = Math.min(...saldo, colchon, 0);
    const max = Math.max(...saldo, colchon);
    const pad = (max - min) * 0.08 || 1000;
    return { d0, n, saldo, eventos, lo: min - pad, hi: max + pad };
  }, [calendario, colchon, hasta]);

  if (!datos) return null;
  const { d0, n, saldo, eventos, lo, hi } = datos;
  const x = (i: number) => M.l + (i / Math.max(1, n - 1)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);

  let path = `M${x(0)},${y(saldo[0])}`;
  for (let i = 1; i < n; i++) path += ` H${x(i)} V${y(saldo[i])}`;
  const vi = dia(viaje.inicio) - d0;
  const vf = dia(viaje.fin) - d0;
  const meses: { i: number; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const f = iso(d0 + i);
    if (f.endsWith("-01") || i === 0) meses.push({ i, label: fechaCorta(f).split(" ")[1] });
  }
  const minI = saldo.indexOf(Math.min(...saldo));

  function tocar(clientX: number) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((px - M.l) / (W - M.l - M.r)) * (n - 1));
    setSel(Math.min(n - 1, Math.max(0, i)));
  }

  const s = sel ?? null;
  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y select-none"
        role="img"
        aria-label="Tu dinero día a día"
        onPointerDown={(e) => tocar(e.clientX)}
        onPointerMove={(e) => (e.buttons || e.pointerType === "mouse") && tocar(e.clientX)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setSel(null)}
      >
        {vf >= 0 && vi < n && (
          <g>
            <rect x={x(Math.max(0, vi))} y={M.t} width={Math.max(0, x(Math.min(n - 1, vf)) - x(Math.max(0, vi)))} height={H - M.t - M.b} className="fill-secondary/60" />
            <text x={x(Math.max(0, vi)) + 3} y={M.t + 9} className="fill-muted-foreground text-[8px]">
              Viaje
            </text>
          </g>
        )}
        <line x1={M.l} x2={W - M.r} y1={y(colchon)} y2={y(colchon)} strokeDasharray="3 3" className="stroke-muted-foreground" strokeWidth={0.8} />
        <text x={W - M.r - 2} y={y(colchon) - 3} textAnchor="end" className="fill-muted-foreground text-[8px]">
          Colchón
        </text>
        {lo < 0 && <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} className="stroke-negative/60" strokeWidth={0.8} />}
        <path d={path} fill="none" className="stroke-primary" strokeWidth={1.8} strokeLinejoin="round" />
        <circle cx={x(minI)} cy={y(saldo[minI])} r={2.6} className="fill-negative" />
        {meses.map((m) => (
          <text key={m.i} x={x(m.i)} y={H - 6} className="fill-muted-foreground text-[8px]">
            {m.label}
          </text>
        ))}
        {s !== null && (
          <g>
            <line x1={x(s)} x2={x(s)} y1={M.t} y2={H - M.b} className="stroke-foreground/50" strokeWidth={0.8} />
            <circle cx={x(s)} cy={y(saldo[s])} r={3} className="fill-foreground" />
          </g>
        )}
      </svg>
      {s !== null && (
        <div className="mt-2 rounded-xl border border-border bg-background/80 p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-bold">{fechaCorta(iso(d0 + s), true)}</span>
            <span className="font-bold tabular-nums">{rd(saldo[s])}</span>
          </div>
          {eventos[s].length ? (
            <ul className="mt-1.5 flex flex-col gap-1 text-[13px] text-muted-foreground">
              {eventos[s].map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{e.concepto}</span>
                  <span className={e.monto > 0 ? "shrink-0 text-positive tabular-nums" : "shrink-0 tabular-nums"}>{conSigno(e.monto)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] text-muted-foreground">Ese día no entra ni sale nada de la cuenta.</p>
          )}
        </div>
      )}
    </div>
  );
}
