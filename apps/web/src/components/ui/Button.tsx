import { Loader2, type LucideIcon } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "./cn";

/** design-system 7.1. One `primary` per area; `danger` only confirms a deletion in a dialog. */
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "danger-tertiary";
export type ButtonSize = "sm" | "md" | "lg";
/**
 * `stacked` (10.1): below md the icon (24) stands over a 12 px caption, without the fill and border — one of a row of
 * labelled actions sharing the width (the title's Watchlist · Rate · More); from md it is the plain button.
 */
export type ButtonLayout = "inline" | "stacked";

// Roles only, so the colours follow the theme and `.stage` (3.5): primary is white on dark and black on light.
// `danger` carries dark text in the dark theme: white on the light red is 2.8:1 (audit X-23).
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-text-1 text-bg hover:not-disabled:bg-text-1/85",
  secondary: "border border-line-2 bg-surface-2 text-text-1 hover:not-disabled:bg-surface-3",
  tertiary: "text-text-1 hover:not-disabled:bg-surface-2",
  danger: "bg-danger text-bg hover:not-disabled:bg-danger/85",
  "danger-tertiary": "text-danger hover:not-disabled:bg-danger-soft",
};

// On a phone every button is at least 44 px (5.6); `sm` exists for dense desktop panels only. On a TV every size is
// lg (48 rem-px, 66 at the TV's scale: a remote's target is 64, text at least body, 10.3) — callers don't pass it.
const TV_LG = "in-data-[tv=1]:h-12 in-data-[tv=1]:min-w-12 in-data-[tv=1]:px-6 in-data-[tv=1]:text-body";
const SIZES: Record<ButtonSize, string> = {
  sm: `h-8 px-3 text-body-s max-sm:h-11 max-sm:min-w-11 [&_svg:not([class*=size-])]:size-4 ${TV_LG}`,
  md: `h-10 px-4 text-body max-sm:h-11 max-sm:min-w-11 [&_svg:not([class*=size-])]:size-5 ${TV_LG}`,
  lg: "h-12 min-w-12 px-6 text-body [&_svg:not([class*=size-])]:size-5",
};

export const ICON_SIZE: Record<ButtonSize, string> = { sm: "size-4 in-data-[tv=1]:size-5", md: "size-5", lg: "size-5" };

const LAYOUTS: Record<ButtonLayout, string> = {
  inline: "",
  stacked:
    "max-md:h-auto max-md:min-h-14 max-md:min-w-0 max-md:flex-1 max-md:basis-0 max-md:flex-col max-md:gap-1 max-md:whitespace-normal max-md:border-transparent max-md:bg-transparent max-md:px-1 max-md:py-1.5 max-md:text-caption max-md:leading-tight max-md:[&_svg]:size-6",
};

const BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,opacity,scale] duration-fast ease-fast active:not-disabled:scale-98 disabled:opacity-40 [&_svg]:shrink-0";

/**
 * Classes of a button, for links that look like one (`<Link className={buttonClass("secondary")}>`). `extra` is for
 * placement only (margins, width, `grow`); colour and size come from the variant and size.
 */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
  layout: ButtonLayout = "inline",
) {
  return cn(BASE, VARIANTS[variant], SIZES[size], LAYOUTS[layout], extra);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** `stacked`: icon over a caption below md (a row of labelled actions on a phone). */
  layout?: ButtonLayout;
  /** Leading icon (design-system 6.4), sized by the button. */
  icon?: LucideIcon;
  /** Busy: the spinner takes the icon's place (or covers the label when there is no icon); the width stays. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", layout = "inline", icon: Icon, loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  const spinner = <Loader2 aria-hidden className={cn(ICON_SIZE[size], "animate-spin")} />;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      // Busy is not "unavailable": it keeps its full colour.
      className={buttonClass(variant, size, cn(loading && !disabled && "disabled:opacity-100", className), layout)}
      {...rest}
    >
      {Icon && (loading ? spinner : <Icon aria-hidden className={ICON_SIZE[size]} />)}
      {loading && !Icon ? (
        <>
          <span className="inline-flex items-center gap-2 opacity-0">{children}</span>
          <span className="absolute inset-0 grid place-items-center">{spinner}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});
