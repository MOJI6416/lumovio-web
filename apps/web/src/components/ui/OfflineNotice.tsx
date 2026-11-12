"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";

const subscribe = (on: () => void) => {
  window.addEventListener("online", on);
  window.addEventListener("offline", on);
  return () => {
    window.removeEventListener("online", on);
    window.removeEventListener("offline", on);
  };
};

/**
 * No connection while the site is open: a quiet pill of words where toasts come (no
 * icon: it rides on every page's first load) — what is on the
 * screen stays, the pill says why the next tap won't load — and "Back online" for two seconds once it returns, while
 * the requests that waited go on by themselves (react-query). Lives in the toasts' live region (Toaster), so a screen
 * reader hears both. Not on the TV shell, which has its own states.
 */
export function OfflineNotice() {
  const t = useTranslations("errors");
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const [back, setBack] = useState(false);
  const [was, setWas] = useState(online);
  if (was !== online) {
    setWas(online);
    setBack(online);
  }
  useEffect(() => {
    if (!back) return;
    const id = setTimeout(() => setBack(false), 2000);
    return () => clearTimeout(id);
  }, [back]);
  if ((online && !back) || (typeof document !== "undefined" && document.documentElement.dataset.tv === "1")) return null;
  return (
    <p className="flex min-h-10 items-center material rounded-full px-4 text-body text-text-1 transition-[opacity,translate] duration-base ease-base starting:translate-y-2 starting:opacity-0">
      {t(online ? "backOnline" : "offlineTitle")}
    </p>
  );
}
