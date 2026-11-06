"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentType, useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";

type Panel = ComponentType<{ onClose: () => void }>;
let loaded: Panel | null = null;
let pending: Promise<Panel> | null = null;
/** The open search's module, fetched once (a few lines instead of ui/lazy-swap, which pages without it would carry). */
const load = () =>
  (pending ??= import("./HeaderSearchPanel").then((m) => {
    loaded = m.HeaderSearchPanel;
    return loaded;
  }));

/**
 * The header's search button (design-system 7.19): a round button; a press or "/" opens the field and its list in the
 * header itself (./HeaderSearchPanel). Every page has the button and few open it, so the field, the list and the search
 * logic load when the pointer comes near it, it gets the focus or the browser is idle, as the account menu (bundle
 * budget). A phone has its Search tab instead.
 */
export function HeaderSearch() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [Full, setFull] = useState<Panel | null>(() => loaded);
  const show = () => {
    setOpen(true);
    void load().then((p) => setFull(() => p));
  };
  // Fetched when the browser is idle after the page has loaded, so it is there before anyone presses the button.
  useEffect(() => {
    const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(() => void load(), { timeout: 3000 }) : setTimeout(() => void load(), 1500));
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    return () => window.removeEventListener("load", idle);
  }, []);
  // "/" opens it from anywhere but a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      setOpen(true);
      void load().then((p) => setFull(() => p));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (open && Full) return <Full onClose={() => setOpen(false)} />;
  return (
    <IconButton
      icon={Search}
      label={t("search")}
      variant="secondary"
      aria-keyshortcuts="/"
      onPointerEnter={() => void load()}
      onFocus={() => void load()}
      onClick={show}
      className="max-md:hidden"
    />
  );
}
