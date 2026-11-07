"use client";

import type { Genre } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/Chip";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { genreEntries, toggleGenre } from "./genre-entries";

/** Film and series genres as one list in the profile's language (cached for an hour). */
export function useGenreEntries() {
  const locale = useLocale();
  return useQuery({
    queryKey: ["genres-all", locale],
    queryFn: async () => {
      const [movie, tv] = await Promise.all([api<{ genres: Genre[] }>("/api/catalog/genres/movie"), api<{ genres: Genre[] }>("/api/catalog/genres/tv")]);
      return genreEntries(movie.genres, tv.genres, locale);
    },
    staleTime: 60 * 60_000,
  });
}

/**
 * The starter's "Pick genres" (cold start, docs/curation.md): genres the profile likes, before or instead of liking
 * titles — "For you" is built from them at once, and the starter's titles come from them. Chips change a draft;
 * "Done" saves it (a failure stays in the dialog as a toast and nothing is lost), "Cancel" leaves it as it was.
 */
export function GenresDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (open: boolean) => void; initial: number[] }) {
  const t = useTranslations("rows");
  const tc = useTranslations("common");
  const tr = useTranslations("recs");
  const qc = useQueryClient();
  const router = useRouter();
  const genres = useGenreEntries();
  const [draft, setDraft] = useState<Set<number> | null>(null);
  const chosen = draft ?? new Set(initial);
  const save = useAction({
    run: (likedGenres: number[]) => api("/api/recommendations/settings", { method: "PUT", json: { likedGenres } }),
    success: () => {
      void qc.invalidateQueries({ queryKey: ["recommendations-start"] });
      void qc.invalidateQueries({ queryKey: ["recommendations"] });
      void qc.invalidateQueries({ queryKey: ["recommendations-taste"] });
      onOpenChange(false);
      setDraft(null);
      router.refresh();
      return null;
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setDraft(null);
        onOpenChange(o);
      }}
      size="lg"
      title={t("genresTitle")}
      description={t("genresText")}
    >
      <QueryState variant="inline" query={genres} loading={<Skeleton shape="md" className="h-24 w-full" />} error={{ title: tr("genresLoadError") }}>
        {(all) => (
          <div className="flex flex-wrap gap-2">
            {all.map((g) => (
              <FilterChip key={g.id} selected={g.ids.some((id) => chosen.has(id))} onClick={() => setDraft(new Set(toggleGenre(chosen, g, all)))}>
                {g.name}
              </FilterChip>
            ))}
          </div>
        )}
      </QueryState>
      <DialogActions>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {tc("cancel")}
        </Button>
        <Button loading={save.pending} disabled={draft === null} onClick={() => void save.run([...chosen])}>
          {tc("done")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
