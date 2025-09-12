"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from 'next-intl';

const STORAGE_KEY = "fynco_ios_install_dismissed";

function isiOS() {
  if (typeof navigator === "undefined") return false;
  const ua =
    navigator.userAgent || navigator.vendor || (window as any).opera || "";
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

function inStandaloneMode() {
  if (typeof window === "undefined") return false;
  // iOS supports navigator.standalone, and modern browsers expose display-mode
  // matchMedia for standalone as well.
  const nav = navigator as any;
  try {
    return (
      ("standalone" in nav && Boolean(nav.standalone)) ||
      (window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches)
    );
  } catch (e) {
    return false;
  }
}

export default function IOSInstallBanner() {
  const [show, setShow] = useState(false);
  const t = useTranslations('iosInstall');
  const tCommon = useTranslations('common');

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
      if (dismissed) return;
    } catch (e) {
      // ignore localStorage errors
    }

    if (isiOS() && !inStandaloneMode()) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (e) {
      // ignore
    }
    setShow(false);
  };

  return (
    <div className="fixed left-4 right-4 bottom-6 z-50 flex items-start gap-3 rounded-lg bg-white/95 p-3 shadow-lg ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/5">
      <div className="flex-shrink-0 mt-0.5">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2v12"
            stroke="#111827"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 8l4-4 4 4"
            stroke="#111827"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex-1 text-sm text-slate-900 dark:text-slate-200">
        <div className="font-semibold">{t('title')}</div>
        <div className="mt-1">
          {t('instructions')}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={dismiss}
            className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100"
          >
            {tCommon('understood')}
          </button>
        </div>
      </div>
    </div>
  );
}
