"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const STORAGE_KEY = "fynco_ios_install_dismissed";

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia?.("(display-mode: standalone)").matches;
}

/** Safari en iOS no ofrece instalar la PWA: explicamos cómo hacerlo. */
export function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {}
    if (isIOS() && !isStandalone()) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <div className="fixed inset-x-4 bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+5.5rem)] z-30 flex items-start gap-3 rounded-xl border border-secondary bg-card p-3.5 shadow-2xl md:hidden" role="dialog" aria-label="Instalar Fynco">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Share className="h-[18px] w-[18px]" />
      </span>
      <p className="flex-1 text-sm">
        <span className="block font-bold">Instala Fynco en tu iPhone</span>
        <span className="text-muted-foreground">Toca Compartir en Safari y luego “Agregar a inicio”.</span>
      </p>
      <button type="button" onClick={dismiss} aria-label="Cerrar" className="-m-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
