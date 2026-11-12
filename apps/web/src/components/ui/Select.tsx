"use client";

import { ChevronDown } from "lucide-react";
import { useRef } from "react";
import { cn } from "./cn";
import { lazyControl, useLazySwap, useStandIn } from "./lazy-swap";
import { type FieldSize, fieldBox, fieldFocusVisible } from "./styles";

export interface SelectOption<V extends string = string> {
  /** Not empty (Radix keeps "" for "nothing chosen"). */
  value: V;
  label: string;
  disabled?: boolean;
}

/**
 * `md` 44 and `lg` 48 as every field; `sm` 32 with 13/600 text — the height of FilterChip and Button `sm` — for
 * a select in a row of chips or small buttons (library filters, a list's header). On a phone `sm` is 44, as Button
 * `sm` there; on a TV every size is lg with body text, and so are the list's items.
 */
export type SelectSize = FieldSize | "sm";

const TV_LG = "in-data-[tv=1]:h-12 in-data-[tv=1]:text-body";
const TRIGGER_SIZE: Record<SelectSize, string> = {
  sm: `h-8 gap-1.5 px-3 text-body-s font-semibold max-sm:h-11 ${TV_LG}`,
  md: `h-11 gap-2 px-3 ${TV_LG}`,
  lg: "h-12 gap-2 px-3",
};

/** The trigger and list look shared with Combobox. */
export const selectTrigger = (size: SelectSize = "md") =>
  cn(
    fieldBox,
    fieldFocusVisible,
    TRIGGER_SIZE[size],
    "flex select-none items-center justify-between text-start data-[state=open]:border-focus data-placeholder:text-text-3",
  );
export const listPanel =
  "z-popover overflow-hidden rounded-md border border-line bg-surface-2 text-text-1 shadow-float";
export const listItem =
  "relative flex h-10 cursor-pointer select-none items-center gap-2 rounded-xs px-3 text-body text-text-1 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-40 max-sm:h-11 in-data-[tv=1]:h-12";

export interface SelectProps<V extends string> {
  value: V | undefined;
  onValueChange: (v: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  size?: SelectSize;
  /** Placement only (width, margins). */
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const full = lazyControl(() => import("./SelectRadix"));

/**
 * A choice from a short list, drawn as a field with a chevron; up to ~10 options, longer lists
 * (languages, regions, studios) are a Combobox. Label it with Field (pass Field's id and describedBy) or
 * `aria-label`. The list opens below the field; ↑/↓, typing the first letters, Enter and Escape work as in a
 * native select.
 *
 * The page gets a light field of the same look; Radix Select (./SelectRadix) loads when the pointer comes to it or it
 * gets the focus, and replaces it — open, if it was already pressed (./lazy-swap; bundle budget).
 */
export function Select<V extends string>(props: SelectProps<V>) {
  const light = useRef<HTMLButtonElement>(null);
  const swap = useLazySwap(full, light);
  const part = useStandIn(swap);
  const m = part.full;
  if (m) return <m.SelectRadix {...props} defaultOpen={swap.start.open} autoFocus={swap.start.focus} />;
  const { value, options, placeholder, id, invalid, disabled, size = "md", className } = props;
  const chosen = options.find((o) => o.value === value);
  return (
    <button
      ref={light}
      type="button"
      role="combobox"
      aria-expanded={false}
      aria-autocomplete="none"
      id={id}
      aria-label={props["aria-label"]}
      aria-describedby={props["aria-describedby"]}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      data-placeholder={chosen ? undefined : ""}
      className={cn(selectTrigger(size), className)}
      {...part.handlers}
    >
      <span className="min-w-0 truncate">{chosen?.label ?? placeholder}</span>
      <ChevronDown aria-hidden className={cn("shrink-0 text-text-2", size === "sm" ? "size-4" : "size-5")} />
    </button>
  );
}
