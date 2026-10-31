"use client";

import type { Genre } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Checkbox";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { api } from "@/lib/api";
import type { HideReason } from "./usePersonalActions";

/** Genre names by id in the profile's language, film and series genres together (cached for an hour). */
export function useGenreNames(enabled = true) {
  const locale = useLocale();
  return useQuery({
    queryKey: ["genre-names", locale],
    queryFn: async () => {
      const [movie, tv] = await Promise.all([api<{ genres: Genre[] }>("/api/catalog/genres/movie"), api<{ genres: Genre[] }>("/api/catalog/genres/tv")]);
      return [...movie.genres, ...tv.genres];
    },
    staleTime: 60 * 60_000,
    enabled,
  });
}

/**
 * "Not interested" with a reason (design-system 8.1): why the title isn't for the profile — already watched it, not its
 * genre, or not this title — so recommendations learn the right thing (recommendations/taste.ts SIGNAL.hide). The reason
 * is optional: "Not interested" without one hides the title too. The card leaves its shelf once it is pressed, with
 * "Undo" in the toast, as before.
 */
export function NotInterestedDialog({
  open,
  onOpenChange,
  title,
  genreIds = [],
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  genreIds?: number[];
  onConfirm: (reason: HideReason | undefined) => void;
}) {
  const t = useTranslations("rows");
  const tc = useTranslations("common");
  const tm = useTranslations("card");
  const [reason, setReason] = useState<HideReason | null>(null);
  const names = useGenreNames(open && genreIds.length > 0);
  const genres = (names.data ?? [])
    .filter((g) => genreIds.includes(g.id) && g.id !== 16)
    .slice(0, 3)
    .map((g) => g.name.toLocaleLowerCase())
    .join(", ");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason(null);
        onOpenChange(o);
      }}
      size="sm"
      title={t("hideTitle", { title })}
      description={t("hideText")}
    >
      <RadioGroup<HideReason>
        legend={t("hideLegend")}
        hideLegend
        value={reason}
        onValueChange={setReason}
        options={[
          { value: "seen", label: t("hideSeen"), description: t("hideSeenText") },
          { value: "genre", label: t("hideGenre"), description: genres ? t("hideGenreText", { genres }) : t("hideGenreTextAny") },
          { value: "title", label: t("hideNotThis"), description: t("hideNotThisText") },
        ]}
      />
      <DialogActions>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {tc("cancel")}
        </Button>
        <Button
          onClick={() => {
            onConfirm(reason ?? undefined);
            setReason(null);
            onOpenChange(false);
          }}
        >
          {tm("notInterested")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
