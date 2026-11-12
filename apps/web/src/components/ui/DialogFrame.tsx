"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog as D } from "radix-ui";
import { type ReactNode, type RefObject, useContext, useLayoutEffect, useRef, useState } from "react";
import { cn } from "./cn";
import type { DialogSize, LayerProps } from "./Dialog";
import { IconButton } from "./IconButton";
import {
  captureFocus,
  type FocusOrigin,
  isLayerBackKey,
  isToastPress,
  rememberLayerTrigger,
  restoreFocus,
  useOpenState,
} from "./layers";
import {
  isOnStage,
  LayerStageContext,
  layerOrigin,
  PortalContainerContext,
  usePortalContainer,
} from "./portal";

/*
 * The modal layers themselves, loaded the first time one opens (./Dialog draws nothing until then, or only the
 * trigger; bundle budget). Modal layers: Dialog — centred on a tablet and desktop, a bottom sheet
 * on a phone; Sheet — a bottom sheet everywhere (menus and popovers on a phone, ./Menu, ./Popover). No layer comes in
 * from a side of the screen. Both: focus trapped inside and given back to the control that opened
 * the layer, Escape and a TV remote's Back close it, a close button that stays when the title is hidden,
 * the entrance (--dur-slow; none with reduced motion, globals.css).
 *
 * Floating layers opened inside one (a Select list, a menu, a tooltip) are portalled into it, so they sit above it:
 * z-popover is under z-dialog in the page.
 *
 * Opened from a stage (the sign-in wall, "Who's watching?", the player, the sources screen), a layer takes the
 * stage's dark values in either theme instead of a light dialog over the dark screen (./portal).
 *
 * The focus goes to `initialFocus`, else to the first control of the body — the first field of a form, or "Cancel"
 * of a confirmation (DialogActions puts it first) — and only then to the close button.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The first control in `root` that can take the focus (shown, not inert). */
function firstFocusable(root: HTMLElement | null) {
  for (const el of root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []) {
    if (el.getClientRects().length > 0 && !el.closest("[inert]")) return el;
  }
  return null;
}

export type Kind = "dialog" | "sheet";

const WIDTH: Record<DialogSize, string> = {
  sm: "md:max-w-120",
  md: "md:max-w-120",
  lg: "md:max-w-160",
  xl: "md:max-w-220",
};

// The sheet look, written out per breakpoint below (Tailwind needs whole class names).
const KIND: Record<
  Kind,
  { overlay: string; content: string; handle: string; x: string; top: string; bottom: string }
> = {
  dialog: {
    overlay: "items-end md:items-center md:p-8",
    content:
      "max-md:max-h-[92dvh] max-md:rounded-t-lg max-md:border-b-0 max-md:pb-[env(safe-area-inset-bottom)] max-md:starting:translate-y-full md:max-h-[85dvh] md:rounded-lg md:starting:scale-98 md:starting:opacity-0",
    handle: "md:hidden",
    x: "px-4 md:px-6",
    top: "pt-3 md:pt-6",
    bottom: "pb-4 md:pb-6",
  },
  sheet: {
    overlay: "items-end",
    content:
      "max-h-[92dvh] rounded-t-lg border-b-0 pb-[env(safe-area-inset-bottom)] starting:translate-y-full sm:max-w-160",
    handle: "",
    x: "px-4 sm:px-6",
    top: "pt-3",
    bottom: "pb-4",
  },
};

export interface LayerFrameProps extends Omit<LayerProps, "trigger"> {
  kind: Kind;
  size?: DialogSize;
  /** The trigger ./Dialog drew: the focus goes back to it on close, and it says whether the layer is on a stage. */
  anchor?: RefObject<HTMLElement | null>;
}

