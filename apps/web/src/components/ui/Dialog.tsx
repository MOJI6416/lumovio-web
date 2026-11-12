"use client";

import {
  cloneElement,
  type FocusEvent,
  isValidElement,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "./cn";
import { useOpenState } from "./layers";
import { lazyControl, useIdlePrefetch } from "./lazy-swap";

/*
 * Modal layers: Dialog — centred on a tablet and desktop, a bottom sheet on a phone; Sheet — a
 * bottom sheet everywhere (menus and popovers on a phone, ./Menu, ./Popover). Nothing slides in from a side of the
 * screen: details are a dialog too. What they do — the focus trap and its return, Escape and Back,
 * the stage, the default focus — is in ./DialogFrame.
 *
 * This module is the light part every screen imports: a closed layer draws nothing (or only its trigger), and the
 * layer itself (Radix Dialog with its focus scope and scroll lock) is fetched when the page is idle or when it opens,
 * whichever comes first — not first-load JS (bundle budget).
 */

/**
 * Dialog widths: `sm` and `md` — 480 (forms, confirmations), `lg` — 640, `xl` — 880. On a phone every size is
 * a full-width sheet.
 */
export type DialogSize = "sm" | "md" | "lg" | "xl";

export interface LayerProps {
  /** Controlled: the layer is open. Leave out with `trigger` to let the layer keep its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The control that opens the layer (one element; it gets the click and aria-haspopup); the focus returns to it. */
  trigger?: ReactNode;
  /** Names the layer; shown as an h3 unless `hideTitle`. */
  title: string;
  /** One line under the title (body-s). */
  description?: ReactNode;
  /** Keeps the title for screen readers only; the close button stays. */
  hideTitle?: boolean;
  /** What gets the focus on open; by default the first control of the body (a field, "Cancel"), else the close button. */
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const frame = lazyControl(() => import("./DialogFrame"));

type TriggerProps = {
  ref?: Ref<HTMLElement>;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  onPointerEnter?: (e: PointerEvent<HTMLElement>) => void;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
};

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

function LazyLayer({
  kind,
  size,
  open: openProp,
  onOpenChange,
  trigger,
  ...rest
}: LayerProps & { kind: "dialog" | "sheet"; size?: DialogSize }) {
  const [open, setOpen] = useOpenState(openProp, onOpenChange);
  const anchor = useRef<HTMLElement | null>(null);
  // Fetched once the page is idle, so even the first open is quick.
  useIdlePrefetch(frame);
  const [m, setM] = useState<Awaited<ReturnType<typeof frame.load>> | null>(null);
  // Kept once opened, so a close runs the layer's own focus return.
  const [used, setUsed] = useState(false);
  if (open && !used) setUsed(true);
  useLayoutEffect(() => {
    const loaded = frame.loaded();
    if (loaded) setM(() => loaded);
  }, []);
  useEffect(() => {
    if (open && !m) void frame.load().then((loaded) => setM(() => loaded));
  }, [open, m]);

  const own = isValidElement(trigger) ? (trigger as ReactElement<TriggerProps>) : null;
  const ownRef = own?.props.ref;
  const ref = useCallback(
    (node: HTMLElement | null) => {
      anchor.current = node;
      setRef(ownRef, node);
    },
    [ownRef],
  );
  const triggerEl =
    own &&
    cloneElement(own, {
      ref,
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      "data-state": open ? "open" : "closed",
      onClick: (e: MouseEvent<HTMLElement>) => {
        own.props.onClick?.(e);
        if (!e.defaultPrevented) setOpen(true);
      },
      // The pointer on its way or the focus: the layer starts loading before the press.
      onPointerEnter: (e: PointerEvent<HTMLElement>) => {
        own.props.onPointerEnter?.(e);
        void frame.load();
      },
      onFocus: (e: FocusEvent<HTMLElement>) => {
        own.props.onFocus?.(e);
        void frame.load();
      },
    } as TriggerProps);

  return (
    <>
      {triggerEl}
      {m && used && (
        <m.LayerFrame
          kind={kind}
          size={size}
          open={open}
          onOpenChange={setOpen}
          anchor={own ? anchor : undefined}
          {...rest}
        />
      )}
    </>
  );
}

/** A modal dialog: centred, 480 / 640 / 880 wide (`size`), a bottom sheet on a phone. */
export function Dialog(props: LayerProps & { size?: DialogSize }) {
  return <LazyLayer kind="dialog" {...props} />;
}

/** A bottom sheet with a handle (phones; menus and popovers use it there). */
export function Sheet(props: LayerProps) {
  return <LazyLayer kind="sheet" {...props} />;
}

/**
 * The action row at the bottom of a dialog: the main action on the right with "Cancel" before it; on a phone a
 * full-width column with the main action on top. Put "Cancel" first and the main action last.
 */
export function DialogActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("mt-6 flex flex-col-reverse gap-2 *:max-md:w-full md:flex-row md:justify-end", className)}
    >
      {children}
    </div>
  );
}
