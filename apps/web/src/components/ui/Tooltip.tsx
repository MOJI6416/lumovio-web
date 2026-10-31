"use client";

import {
  cloneElement,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { useOnStage, usePortalContainer } from "./portal";

type Side = "top" | "bottom" | "left" | "right";

const DELAY = 400;
// Moving from one hint to the next within this time shows the next one at once (as Radix's skipDelayDuration).
const SKIP = 300;
const GAP = 6;
const EDGE = 8;
let lastClosed = 0;

type TriggerProps = {
  ref?: Ref<HTMLElement>;
  onPointerEnter?: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (e: PointerEvent<HTMLElement>) => void;
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
  "aria-describedby"?: string;
};

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/** Where the hint goes: on `side` of the trigger, flipped when there is no room, kept 8 px inside the window. */
function place(trigger: DOMRect, tip: DOMRect, side: Side) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (v: number, size: number, max: number) =>
    Math.min(Math.max(v, EDGE), Math.max(EDGE, max - size - EDGE));
  let s = side;
  if (s === "top" && trigger.top - GAP - tip.height < EDGE) s = "bottom";
  else if (s === "bottom" && trigger.bottom + GAP + tip.height > vh - EDGE) s = "top";
  else if (s === "left" && trigger.left - GAP - tip.width < EDGE) s = "right";
  else if (s === "right" && trigger.right + GAP + tip.width > vw - EDGE) s = "left";
  if (s === "top" || s === "bottom") {
    return {
      left: clamp(trigger.left + trigger.width / 2 - tip.width / 2, tip.width, vw),
      top: s === "top" ? trigger.top - GAP - tip.height : trigger.bottom + GAP,
    };
  }
  return {
    left: s === "left" ? trigger.left - GAP - tip.width : trigger.right + GAP,
    top: clamp(trigger.top + trigger.height / 2 - tip.height / 2, tip.height, vh),
  };
}

/**
 * Tooltip (design-system 7.8): a short hint (up to 40 characters) for an icon-only button or a badge, after 400 ms of
 * hover or on keyboard focus; 12/600 on --surface-3, body size on TV (10.3). A tap or a click doesn't open it — the
 * control's `aria-label` says the same — and neither does a focus that isn't the keyboard's (a dialog that opens
 * with its close button focused). Never the only place of information or of an action. Escape, a press, leaving
 * and scrolling close it.
 *
 * A small hint of its own rather than Radix Tooltip: it sits on every icon button of every page, and Radix brings
 * its positioning engine with it (≈ 15 KB gzip on pages that have no other floating layer; bundle budget).
 */
export function Tooltip({
  label,
  side = "top",
  children,
}: {
  label: string;
  side?: Side;
  /** One focusable element; it gets the hover and focus handlers and, while open, aria-describedby. */
  children: ReactElement;
}) {
  const id = useId();
  const container = usePortalContainer();
  const trigger = useRef<HTMLElement | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const stage = useOnStage(open, trigger);

  const show = useCallback((now: boolean) => {
    clearTimeout(timer.current);
    if (now || Date.now() - lastClosed < SKIP) setOpen(true);
    else timer.current = setTimeout(() => setOpen(true), DELAY);
  }, []);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen((was) => {
      if (was) lastClosed = Date.now();
      return false;
    });
    setPos(null);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Measured before it is painted, then placed.
  useLayoutEffect(() => {
    if (!open || !trigger.current || !tip.current) return;
    setPos(place(trigger.current.getBoundingClientRect(), tip.current.getBoundingClientRect(), side));
  }, [open, side]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    // A scroll moves the trigger away from its hint (Radix closes it the same way).
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && e.target.contains(trigger.current)) hide();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  const own = children.props as TriggerProps;
  const ownRef = own.ref;
  const ref = useCallback(
    (node: HTMLElement | null) => {
      trigger.current = node;
      setRef(ownRef, node);
    },
    [ownRef],
  );
  const trigger$ = cloneElement(children as ReactElement<TriggerProps>, {
    ref,
    "aria-describedby": open
      ? [own["aria-describedby"], id].filter(Boolean).join(" ")
      : own["aria-describedby"],
    onPointerEnter: (e) => {
      own.onPointerEnter?.(e);
      if (e.pointerType !== "touch") show(false);
    },
    onPointerLeave: (e) => {
      own.onPointerLeave?.(e);
      hide();
    },
    onPointerDown: (e) => {
      own.onPointerDown?.(e);
      hide();
    },
    onFocus: (e) => {
      own.onFocus?.(e);
      // Only the keyboard's (and the remote's) focus: a click focuses the button too.
      if (e.currentTarget.matches(":focus-visible")) show(true);
    },
    onBlur: (e) => {
      own.onBlur?.(e);
      hide();
    },
  });

  return (
    <>
      {trigger$}
      {open &&
        createPortal(
          <div
            ref={tip}
            id={id}
            role="tooltip"
            style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}
            className={cn(
              "pointer-events-none fixed z-popover max-w-60 rounded-sm bg-surface-3 px-2 py-1 text-caption text-text-1 shadow-float transition-opacity duration-fast ease-fast starting:opacity-0 in-data-[tv=1]:text-body",
              stage && "stage",
            )}
          >
            {label}
          </div>,
          container ?? document.body,
        )}
    </>
  );
}
