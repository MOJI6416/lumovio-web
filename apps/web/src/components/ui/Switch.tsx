"use client";

import { type ReactNode, useId } from "react";
import { cn } from "./cn";
import { peerFocusRing } from "./styles";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label: string;
  description?: ReactNode;
  /** Only the control, named by `label` for screen readers (the row around it says what it is). */
  hideLabel?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * A switch, 44 × 24 (design-system 7.7): for a setting that applies at once — no Save button after it. With a
 * visible label it is a row: label and description at the start, the switch at the end. A native checkbox with the
 * switch role underneath, so Space, labels and forms work as usual; on a phone the hit area is 44 px tall.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  hideLabel,
  disabled,
  id,
  className,
}: SwitchProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const about = description;
  const aboutId = about ? `${inputId}-about` : undefined;

  const control = (
    <span className={cn("relative inline-grid h-6 w-11 shrink-0 place-items-center max-sm:h-11", hideLabel && className)}>
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={hideLabel ? label : undefined}
        aria-describedby={aboutId}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        // size-full too: Safari keeps an input's own 16 px size under inset-0, so on an iPhone the switch missed taps.
        className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-full focus-visible:outline-none focus-visible:shadow-none disabled:cursor-not-allowed"
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none col-start-1 row-start-1 h-6 w-11 rounded-full border border-line-2 bg-surface-3 transition-colors duration-fast ease-fast peer-checked:border-transparent peer-checked:bg-switch-on peer-disabled:opacity-40",
          peerFocusRing,
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute start-0.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-text-2 transition-[inset-inline-start,background-color] duration-base ease-base peer-checked:start-5.5 peer-checked:bg-switch-knob-on peer-disabled:opacity-40"
      />
    </span>
  );

  if (hideLabel) return control;
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2", className)}>
      <div className="min-w-0">
        <label htmlFor={inputId} className="cursor-pointer text-body font-semibold text-text-1">
          {label}
        </label>
        {about && (
          <p id={aboutId} className="mt-1 text-body-s text-text-2">
            {about}
          </p>
        )}
      </div>
      {control}
    </div>
  );
}
