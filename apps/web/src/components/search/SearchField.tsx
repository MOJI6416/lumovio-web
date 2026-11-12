"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { IconButton } from "@/components/ui/IconButton";

const SIZE = {
  /** The header's (32, as the avatar beside it): the icon where the round search button has it (16, centred in the
   * first 32), so the button and the field grow into each other without a jump. */
  md: { box: "h-8 ps-1.75 pe-0.5", icon: "size-4", text: "text-body" },
  /** The search page's: 48 on a phone, 56 from `md`. */
  lg: { box: "h-12 ps-4 pe-1.5 md:h-14 md:ps-5 md:pe-2", icon: "size-5 md:size-6", text: "text-body-l" },
} as const;

/**
 * The search field: a pill on --surface-2 with the search icon, the text and, while there
 * is text, the clear button; focus is the field's --focus border and halo around the whole pill. The header's and the
 * search page's; `trailing` goes after the clear button.
 */
export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "value" | "onChange" | "type"> & {
    value: string;
    onValueChange: (value: string) => void;
    /** The clear button: empties the field by default. */
    onClear?: () => void;
    size?: keyof typeof SIZE;
    trailing?: ReactNode;
    className?: string;
    /** The pill's own style (the header animates its width). */
    boxStyle?: CSSProperties;
  }
>(function SearchField({ value, onValueChange, onClear, size = "lg", trailing, className, boxStyle, ...rest }, ref) {
  const t = useTranslations("ui");
  const s = SIZE[size];
  return (
    <div
      style={boxStyle}
      className={cn(
        "flex w-full items-center gap-2 rounded-full border border-line-2 bg-surface-2 transition-[border-color,box-shadow] duration-fast ease-fast",
        "focus-within:border-focus focus-within:ring-3 focus-within:ring-accent-soft",
        s.box,
        className,
      )}
    >
      <Search aria-hidden className={cn("shrink-0 text-text-2", s.icon)} />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className={cn(
          "h-full min-w-0 flex-1 appearance-none border-0 bg-transparent text-text-1 shadow-none outline-none placeholder:text-text-3 focus-visible:shadow-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          s.text,
        )}
        {...rest}
      />
      {value && <IconButton icon={X} label={t("clear")} size="sm" onClick={onClear ?? (() => onValueChange(""))} />}
      {trailing}
    </div>
  );
});
