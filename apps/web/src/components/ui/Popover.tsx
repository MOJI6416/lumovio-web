"use client";

import { Popover as P } from "radix-ui";
import { type ReactNode, useRef } from "react";
import { cn } from "./cn";
import { Sheet } from "./Dialog";
import { isLayerBackKey, rememberLayerTrigger, useOpenState, usePhoneLayout } from "./layers";
import { useOnStage, usePortalContainer } from "./portal";

export interface PopoverProps {
  /** The control that opens it: the "i" next to a heading, "All ratings", the rating button. */
  trigger: ReactNode;
  /** Names the popover for screen readers; the heading of the sheet on a phone. */
  title: string;
  /** Also shows the title on a tablet and desktop (an "i" explanation usually does without). */
  showTitle?: boolean;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Popover (design-system 7.8): explanations behind "i", "All ratings", "How it was picked", picking a rating.
 * 280–360 wide on --surface-2; closes with Escape, a press outside and a TV remote's Back. On a phone it opens as a
 * bottom sheet with the title as its heading (7.9).
 */
export function Popover({
  trigger,
  title,
  showTitle,
  children,
  align = "center",
  side = "bottom",
  open: openProp,
  onOpenChange,
}: PopoverProps) {
  const phone = usePhoneLayout();
  const [open, setOpen] = useOpenState(openProp, onOpenChange);
  const container = usePortalContainer();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const stage = useOnStage(open && !phone, triggerRef);
  if (phone) {
    return (
      <Sheet open={open} onOpenChange={setOpen} trigger={trigger} title={title}>
        {children}
      </Sheet>
    );
  }
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger asChild ref={triggerRef}>
        {trigger}
      </P.Trigger>
      <P.Portal container={container}>
        <P.Content
          ref={(node) => rememberLayerTrigger(node, triggerRef.current)}
          aria-label={title}
          align={align}
          side={side}
          sideOffset={8}
          collisionPadding={16}
          data-nav-trap
          onKeyDown={(e) => {
            if (isLayerBackKey(e)) {
              e.preventDefault();
              setOpen(false);
            }
          }}
          className={cn(
            "z-popover w-max min-w-70 max-w-[min(22.5rem,var(--radix-popover-content-available-width))] origin-(--radix-popover-content-transform-origin) rounded-md border border-line bg-surface-2 p-4 text-body text-text-1 shadow-float outline-none transition-[opacity,scale] duration-base ease-base starting:scale-95 starting:opacity-0",
            stage && "stage",
          )}
        >
          {showTitle && <p className="mb-2 text-title text-text-1">{title}</p>}
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
