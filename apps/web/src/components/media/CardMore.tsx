"use client";

import { Ellipsis } from "lucide-react";
import { useTranslations } from "next-intl";
import { type MouseEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { type GuestIntent, takeGuestIntent } from "@/components/shell/GuestGate";
import { cn } from "@/components/ui/cn";
import { IconButton } from "@/components/ui/IconButton";
import { lazyControl, OPEN_KEYS, useLazySwap } from "@/components/ui/lazy-swap";
import type { CardMenuExtra } from "./CardMenu";
import type { ActionTitle } from "./usePersonalActions";

const full = lazyControl(() => import("./CardMenu"));

/**
 * Where the "More" button is seen: `hover` — with a mouse on hover and keyboard focus, on a
 * touch screen a long press opens the same menu as a sheet (no button on every poster), on TV not at all (a card is
 * one focus stop; its actions are on the title page); `always` — also shown on touch screens and TV, where the menu
 * holds something the title page doesn't ("Remove from Continue watching"). Never pressable while unseen.
 */
const VISIBILITY = {
  hover:
    "pointer-events-none opacity-0 transition-opacity duration-fast ease-fast pointer-fine:group-hover/card:pointer-events-auto pointer-fine:group-hover/card:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 group-has-[a:focus-visible]/card:opacity-100 in-data-[tv=1]:hidden",
  always:
    "transition-opacity duration-fast ease-fast pointer-fine:pointer-events-none pointer-fine:opacity-0 pointer-fine:group-hover/card:pointer-events-auto pointer-fine:group-hover/card:opacity-100 any-pointer-coarse:pointer-events-auto any-pointer-coarse:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 group-has-[a:focus-visible]/card:opacity-100",
} as const;

export type MoreVisibility = keyof typeof VISIBILITY;

/**
 * A card's "More" button (IconButton Ellipsis on the artwork). Every card has one, the menu behind it is opened
 * rarely: the menu, its actions and dialogs (./CardMenu) load when the pointer comes near the button, it gets the focus,
 * a long press asks for it or the browser is idle — then they take the button's place, open if it was already pressed
 * (bundle budget, as ui/Select). `openSignal` changes to open it from the card (a long press).
 *
 * A guest's action started on this card is done here once they are back signed in (GuestGate's intent).
 */
export function CardMore({
  title,
  visibility = "hover",
  openSignal = 0,
  extra,
  className,
}: {
  title: ActionTitle;
  visibility?: MoreVisibility;
  openSignal?: number;
  extra?: CardMenuExtra;
  className?: string;
}) {
  const t = useTranslations("card");
  const { me } = useSession();
  const light = useRef<HTMLButtonElement>(null);
  const { full: m, start, activate } = useLazySwap(full, light);
  const [replay, setReplay] = useState<GuestIntent["action"] | null>(null);
  const signedIn = Boolean(me?.activeProfile);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a long press (a new signal) asks for the menu
  useEffect(() => {
    if (openSignal && !m) activate(true);
  }, [openSignal]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per card, after signing in
  useEffect(() => {
    if (!signedIn) return;
    const action = takeGuestIntent(title.id);
    if (action) {
      setReplay(action);
      activate(false);
    }
  }, [signedIn, title.id]);

  const cls = cn(VISIBILITY[visibility], className);
  if (m) return <m.CardMenu title={title} initialOpen={start.open} focusTrigger={start.focus} openSignal={openSignal} replay={replay} extra={extra} className={cls} />;
  return (
    <IconButton
      ref={light}
      icon={Ellipsis}
      variant="stage"
      size="sm"
      label={t("more", { title: title.title })}
      aria-haspopup="menu"
      aria-expanded={false}
      className={cls}
      onPointerEnter={() => activate(false)}
      onFocus={() => activate(false)}
      onPointerDown={(e) => {
        if (e.button === 0) activate(true);
      }}
      onKeyDown={(e) => {
        if (!OPEN_KEYS.includes(e.key)) return;
        e.preventDefault();
        activate(true);
      }}
    />
  );
}

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10;

/**
 * A long press on a card with a finger opens its "More" menu instead of following the link; a short tap still
 * opens the title, a swipe still scrolls the shelf. Returns the handlers for the card's root and the signal for
 * CardMore. With a mouse the right button keeps the browser's own menu ("Open in new tab").
 */
export function useLongPress() {
  const [signal, setSignal] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: clears the timer once, when the card goes
  useEffect(() => cancel, []);
  const open = () => {
    fired.current = true;
    cancel();
    setSignal((n) => n + 1);
    navigator.vibrate?.(10);
  };
  return {
    signal,
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        fired.current = false;
        if (e.pointerType !== "touch" || (e.target as Element).closest("button")) return;
        from.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(open, LONG_PRESS_MS);
      },
      onPointerMove: (e: PointerEvent) => {
        const f = from.current;
        if (f && Math.hypot(e.clientX - f.x, e.clientY - f.y) > MOVE_TOLERANCE) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      // Android fires the context menu on a long press (before our timer, sometimes): the same menu, not the browser's.
      onContextMenu: (e: MouseEvent) => {
        if (!from.current && !fired.current) return;
        e.preventDefault();
        if (!fired.current) open();
      },
      // The tap that ends a long press doesn't open the title.
      onClickCapture: (e: MouseEvent) => {
        if (!fired.current) return;
        fired.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    },
  };
}
