"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 72;
const MAX = 120;

/** El gesto empieza arriba del todo, fuera de paneles abiertos y de listas con scroll propio. */
function canStart(target: EventTarget | null) {
  if (window.scrollY > 0) return false;
  if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-radix-popper-content-wrapper]')) return false;
  if (document.body.hasAttribute("data-scroll-locked")) return false;
  if (target instanceof Element && target.closest('[role="dialog"], [role="alertdialog"]')) return false;
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0) return false;
  }
  return true;
}

/** Desliza hacia abajo desde arriba para recargar los datos (la app instalada no lo trae). */
export function PullToRefresh() {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const gesture = useRef({ active: false, busy: false, startX: 0, startY: 0, pull: 0 });

  useEffect(() => {
    const g = gesture.current;

    const onStart = (e: TouchEvent) => {
      g.active = !g.busy && e.touches.length === 1 && canStart(e.target);
      g.pull = 0;
      if (!g.active) return;
      g.startX = e.touches[0].clientX;
      g.startY = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (!g.active) return;
      const dy = e.touches[0].clientY - g.startY;
      const dx = Math.abs(e.touches[0].clientX - g.startX);
      // Scroll normal hacia abajo o gesto horizontal (carruseles): no es para recargar.
      if (dy <= 0 || window.scrollY > 0 || (g.pull === 0 && dx > dy)) {
        g.active = false;
        if (g.pull) setPull((g.pull = 0));
        return;
      }
      e.preventDefault();
      g.pull = Math.min(MAX, dy * 0.5);
      setPull(g.pull);
    };

    const onEnd = async () => {
      if (!g.active) return;
      g.active = false;
      const go = g.pull >= THRESHOLD;
      g.pull = 0;
      if (!go) return setPull(0);
      g.busy = true;
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        // Marca todo como viejo y vuelve a pedir lo que está en pantalla.
        await Promise.all([qc.invalidateQueries(), new Promise((r) => setTimeout(r, 600))]);
      } finally {
        g.busy = false;
        setRefreshing(false);
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [qc]);

  if (!pull && !refreshing) return null;
  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div className="top-safe pointer-events-none fixed inset-x-0 z-[35] flex justify-center" style={{ transform: `translateY(${pull - 36}px)` }}>
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full border border-secondary bg-card shadow-lg"
        style={{ opacity: Math.max(0.35, progress) }}
        role={refreshing ? "status" : undefined}
        aria-label={refreshing ? "Actualizando" : undefined}
      >
        <RefreshCw
          className={cn("h-5 w-5", progress >= 1 ? "text-primary" : "text-muted-foreground", refreshing && "animate-spin")}
          style={refreshing ? undefined : { transform: `rotate(${Math.round(progress * 270)}deg)` }}
        />
      </span>
    </div>
  );
}
