"use client";

import { useEffect } from "react";

const EDITABLE = 'input, textarea, select, [contenteditable="true"]';

/**
 * Que la web se sienta como una app instalada:
 * - La app ocupa justo lo que se ve, también con el teclado abierto (--app-h y --app-y).
 * - Marca <html data-teclado> mientras se escribe, para esconder la barra de abajo.
 * - Bloquea el zoom con dos dedos en iOS, que ignora user-scalable=no.
 */
export function AppViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let ancho = 0;
    let altoMax = 0;

    const medir = () => {
      const alto = vv?.height ?? window.innerHeight;
      const w = window.innerWidth;
      // Al girar el teléfono cambia el alto normal de la pantalla.
      if (Math.abs(w - ancho) > 1) {
        ancho = w;
        altoMax = 0;
      }
      altoMax = Math.max(altoMax, alto);
      root.style.setProperty("--app-h", `${Math.round(alto)}px`);
      root.style.setProperty("--app-y", `${Math.round(vv?.offsetTop ?? 0)}px`);
      const escribiendo = document.activeElement instanceof Element && document.activeElement.matches(EDITABLE);
      root.toggleAttribute("data-teclado", escribiendo && altoMax - alto > 120);
    };
    const sinZoom = (e: Event) => e.preventDefault();
    const dosDedos = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    medir();
    vv?.addEventListener("resize", medir);
    vv?.addEventListener("scroll", medir);
    window.addEventListener("resize", medir);
    document.addEventListener("focusin", medir);
    document.addEventListener("focusout", medir);
    document.addEventListener("gesturestart", sinZoom);
    document.addEventListener("gesturechange", sinZoom);
    document.addEventListener("touchmove", dosDedos, { passive: false });
    return () => {
      vv?.removeEventListener("resize", medir);
      vv?.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      document.removeEventListener("focusin", medir);
      document.removeEventListener("focusout", medir);
      document.removeEventListener("gesturestart", sinZoom);
      document.removeEventListener("gesturechange", sinZoom);
      document.removeEventListener("touchmove", dosDedos);
    };
  }, []);
  return null;
}
