"use client";

import { Ellipsis } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

/*
 * A card's "More" on a TV: a card is one stop of the remote, so what the site's card menu
 * holds — removing it from Continue watching, from the history, from a list — comes from holding OK on the card (the
 * TV's long press: OK let go early still opens the card), the remote's Menu key or a right click. The screen says so
 * by the focused card ("Hold OK for More"); the panel itself (./CardMore) loads only when it is first opened.
 */

/** The panel of a card's "More", loaded on its first use (bundle budget). */
export const CardMoreLayer = dynamic(() => import("./CardMore").then((m) => m.CardMoreLayer), { ssr: false });
export type { CardTarget } from "./CardMore";

/** How long OK is held for "More": Android's long press. */
const HOLD_MS = 500;

/** What a removable card does: hold OK, the Menu key or a right click calls `onMore`; a short OK opens the card. */
export function useHoldForMore(onMore: (() => void) | undefined) {
  const held = useRef<number | null>(null);
  const stop = () => {
    if (held.current) window.clearTimeout(held.current);
    held.current = null;
  };
  if (!onMore) return {};
  return {
    "data-tv-more": "",
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "ContextMenu") {
        e.preventDefault();
        stop();
        onMore();
        return;
      }
      if (e.key !== "Enter" || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      // OK opens the card when it is let go, as Android does; held, it opens "More" instead.
      e.preventDefault();
      if (held.current !== null) return;
      held.current = window.setTimeout(() => {
        held.current = 0;
        onMore();
      }, HOLD_MS);
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter" || held.current === null) return;
      const short = held.current !== 0;
      stop();
      if (short) e.currentTarget.click();
    },
    onBlur: stop,
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      stop();
      onMore();
    },
  };
}

/** The line by a focused removable card: the "More" mark and how to reach it. */
export function HoldHint({ className }: { className?: string }) {
  const t = useTranslations("tvui");
  return (
    <span className={className ?? "flex items-center gap-3 text-body-l text-text-2"}>
      <span aria-hidden className="grid size-9 place-items-center rounded-full bg-surface-2 text-text-1">
        <Ellipsis className="size-5" />
      </span>
      {t("holdForMore")}
    </span>
  );
}

/** One identity for the screen's life, calling the latest `fn`: memoised cards don't render again for it. */
export function useStable<A extends unknown[]>(fn: (...args: A) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}

/** Cards taken off a screen at once; `hide(id)` returns how to put one back. */
export function useHidden() {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const hide = useCallback((id: string) => {
    setHidden((s) => new Set(s).add(id));
    return () =>
      setHidden((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
  }, []);
  return { hidden, hide };
}
