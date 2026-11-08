"use client";

import { ChevronRight, type LucideIcon, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import { Link as IntlLink } from "@/i18n/navigation";
import { cn } from "./cn";
import { groupFocusRing } from "./styles";

export interface FilterChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** On = the condition is applied (`aria-pressed`). */
  selected: boolean;
  children: ReactNode;
  /** Matches with this condition, shown as a "· 5" suffix. */
  count?: number;
  icon?: LucideIcon;
}

/**
 * A filter chip (design-system 7.4): turns one condition on or off. Not a tab and not a navigation link (7.5).
 * The button is the hit area (at least 44 × 44 on a phone, 5.6 — a short label such as «Усі» is narrower than that);
 * the pill inside is 32 px (36 on a phone).
 */
export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  { selected, children, count, icon: Icon, className, type = "button", ...rest },
  ref,
) {
  const format = useFormatter();
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        "group inline-flex shrink-0 select-none items-center justify-center focus-visible:outline-none focus-visible:shadow-none disabled:opacity-40 max-sm:min-h-11 max-sm:min-w-11",
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          "inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-body-s font-semibold transition-colors duration-base ease-base max-sm:h-9",
          groupFocusRing,
          selected
            ? "border-transparent bg-selected-bg text-selected-fg"
            : "border-line-2 text-text-1 group-hover:group-enabled:bg-surface-2",
        )}
      >
        {Icon && <Icon aria-hidden className="me-1 size-4 shrink-0" />}
        {children}
        {count != null && <span className={cn("tabular-nums", !selected && "text-text-2")}>· {format.number(count)}</span>}
      </span>
    </button>
  );
});

/**
 * A link of the pill family (design-system 7.4 "LinkChip"): where a row of pills also leads to a page — a catalog
 * section's "All films ›" beside its genres pill. FilterChip's look at rest and a chevron that says it goes somewhere;
 * a link, never `aria-pressed`. 44 tall on a phone, as FilterChip.
 */
export function LinkChip({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <IntlLink
      href={href}
      className={cn("group inline-flex shrink-0 select-none items-center justify-center focus-visible:outline-none focus-visible:shadow-none max-sm:min-h-11", className)}
    >
      <span
        className={cn(
          "inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-line-2 ps-3 pe-2 text-body-s font-semibold text-text-1 transition-colors duration-base ease-base group-hover:bg-surface-2 max-sm:h-9",
          groupFocusRing,
        )}
      >
        {children}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-text-2" />
      </span>
    </IntlLink>
  );
}

export interface InputChipProps {
  /** What the chip stands for; also names its remove button ("Remove «Horror»"). */
  label: string;
  onRemove: () => void;
  disabled?: boolean;
  className?: string;
}

/** A condition or a choice that can be taken away with its × (design-system 7.4): AI search terms, studios. */
export function InputChip({ label, onRemove, disabled, className }: InputChipProps) {
  const t = useTranslations("ui");
  return (
    <span
      className={cn(
        "inline-flex h-8 max-w-full shrink-0 items-center gap-1 rounded-full bg-surface-2 ps-3 pe-0 text-body-s font-semibold text-text-1 max-sm:h-9",
        disabled && "opacity-40",
        className,
      )}
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        aria-label={t("removeItem", { item: label })}
        disabled={disabled}
        onClick={onRemove}
        // 32 px box in the 32 px pill, 44 on a phone (its extra height overlaps the pill's edge, not the layout).
        className="group inline-grid size-8 shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:shadow-none max-sm:-my-1 max-sm:size-11"
      >
        <span
          aria-hidden
          className={cn(
            "grid size-6 place-items-center rounded-full text-text-2 transition-colors duration-fast ease-fast group-hover:group-enabled:bg-surface-3 group-hover:group-enabled:text-text-1",
            groupFocusRing,
          )}
        >
          <X className="size-4" />
        </span>
      </button>
    </span>
  );
}
