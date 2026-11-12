"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";

// The 1–10 dialog of the title page, loaded when it is opened (bundle budget).
const RateTitle = lazy(() => import("./RateTitle").then((m) => ({ default: m.RateTitle })));

/**
 * The profile's own rating on a poster in "Ratings": "★ 9" on the art's top-end corner, on
 * the stage's veil as the art's badge, and the control that changes it — the same 1–10 dialog (a sheet on a phone) as
 * the title's own "★ 8", with "Remove rating" in it. Seen on every screen; a 44 px target on a phone.
 */
export function RatingBadge({ title, value, onSaved }: { title: TitleSummary; value: number; onSaved: (value: number | null) => void }) {
  const t = useTranslations("titlePage");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button /* ui-lint-ignore raw-button: the rating on a poster that opens its 1–10 dialog, a badge, not a Button */
        type="button"
        aria-label={t("ratedLabel", { value })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="group/rate grid place-items-center rounded-full focus-visible:outline-none max-sm:min-h-11 max-sm:min-w-11"
      >
        <span className="stage inline-flex h-7 items-center gap-1 rounded-full bg-stage/60 px-2.5 text-body-s font-semibold tabular-nums text-text-1 backdrop-blur-md transition-colors duration-fast ease-fast group-hover/rate:bg-stage/80 group-focus-visible/rate:outline-(length:--focus-width) group-focus-visible/rate:outline-offset-2 group-focus-visible/rate:outline-focus">
          <Star aria-hidden className="size-3.5 fill-current" />
          {value}
        </span>
      </button>
      {open && (
        <Suspense>
          <RateTitle title={title} open={open} onOpenChange={setOpen} onSaved={onSaved} />
        </Suspense>
      )}
    </>
  );
}
