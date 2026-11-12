"use client";

import { ChevronDown } from "lucide-react";
import { useRef } from "react";
import { cn } from "./cn";
import { lazyControl, useLazySwap, useStandIn } from "./lazy-swap";
import { type SelectSize, selectTrigger } from "./Select";

export interface ComboboxOption<V extends string = string> {
  value: V;
  label: string;
  /** Other words that find it: a language's own name, a code. */
  keywords?: readonly string[];
  disabled?: boolean;
}

type One<V extends string> = { multiple?: false; value: V | null; onValueChange: (v: V) => void };
type Many<V extends string> = { multiple: true; value: V[]; onValueChange: (v: V[]) => void };

export type ComboboxProps<V extends string> = (One<V> | Many<V>) & {
  options: ComboboxOption<V>[];
  /** A hint while nothing is chosen, drawn as a placeholder (--text-3). */
  placeholder?: string;
  /**
   * What an empty choice means, drawn as a value: a filter's "Any" — the same look as Select's "Any" option.
   * Takes the placeholder's place.
   */
  emptyLabel?: string;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** As Select: `sm` 32 for a row of chips (a filter row), `md` 44, `lg` 48. */
  size?: SelectSize;
  /** Placement only. */
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

const full = lazyControl(() => import("./ComboboxPopover"));

/**
 * A choice from a long list with search: languages, regions, studios. Looks like Select; opens a
 * panel with a search field and the list. Typing filters, ↑/↓ move, Enter chooses, Escape closes and returns to the
 * field. `multiple` keeps the panel open and toggles each option (the chosen ones are listed in the field).
 *
 * The page gets a light field of the same look; the panel (./ComboboxPopover, Radix Popover) loads when the pointer
 * comes to it or it gets the focus, and replaces it — open, if it was already pressed (./lazy-swap; bundle budget).
 */
export function Combobox<V extends string>(props: ComboboxProps<V>) {
  const light = useRef<HTMLButtonElement>(null);
  const swap = useLazySwap(full, light);
  const part = useStandIn(swap);
  const m = part.full;
  if (m) return <m.ComboboxPopover {...props} defaultOpen={swap.start.open} autoFocus={swap.start.focus} />;
  const { options, placeholder, emptyLabel, id, invalid, disabled, size = "md", className } = props;
  const chosen = new Set<string>(props.multiple ? props.value : props.value != null ? [props.value] : []);
  const shownText = options
    .filter((o) => chosen.has(o.value))
    .map((o) => o.label)
    .join(", ");
  return (
    // A combobox whose list opens in a panel with a search field (WAI-ARIA combobox with a dialog popup): the same role as
    // Select's field, so a form of both reads alike; ↓/↑ open it as they open a Select.
    <button
      ref={light}
      type="button"
      role="combobox"
      aria-haspopup="dialog"
      aria-expanded={false}
      id={id}
      aria-label={props["aria-label"]}
      aria-describedby={props["aria-describedby"]}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      data-placeholder={shownText || emptyLabel ? undefined : ""}
      className={cn(selectTrigger(size), className)}
      {...part.handlers}
    >
      <span className="min-w-0 truncate">{shownText || emptyLabel || placeholder}</span>
      <ChevronDown aria-hidden className={cn("shrink-0 text-text-2", size === "sm" ? "size-4" : "size-5")} />
    </button>
  );
}
