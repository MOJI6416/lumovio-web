"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { usePersonalActions } from "@/components/media/usePersonalActions";
import type { TitleCore } from "@/components/title/core";
import { TitleRate } from "@/components/title/TitleRate";

/**
 * The title page's "Rate" dialog for a card of "Ratings": the same 1–10, the same request and the same
 * "Remove rating". TitleRate reads only the title's id and name, so a card's summary is enough.
 */
export function RateTitle({
  title,
  open,
  onOpenChange,
  onSaved,
}: {
  title: TitleSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (value: number | null) => void;
}) {
  const actions = usePersonalActions(title);
  return <TitleRate title={title as TitleCore} actions={actions} open={open} onOpenChange={onOpenChange} onSaved={onSaved} />;
}
