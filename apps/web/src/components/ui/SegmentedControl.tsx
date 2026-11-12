"use client";

import { type KeyboardEvent, useRef } from "react";
import { cn } from "./cn";
import { groupFocusRing } from "./styles";
import { rovingIndex } from "./keyboard";

export interface Segment<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

/**
 * A mode switch inside a component, 2–4 short options: "Titles / Describe", years in the
 * statistics. A radio group: one tab stop, arrows move and choose at once. Not for page sections (Tabs) and not for
 * filters (FilterChip). All segments are as wide as the widest, so nothing shifts when the choice changes; where that
 * doesn't fit (a phone, a long language), each keeps the width of its own label instead — labels are never cut or
 * wrapped, the layout changes. The control is never wider than its container; a row that holds it next to
 * other things wraps.
 *
 * Track 36 px (40 on a phone); on a phone each segment's hit area is 44 px and overlaps the track's edge.
 */
export function SegmentedControl<V extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: {
  options: Segment<V>[];
  value: V;
  onValueChange: (v: V) => void;
  /** Names the group for screen readers. */
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((o) => o.value === value);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = refs.current.findIndex((b) => b === document.activeElement);
    if (from < 0) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const to = rovingIndex(from, e.key, options.length, { rtl, upDown: true, disabled: (i) => !!options[i]?.disabled });
    if (to == null) return;
    e.preventDefault();
    refs.current[to]?.focus();
    onValueChange(options[to]!.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-grid h-9 max-w-full auto-cols-[minmax(max-content,1fr)] grid-flow-col items-center rounded-full bg-surface-2 p-0.5 max-sm:h-10",
        className,
      )}
    >
      {options.map((o, i) => {
        const on = i === selected;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            // The tab stop is the chosen segment (or the first, while nothing is chosen).
            tabIndex={on || (selected < 0 && i === 0) ? 0 : -1}
            onClick={() => onValueChange(o.value)}
            className="group flex h-8 min-w-0 select-none items-center justify-center focus-visible:outline-none focus-visible:shadow-none disabled:opacity-40 max-sm:-my-1 max-sm:h-11"
          >
            <span
              className={cn(
                "flex h-full w-full items-center justify-center whitespace-nowrap rounded-full px-3.5 text-body-s font-semibold transition-colors duration-base ease-base max-sm:h-9",
                groupFocusRing,
                // A pill like the header's sections and the buttons: a light fill on dark, a white
                // segment with a shadow on light.
                on
                  ? "bg-text-1/14 text-text-1 in-data-[theme=light]:bg-surface-1 in-data-[theme=light]:shadow-float"
                  : "text-text-2 group-hover:group-enabled:text-text-1",
              )}
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
