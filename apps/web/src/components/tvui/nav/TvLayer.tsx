"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";
import { isUsable, itemsIn } from "./engine";
import { useTvNav } from "./TvNav";

/*
 * A layer of the TV shell (design-system 10.3 "Слои", TV document TV3): a card in the middle over the screen (a choice,
 * "More", details, the query) or a whole-screen step (PIN) — nothing comes in from a side (owner, 2026-11-06). Mounted
 * means open: it adds an entry to the history, so Back — the remote's, or the TV browser's own — closes this layer and
 * only it; the focus stays inside and returns to what opened it.
 * Close it from inside with the `close` it renders with (never by unmounting it from the parent while it is open).
 */

export type TvLayerLook = "dialog" | "screen";

const LOOKS: Record<TvLayerLook, string> = {
  // 60 px from the edges (the TV's safe area is ~54): room for the tallest card, the query's keyboard.
  dialog: "fixed inset-0 z-dialog grid place-items-center bg-scrim p-10",
  screen: "fixed inset-0 z-dialog bg-bg",
};

const BOX: Record<TvLayerLook, string> = {
  dialog:
    "flex max-h-full w-full max-w-160 flex-col gap-6 overflow-hidden rounded-lg bg-surface-1 p-10 shadow-float",
  screen: "flex h-full w-full flex-col",
};

export function TvLayer({
  onClose,
  label,
  look = "dialog",
  className,
  children,
}: {
  /** Called once the layer has been closed (Back, `close`): the parent stops rendering it. */
  onClose: () => void;
  label: string;
  look?: TvLayerLook;
  className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const nav = useTvNav();
  const [id, setId] = useState<number | null>(null);
  const handle = useRef<{ dismiss: () => void } | null>(null);
  const closed = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Deferred a tick: React's development double mount must not push two history entries.
    const timer = window.setTimeout(() => {
      const h = nav.openLayer(() => {
        closed.current = true;
        onCloseRef.current();
      });
      handle.current = h;
      setId(h.id);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      // Taken away while open (its screen left): its history entry goes with it.
      if (handle.current && !closed.current) handle.current.dismiss();
    };
  }, [nav]);

  // The background can't be reached while the layer is open (TV3), by the remote or by the pointer.
  useEffect(() => {
    if (id === null) return;
    const app = document.querySelector<HTMLElement>("[data-tv-app]");
    app?.setAttribute("inert", "");
    const box = document.querySelector<HTMLElement>(`[data-tv-layer="${id}"]`);
    const start = () =>
      box ? ([...box.querySelectorAll<HTMLElement>("[data-tv-initial]")].find(isUsable) ?? itemsIn(box)[0]) : null;
    const first = start();
    nav.focus(first);
    // Its items still loading (the lists of "Add to list"): the first to arrive takes the focus, unless it is inside.
    let wait: MutationObserver | null = null;
    if (box && !first) {
      wait = new MutationObserver(() => {
        if (box.contains(document.activeElement)) return wait?.disconnect();
        const el = start();
        if (!el) return;
        wait?.disconnect();
        nav.focus(el);
      });
      wait.observe(box, { childList: true, subtree: true });
    }
    return () => {
      wait?.disconnect();
      if (!document.querySelector("[data-tv-layer]")) app?.removeAttribute("inert");
    };
  }, [id, nav]);

  const host = typeof document === "undefined" ? null : document.getElementById("tv-layers");
  if (!host) return null;
  const close = () => handle.current?.dismiss();
  return createPortal(
    <div
      data-tv-layer={id ?? undefined}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={LOOKS[look]}
    >
      <div className={cn(BOX[look], className)}>{children(close)}</div>
    </div>,
    host,
  );
}
