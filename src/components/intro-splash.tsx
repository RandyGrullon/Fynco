"use client";

import { useEffect, useState } from "react";

export const INTRO_KEY = "fynco:intro";

/**
 * Intro al abrir la app: el logo se arma pieza por pieza y la moneda se separa.
 * Es CSS puro (se pinta desde el HTML del servidor, antes de hidratar) y se
 * oculta sola al terminar. Sale una vez por sesión: un script en <head> marca
 * <html data-intro="skip"> si ya se vio.
 */
export function IntroSplash() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {}
    const t = setTimeout(() => setGone(true), 2200);
    return () => clearTimeout(t);
  }, []);

  if (gone) return null;

  return (
    <div className="intro-splash" aria-hidden="true">
      <svg className="intro-tile" width="112" height="112" viewBox="0 0 512 512">
        <rect width="512" height="512" rx="116" fill="#171A1F" />
        <rect x="0.75" y="0.75" width="510.5" height="510.5" rx="115.5" fill="none" stroke="#262A31" strokeWidth="6" />
        <g fill="#C8F05A">
          <rect className="intro-stem" x="148" y="104" width="76" height="304" rx="38" />
          <rect className="intro-top" x="148" y="104" width="224" height="76" rx="38" />
          <rect className="intro-arm" x="148" y="222" width="122" height="68" rx="34" />
          <circle className="intro-ring" cx="326" cy="256" r="34" fill="none" stroke="#C8F05A" strokeWidth="10" />
          <circle className="intro-coin" cx="326" cy="256" r="34" />
        </g>
      </svg>
      <span className="intro-word">Fynco</span>
    </div>
  );
}

/** Se inserta en <head>: si la intro ya se vio en esta sesión, no se pinta. */
export const introSkipScript = `try{if(sessionStorage.getItem("${INTRO_KEY}"))document.documentElement.setAttribute("data-intro","skip")}catch(e){}`;
