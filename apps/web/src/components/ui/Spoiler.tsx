"use client";

import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useRef } from "react";
import { cn } from "./cn";

const PILL = "pointer-events-none inline-flex h-7 items-center gap-2 rounded-full px-3 text-caption whitespace-nowrap text-text-1 transition-colors duration-fast ease-fast in-data-[tv=1]:text-body";

/**
 * What could give the plot away, hidden until the person presses it. `image`: the caller
 * blurs only the image (`Artwork blurred`), so its badge, mark and progress stay sharp; `text`: the text is blurred
 * here, keeps its height (at least 44 on a phone, 32 on a PC) and can't be selected. Over it, one button the size of
 * the area with "Show" in a pill — the button's name says what it shows ("Show the still: episode 5"). While hidden the
 * content is inert and hidden from screen readers: a link under a still can't be pressed or focused, so the first press
 * shows and the second (on the shown still) plays. Shown at once, the blur fading in 200 ms; focus moves to what was
 * shown (its link, else the block), not to the page. Hiding again is the area's "Hide spoilers", not one by one.
 */
export function Spoiler({
  hidden,
  onReveal,
  label,
  variant = "text",
  children,
  className,
}: {
  hidden: boolean;
  onReveal: () => void;
  /** The button's name: what pressing shows. */
  label: string;
  variant?: "image" | "text";
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("spoilers");
  const box = useRef<HTMLDivElement>(null);
  const reveal = () => {
    const focused = box.current?.contains(document.activeElement);
    onReveal();
    if (!focused) return;
    // The button is gone once shown: focus stays here, on the still's link or the block itself.
    requestAnimationFrame(() => (box.current?.querySelector<HTMLElement>("a[href],button") ?? box.current)?.focus({ preventScroll: true }));
  };
  return (
    <div ref={box} tabIndex={-1} className={cn("relative outline-none", className)}>
      <div
        aria-hidden={hidden || undefined}
        inert={hidden}
        className={cn(
          variant === "text" && "transition-[filter] duration-base ease-base motion-reduce:transition-none",
          variant === "text" && hidden && "min-h-11 select-none blur-sm sm:min-h-8",
        )}
      >
        {children}
      </div>
      {hidden && (
        <button
          type="button"
          aria-label={label}
          onClick={reveal}
          className={cn(
            "group/spoiler absolute inset-0 grid cursor-pointer items-center",
            // Over a still the pill is centred; over text it starts where the text does.
            variant === "image" ? "justify-items-center rounded-sm" : "justify-items-start rounded-xs",
          )}
        >
          <span
            aria-hidden
            className={cn(
              PILL,
              variant === "image"
                ? "stage bg-stage/60 backdrop-blur-md group-hover/spoiler:bg-stage/80 in-data-[tv=1]:backdrop-blur-none"
                : "border border-line-2 bg-surface-2 group-hover/spoiler:bg-surface-3",
            )}
          >
            <Eye className="size-4 shrink-0" />
            {t("show")}
          </span>
        </button>
      )}
    </div>
  );
}
