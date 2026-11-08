"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { FilterChip } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { lazyControl, useLazySwap, useStandIn } from "@/components/ui/lazy-swap";

export type Layers = typeof import("./pill-layers");
const layers = lazyControl(() => import("./pill-layers"));
export type Opened = { open: boolean; setOpen: (open: boolean) => void };

/** FilterChip is a toggle (aria-pressed); as the trigger of a menu, a popover or the sheet it is not. */
export const NOT_TOGGLE = { "aria-pressed": undefined };

/**
 * A filter pill (design-system 7.4): a FilterChip with the filter's name at rest, its value once chosen, and a
 * chevron; its name for a screen reader is "Filter: value". What it opens (a menu or a popover, `children`) loads
 * when the pointer comes near, it gets the focus or the page is idle, and takes the light pill's place — open, if
 * it was pressed (ui/lazy-swap, as Select; bundle budget). The catalog's filters (BrowseView) and a section's genres
 * over its billboard (SectionNav).
 */
export function FilterPill({
  text,
  selected,
  label,
  popup,
  onOpenChange,
  children,
}: {
  text: string;
  selected: boolean;
  /** "Genres: Drama, Comedy"; without it the text names the pill. */
  label?: string;
  popup: "menu" | "dialog";
  onOpenChange?: (open: boolean) => void;
  children: (m: Layers, trigger: ReactNode, opened: Opened) => ReactNode;
}) {
  const light = useRef<HTMLButtonElement>(null);
  const swap = useLazySwap(layers, light);
  const part = useStandIn(swap);
  const face = (
    <>
      <span className="max-w-56 truncate">{text}</span>
      <ChevronDown aria-hidden className={cn("-me-0.5 size-4 shrink-0", !selected && "text-text-2")} />
    </>
  );
  if (part.full)
    return (
      <PillLayer m={part.full} start={swap.start} onOpenChange={onOpenChange} render={children}>
        {(focus) => (
          <FilterChip ref={focus} selected={selected} {...NOT_TOGGLE} aria-label={label}>
            {face}
          </FilterChip>
        )}
      </PillLayer>
    );
  return (
    <FilterChip ref={light} selected={selected} {...NOT_TOGGLE} aria-label={label} aria-haspopup={popup} aria-expanded={false} {...part.handlers}>
      {face}
    </FilterChip>
  );
}

/** The loaded pill: opens at once if the light one was pressed, takes the focus if it had it. */
function PillLayer({
  m,
  start,
  onOpenChange,
  render,
  children,
}: {
  m: Layers;
  start: { open: boolean; focus: boolean };
  onOpenChange?: (open: boolean) => void;
  render: (m: Layers, trigger: ReactNode, opened: Opened) => ReactNode;
  children: (focus: (el: HTMLButtonElement | null) => void) => ReactNode;
}) {
  const [open, setOpenState] = useState(start.open);
  const setOpen = (o: boolean) => {
    setOpenState(o);
    onOpenChange?.(o);
  };
  const focus = (el: HTMLButtonElement | null) => {
    if (el && start.focus && !start.open) el.focus();
    start.focus = false;
  };
  return render(m, children(focus), { open, setOpen });
}
