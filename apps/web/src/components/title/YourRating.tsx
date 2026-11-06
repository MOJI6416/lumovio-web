"use client";

import { Star } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { usePersonalActions } from "@/components/media/usePersonalActions";
import { GuestGate } from "@/components/shell/GuestGate";
import { ActionMark } from "@/components/ui/BrandMotion";
import { Button } from "@/components/ui/Button";
import type { TitleCore } from "./core";
import { setRateOpen, useRateOpen } from "./rate-open";

const TitleRate = dynamic(() => import("./TitleRate").then((m) => m.TitleRate), { ssr: false });

/**
 * The profile's own rating, beside the title's ratings in the hero (design-system 7.14, 8.1; 2026-11-06, as IMDb and
 * Letterboxd put "your rating" by the average): "★ Rate", or the filled star and the number once rated — seen without
 * opening a menu. A press opens the 1–10 dialog (./TitleRate, a sheet on a phone) with "Remove rating"; a guest gets the
 * sign-in sheet, and the dialog after signing in. The star fills and clicks when the server has saved a new rating
 * (ActionMark, 6.3.1); one given before is a still filled star.
 */
export function YourRating({ title: d }: { title: TitleCore }) {
  const t = useTranslations("titlePage");
  const actions = usePersonalActions(d);
  const open = useRateOpen(d.id);
  const [saved, setSaved] = useState<number | null>(null);
  const rating = actions.state?.rating ?? null;
  // A profile's rating isn't known until its library state comes: held in place, unseen, until then.
  const waiting = actions.signedIn && actions.state === undefined;
  const press = () => (actions.signedIn ? setRateOpen(d.id) : actions.requireAuth("rate", "rate"));
  return (
    <>
      <Button
        variant="tertiary"
        size="sm"
        aria-haspopup="dialog"
        aria-label={rating ? t("ratedLabel", { value: rating }) : undefined}
        aria-hidden={waiting || undefined}
        tabIndex={waiting ? -1 : undefined}
        onClick={press}
        className={waiting ? "invisible" : undefined}
      >
        {rating ? (
          saved === rating ? (
            <ActionMark kind="rating" drawn className="size-4 text-current" />
          ) : (
            <Star aria-hidden className="size-4 fill-current" />
          )
        ) : (
          <Star aria-hidden className="size-4" />
        )}
        {rating ? <span className="tabular-nums">{rating}</span> : t("rate")}
      </Button>
      {actions.signedIn && open && (
        <TitleRate title={d} actions={actions} open={open} onOpenChange={(o) => setRateOpen(o ? d.id : null)} onSaved={setSaved} />
      )}
      <GuestGate {...actions.gate} />
    </>
  );
}
