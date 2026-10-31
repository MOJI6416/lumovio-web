"use client";

import { Check, Minus } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "./cn";
import { peerFocusRing } from "./styles";

// A native control under a drawn box (design-system 7.7): Space, labels, forms and screen readers work as usual.
// The off box is drawn in --text-3 — the box is the only sign of the control, so it needs 3:1 (8.9).
const HIT = "peer absolute inset-0 z-10 m-0 cursor-pointer appearance-none focus-visible:outline-none focus-visible:shadow-none disabled:cursor-not-allowed";
const MARK = "pointer-events-none col-start-1 row-start-1";

/** A labelled row: the label (and description) is the hit area, 44 px tall on a phone. */
function Row({ id, label, description, children, className }: { id: string; label: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 py-1 max-sm:min-h-11 max-sm:py-2", className)}>
      {children}
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-body text-text-1">
          {label}
        </label>
        {description && <p className="mt-0.5 text-body-s text-text-2">{description}</p>}
      </div>
    </div>
  );
}

/** The box: 20 px; alone (no visible label) its hit area grows to 44 on a phone. */
function Box({ alone, children }: { alone: boolean; children: ReactNode }) {
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", alone ? "size-5 max-sm:size-11" : "mt-0.5 size-5")}>
      {children}
    </span>
  );
}

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Some, not all, of a group are chosen: a dash instead of the tick. */
  indeterminate?: boolean;
  label: string;
  description?: ReactNode;
  /** Only the box, named by `label` for screen readers (bulk selection in a row). */
  hideLabel?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

/** Choosing several objects: bulk actions, the import (design-system 7.7). 20 px, --radius-xs. */
export function Checkbox({
  checked,
  onCheckedChange,
  indeterminate,
  label,
  description,
  hideLabel,
  disabled,
  id,
  name,
  className,
}: CheckboxProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  const box = (
    <Box alone={Boolean(hideLabel)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        aria-label={hideLabel ? label : undefined}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className={cn(HIT, "rounded-xs")}
      />
      <span
        aria-hidden
        className={cn(
          MARK,
          "size-5 rounded-xs border-2 border-text-3 transition-colors duration-fast ease-fast peer-checked:border-transparent peer-checked:bg-selected-bg peer-indeterminate:border-transparent peer-indeterminate:bg-selected-bg peer-disabled:opacity-40",
          peerFocusRing,
        )}
      />
      <Check
        aria-hidden
        strokeWidth={3}
        className={cn(MARK, "size-3.5 text-selected-fg opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0")}
      />
      <Minus aria-hidden strokeWidth={3} className={cn(MARK, "size-3.5 text-selected-fg opacity-0 peer-indeterminate:opacity-100")} />
    </Box>
  );

  if (hideLabel) return <span className={className}>{box}</span>;
  return (
    <Row id={inputId} label={label} description={description} className={className}>
      {box}
    </Row>
  );
}

export interface RadioOption<V extends string> {
  value: V;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}

/**
 * One of 2–6 options with descriptions (design-system 7.7): default quality, the import method. Native radios in a
 * fieldset: ↑/↓/←/→ move and choose, Tab leaves the group. 20 px circles.
 */
export function RadioGroup<V extends string>({
  legend,
  hideLegend,
  value,
  onValueChange,
  options,
  disabled,
  name,
  className,
}: {
  /** What is being chosen; visually hidden with `hideLegend`. */
  legend: string;
  hideLegend?: boolean;
  value: V | null;
  onValueChange: (v: V) => void;
  options: RadioOption<V>[];
  disabled?: boolean;
  name?: string;
  className?: string;
}) {
  const auto = useId();
  const group = name ?? auto;
  return (
    <fieldset disabled={disabled} className={cn("min-w-0", className)}>
      <legend className={cn("mb-2 text-body-s font-semibold text-text-1", hideLegend && "sr-only")}>{legend}</legend>
      <div className="flex flex-col gap-1">
        {options.map((o) => {
          const inputId = `${group}-${o.value}`;
          return (
            <Row key={o.value} id={inputId} label={o.label} description={o.description}>
              <Box alone={false}>
                <input
                  id={inputId}
                  type="radio"
                  name={group}
                  value={o.value}
                  checked={value === o.value}
                  disabled={o.disabled}
                  onChange={() => onValueChange(o.value)}
                  onKeyDown={(e) => {
                    // A TV remote's OK is Enter, which a native radio ignores: it chooses, like Space (C19). On a
                    // computer Enter inside a form keeps submitting it; outside one it chooses too.
                    if (e.key !== "Enter" || (e.currentTarget.form && !e.currentTarget.closest("[data-tv='1']"))) return;
                    e.preventDefault();
                    if (value !== o.value) onValueChange(o.value);
                  }}
                  className={cn(HIT, "rounded-full")}
                />
                <span
                  aria-hidden
                  className={cn(
                    MARK,
                    "size-5 rounded-full border-2 border-text-3 transition-colors duration-fast ease-fast peer-checked:border-transparent peer-checked:bg-selected-bg peer-disabled:opacity-40",
                    peerFocusRing,
                  )}
                />
                <span aria-hidden className={cn(MARK, "size-2 rounded-full bg-selected-fg opacity-0 peer-checked:opacity-100")} />
              </Box>
            </Row>
          );
        })}
      </div>
    </fieldset>
  );
}
