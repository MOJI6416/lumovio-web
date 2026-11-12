"use client";

import { useTranslations } from "next-intl";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

const CLAMP = { 3: "line-clamp-3", 4: "line-clamp-4", 6: "line-clamp-6" } as const;

/** Lines the text takes at about `perLine` characters a line, each paragraph starting a new one. */
const linesAt = (text: string, perLine: number) => text.split("\n").reduce((n, p) => n + Math.max(1, Math.ceil(p.length / perLine)), 0);

/**
 * A text shown in a few lines with "More" (an overview, a person's biography): the
 * button appears only when the text is longer than that, opens it in place and closes it again ("Show less").
 * `label` names what opens ("the whole overview"); `className` carries the type style; the measure is 72 characters.
 */
export function ExpandableText({ text, lines = 3, label, className, lang }: { text: string; lines?: keyof typeof CLAMP; label: string; className?: string; lang?: string }) {
  const t = useTranslations("titlePage");
  const tc = useTranslations("common");
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  // null until measured: the server's HTML and hydration go by the text's length (below).
  const [long, setLong] = useState<boolean | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setLong(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Until it is measured, "More" is there when the length says the text will be cut — only on a phone when only a phone's
  // shorter lines cut it — so it doesn't appear under the text a moment after the page shows (CLS).
  const guess = long === null ? (linesAt(text, 72) > lines ? "all" : linesAt(text, 38) > lines ? "phone" : null) : null;
  return (
    <div>
      <p ref={ref} id={id} lang={lang} className={cn("max-w-measure whitespace-pre-line", !open && CLAMP[lines], className)}>
        {text}
      </p>
      {(long || open || guess) && (
        <Button
          variant="tertiary"
          size="sm"
          aria-expanded={open}
          aria-controls={id}
          // "More" is also the hero's menu: the name says what this one opens (and starts with what it shows).
          aria-label={open ? undefined : `${t("readMore")}: ${label}`}
          onClick={() => setOpen(!open)}
          className={cn("mt-1 -ms-3", guess === "phone" && "sm:hidden")}
        >
          {open ? tc("showLess") : t("readMore")}
        </Button>
      )}
    </div>
  );
}
