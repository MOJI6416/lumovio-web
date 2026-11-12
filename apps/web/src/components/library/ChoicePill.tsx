"use client";

import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { FilterChip } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { lazyControl, useLazySwap, useStandIn } from "@/components/ui/lazy-swap";

/** The menu a pill opens, loaded when someone reaches for a pill or the page is idle (ui/lazy-swap, bundle budget). */
const layers = lazyControl(() => import("@/components/ui/Menu"));
/** A menu button, not a toggle: FilterChip's `aria-pressed` is taken off. */
const NOT_TOGGLE = { "aria-pressed": undefined };

export interface PillOption<V extends string> {
  value: V;
  label: string;
}

/**
 * A filter pill with a list (as the catalog's): at rest it names the filter ("Length ⌄"), once
 * chosen it shows the value as selected ("Up to 1 h 30 min ⌄"); its menu starts with `any` and a separator. With
 * `sort` it is the sort pill: always its value, never "selected" — a sort is not a filter. Its name for a screen reader
 * is "Filter: value"; it is a menu button, not a toggle (no `aria-pressed`).
 */
export function ChoicePill<V extends string>({
  name,
  value,
  options,
  onChange,
  any,
  sort = false,
}: {
  /** The filter's name: the pill's words at rest and the menu's name. */
  name: string;
  value: V | null;
  options: PillOption<V>[];
  onChange: (value: V | null) => void;
  /** The first item, which takes the filter off ("Any"); none for a sort. */
  any?: string;
  sort?: boolean;
}) {
  const light = useRef<HTMLButtonElement>(null);
  const swap = useLazySwap(layers, light);
  const part = useStandIn(swap);
  const chosen = options.find((o) => o.value === value)?.label;
  const selected = !sort && Boolean(chosen);
  const label = chosen ? `${name}: ${chosen}` : undefined;
  const face = (
    <>
      <span className="max-w-56 truncate">{chosen ?? name}</span>
      <ChevronDown aria-hidden className={cn("-me-0.5 size-4 shrink-0", !selected && "text-text-2")} />
    </>
  );
  if (part.full) {
    const m = part.full;
    return (
      <Loaded start={swap.start}>
        {(open, setOpen, focus) => (
          <m.Menu
            label={name}
            align="start"
            open={open}
            onOpenChange={setOpen}
            trigger={
              <FilterChip ref={focus} selected={selected} {...NOT_TOGGLE} aria-label={label}>
                {face}
              </FilterChip>
            }
          >
            {any && (
              <>
                <m.MenuCheckboxItem checked={!chosen} onCheckedChange={() => onChange(null)}>
                  {any}
                </m.MenuCheckboxItem>
                <m.MenuSeparator />
              </>
            )}
            {options.map((o) => (
              <m.MenuCheckboxItem key={o.value} checked={o.value === value} onCheckedChange={() => onChange(o.value)}>
                {o.label}
              </m.MenuCheckboxItem>
            ))}
          </m.Menu>
        )}
      </Loaded>
    );
  }
  return (
    <FilterChip
      ref={light}
      selected={selected}
      {...NOT_TOGGLE}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={false}
      {...part.handlers}
    >
      {face}
    </FilterChip>
  );
}

/** The loaded pill: open at once if the light one was pressed, focused if it had the focus. */
function Loaded({
  start,
  children,
}: {
  start: { open: boolean; focus: boolean };
  children: (open: boolean, setOpen: (open: boolean) => void, focus: (el: HTMLButtonElement | null) => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(start.open);
  const focus = (el: HTMLButtonElement | null) => {
    if (el && start.focus && !start.open) el.focus();
    start.focus = false;
  };
  return <>{children(open, setOpen, focus)}</>;
}
