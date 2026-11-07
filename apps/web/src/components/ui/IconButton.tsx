"use client";

import type { LucideIcon } from "lucide-react";
import { type ButtonHTMLAttributes, type ComponentType, forwardRef } from "react";
import { cn } from "./cn";
import { groupFocusRing } from "./styles";
import { Tooltip } from "./Tooltip";

/** `primary` — the one main control of a remote (play/pause of a viewing on the TV, design-system 7.2, 8.18). */
export type IconButtonVariant = "ghost" | "secondary" | "stage" | "primary";
/** `xl` 64 — that main control, beside `lg` 48 circles. */
export type IconButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost: "text-text-1 group-hover:group-enabled:bg-surface-2",
  primary: "bg-text-1 text-bg group-hover:group-enabled:bg-text-1/85",
  secondary: "border border-line-2 bg-surface-2 text-text-1 group-hover:group-enabled:bg-surface-3",
  // Over artwork: the stage's values in either theme, a dark veil and blur (none on TV, 10.3).
  stage:
    "stage bg-stage/45 text-text-1 backdrop-blur-md group-hover:group-enabled:bg-stage/65 group-focus-visible:shadow-(--focus-halo) in-data-[tv=1]:backdrop-blur-none",
};

// Pressed (a toggle that is on): the selection colours, and on a stage a white fill (dark icon) over the art.
const PRESSED: Record<IconButtonVariant, string> = {
  ghost: "bg-selected-bg text-selected-fg group-hover:group-enabled:bg-selected-bg/85",
  primary: "bg-selected-bg text-selected-fg group-hover:group-enabled:bg-selected-bg/85",
  secondary: "border border-transparent bg-selected-bg text-selected-fg group-hover:group-enabled:bg-selected-bg/85",
  // `.stage` sets the text colour itself (globals.css), so the dark icon needs `!` (as Button's on-art primary).
  stage: "stage bg-text-1 text-bg! group-hover:group-enabled:bg-text-1/85 group-focus-visible:shadow-(--focus-halo)",
};

// The button is the hit area: at least 44 px on a phone (5.6) around the visible circle. On a TV every size is lg
// (66 px at the TV's scale; a remote's target is 64, 5.6, 10.3) — callers don't pass it.
const TV = "in-data-[tv=1]:size-12";
const BOX: Record<IconButtonSize, string> = { sm: `size-8 max-sm:size-11 ${TV}`, md: `size-10 max-sm:size-11 ${TV}`, lg: "size-12", xl: "size-16" };
const CIRCLE: Record<IconButtonSize, string> = { sm: `size-8 ${TV}`, md: `size-10 ${TV}`, lg: "size-12", xl: "size-16" };
const ICON: Record<IconButtonSize, string> = { sm: "size-4 in-data-[tv=1]:size-6", md: "size-5 in-data-[tv=1]:size-6", lg: "size-6", xl: "size-7" };

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  /** A Lucide icon, or a mark drawn the same way (ui/BrandMotion's ActionMark after a confirmed toggle). */
  icon: LucideIcon | ComponentType<{ className?: string }>;
  /** The accessible name and the hint; required — an icon alone names nothing (6.4, 8.9). */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /**
   * A toggle ("Watched", "Like"): its state as `aria-pressed`, drawn filled while on. The label names the action
   * and stays the same in both states; leave it out for a button that only acts.
   */
  pressed?: boolean;
}

/**
 * A round icon-only button (design-system 7.2) — only for the universal icons of 6.4: close, back, search, more,
 * scroll arrows, player controls, clear a field. Everything else gets a labelled Button.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = "ghost", size = "md", pressed, className, type = "button", ...rest },
  ref,
) {
  return (
    // The hint is ui/Tooltip (7.8): after 400 ms of hover or on keyboard focus only (not after a click, not when a
    // dialog opens with this button focused); the name stays in aria-label.
    <Tooltip label={label}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "group relative inline-grid shrink-0 select-none place-items-center rounded-full focus-visible:outline-none focus-visible:shadow-none disabled:opacity-40",
          BOX[size],
          className,
        )}
        {...rest}
      >
        <span
          aria-hidden
          className={cn(
            "grid place-items-center rounded-full transition-[background-color,scale] duration-fast ease-fast group-active:group-enabled:scale-95",
            groupFocusRing,
            CIRCLE[size],
            pressed ? PRESSED[variant] : VARIANTS[variant],
          )}
        >
          <Icon className={ICON[size]} />
        </span>
      </button>
    </Tooltip>
  );
});