export function LayerFrame({
  kind,
  size = "md",
  open: openProp,
  onOpenChange,
  anchor,
  title,
  description,
  hideTitle,
  initialFocus,
  children,
}: LayerFrameProps) {
  const tc = useTranslations("common");
  const [open, setOpen] = useOpenState(openProp, onOpenChange);
  const container = usePortalContainer();
  // Floating layers inside go into the overlay (not the scrolling content, which would clip them).
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  // Where the focus was (the trigger, or what opened it from code), read before the layer and a closing menu change it.
  const origin = useRef<FocusOrigin | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const forcedStage = useContext(LayerStageContext);
  const [stage, setStage] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    origin.current = anchor ? { el: anchor.current, trigger: null } : captureFocus();
    if (forcedStage === null) {
      setStage(isOnStage(origin.current.el ?? origin.current.trigger ?? layerOrigin()));
    }
  }, [open, anchor, forcedStage]);
  const k = KIND[kind];

  const close = (
    <D.Close asChild>
      <IconButton
        icon={X}
        label={tc("close")}
        size="sm"
        className={hideTitle ? "absolute end-2 top-2" : "-me-2 -mt-1"}
      />
    </D.Close>
  );

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal container={container}>
        <D.Overlay
          ref={setLayer}
          className={cn(
            "fixed inset-0 z-scrim flex justify-center bg-scrim transition-opacity duration-slow ease-slow starting:opacity-0",
            k.overlay,
            (forcedStage ?? stage) && "stage",
          )}
        >
          <PortalContainerContext.Provider value={layer}>
            <D.Content
              ref={(node) => rememberLayerTrigger(node, anchor?.current ?? null)}
              data-nav-trap
              // No description: no aria-describedby (Radix would point it at nothing and warn).
              {...(description ? {} : { "aria-describedby": undefined })}
              onOpenAutoFocus={(e) => {
                const target = initialFocus?.current ?? firstFocusable(body.current);
                if (target) {
                  e.preventDefault();
                  target.focus({ preventScroll: true });
                }
              }}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                restoreFocus(origin.current);
              }}
              // Opened from a menu item that was gone before the layer could read it ("Copy details" in "More"): the
              // menu then gives the focus back to its own button, and the layer takes it back — that button is the
              // one to return to.
              onBlur={(e) => {
                const to = e.relatedTarget;
                if (origin.current?.el || origin.current?.trigger || !(to instanceof HTMLElement)) return;
                // A list or menu opened from inside sits in the overlay, not in the content: not where the layer came from.
                if (!e.currentTarget.contains(to) && !layer?.contains(to)) origin.current = { el: to, trigger: null };
              }}
              // "Undo" in a toast is not a press outside: the dialog stays open (found in H2).
              onPointerDownOutside={(e) => {
                if (isToastPress(e.detail.originalEvent)) e.preventDefault();
              }}
              onKeyDown={(e) => {
                if (isLayerBackKey(e)) {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
              className={cn(
                "relative flex w-full flex-col overflow-hidden border border-line bg-surface-1 text-text-1 shadow-float outline-none transition-[opacity,translate,scale] duration-slow ease-slow",
                k.content,
                kind === "dialog" && WIDTH[size],
              )}
            >
              <div
                aria-hidden
                className={cn("mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-2", k.handle)}
              />
              {hideTitle ? (
                <D.Title className="sr-only">{title}</D.Title>
              ) : (
                <div className={cn("flex shrink-0 items-start gap-3 pb-4", k.x, k.top)}>
                  <div className="min-w-0 flex-1">
                    <D.Title className="text-h3 text-text-1">{title}</D.Title>
                    {description && (
                      <D.Description className="mt-1 text-body-s text-text-2">{description}</D.Description>
                    )}
                  </div>
                  {close}
                </div>
              )}
              {hideTitle && description && <D.Description className="sr-only">{description}</D.Description>}
              {/* pt-1: room for the focus ring of the first field, which the scrolling box would clip. */}
              <div
                ref={body}
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-contain pt-1",
                  k.x,
                  k.bottom,
                  hideTitle && k.top,
                )}
              >
                {children}
              </div>
              {hideTitle && close}
            </D.Content>
          </PortalContainerContext.Provider>
        </D.Overlay>
      </D.Portal>
    </D.Root>
  );
}

/** The full layers, for code that is itself loaded on demand (the confirmation dialog). */
export function Dialog(props: Omit<LayerFrameProps, "kind">) {
  return <LayerFrame kind="dialog" {...props} />;
}
