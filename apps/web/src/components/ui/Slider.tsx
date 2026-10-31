"use client";

import { Slider as S } from "radix-ui";
import { cn } from "./cn";

/**
 * A value on a scale (design-system 7.7): a 4 px --surface-3 track filled with --progress and a 16 px knob in the
 * text colour (white on dark and on the stage; black on light, where a white knob would vanish). `player` grows the
 * track to 6 px under the pointer (11.1). Arrows, Page Up/Down, Home and End move it; on a phone the whole 44 px
 * strip takes the touch.
 */
export function Slider({
  value,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  label,
  valueText,
  disabled,
  variant = "default",
  className,
}: {
  value: number;
  onValueChange: (v: number) => void;
  /** When the person lets go (seek once, not on every step). */
  onValueCommit?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Names the knob for screen readers ("Volume"). */
  label: string;
  /** How the value is read out ("1:02:10 of 2:35:00", "40 %"); the bare number otherwise. */
  valueText?: string;
  disabled?: boolean;
  variant?: "default" | "player";
  /** Placement only (width). */
  className?: string;
}) {
  return (
    <S.Root
      value={[value]}
      onValueChange={([v]) => onValueChange(v!)}
      onValueCommit={onValueCommit ? ([v]) => onValueCommit(v!) : undefined}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        "group relative flex h-5 w-full touch-none select-none items-center data-disabled:opacity-40 max-sm:h-11",
        className,
      )}
    >
      <S.Track
        className={cn(
          "relative h-1 grow overflow-hidden rounded-full bg-surface-3",
          variant === "player" && "transition-[height] duration-fast ease-fast group-hover:h-1.5",
        )}
      >
        <S.Range className="absolute h-full bg-progress" />
      </S.Track>
      <S.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="block size-4 cursor-grab rounded-full bg-text-1 transition-[scale] duration-fast ease-fast hover:scale-110 active:cursor-grabbing data-disabled:cursor-not-allowed"
      />
    </S.Root>
  );
}
