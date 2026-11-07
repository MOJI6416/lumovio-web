import { Loader2, type LucideIcon } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { type ButtonLayout, type ButtonSize, type ButtonVariant, buttonClass, ICON_SIZE } from "./button-class";
import { cn } from "./cn";

export { type ButtonLayout, type ButtonSize, type ButtonVariant, buttonClass, ICON_SIZE } from "./button-class";

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
