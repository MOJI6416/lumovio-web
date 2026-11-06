"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { ActionMark } from "@/components/ui/BrandMotion";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Link } from "@/components/ui/Link";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLibraryState } from "@/hooks/useLibraryState";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { useRecommendationFeedback } from "./ForYouRow";
import { PosterCard } from "./PosterCard";
import { Row } from "./Row";

// Opened rarely: loaded on the first press, not with the home page (bundle budget).
const GenresDialog = lazy(() => import("./GenresDialog").then((m) => ({ default: m.GenresDialog })));

export function useStarterTitles() {
  return useQuery({
    queryKey: ["recommendations-start"],
    queryFn: () => api<{ items: TitleSummary[] }>("/api/recommendations/start").then((r) => r.items),
    staleTime: 10 * 60_000,
  });
}

/** The thumb of a confirmed like, in the button's colour; its outline was already shown. */
function LikedMark({ className }: { className?: string }) {
  return <ActionMark kind="like" drawn className={`text-current ${className ?? ""}`} />;
}

/**
 * A starter card: the poster with a "Like" toggle on it (X-29: a thumb, only a signal for "For you" — the heart is
 * Favourites). It shows its state where it was pressed; a failure says why (8.3).
 */
export function StarterCard({ title, onChange }: { title: TitleSummary; onChange?: (liked: boolean) => void }) {
  const t = useTranslations("rows");
  const { data: state } = useLibraryState(title.id);
  const feedback = useRecommendationFeedback();
  const liked = state?.feedback === "like";
  const toggle = useAction({ run: (on: boolean) => feedback(title.id, "like", on) });
  // A like the server has just taken fills the thumb once (6.3.1); one given before shows the plain icon.
  const [justLiked, setJustLiked] = useState(false);
  return (
    <PosterCard title={title} showState={false}>
      <IconButton
        icon={liked && justLiked ? LikedMark : ThumbsUp}
        variant="stage"
        size="sm"
        pressed={liked}
        disabled={toggle.pending}
        label={t("starterLike", { title: title.title })}
        onClick={async () => {
          const on = !liked;
          if (!(await toggle.run(on)).ok) return;
          setJustLiked(on);
          onChange?.(on);
        }}
      />
    </PosterCard>
  );
}

/**
 * "What do you like?" for a profile with nothing (or little) to start from: well-known films, series and anime to like
 * with one tap, and "Pick genres" (the cold start can begin from genres alone). Optional: "Not now" hides it until
 * next week (HOME-03), with "Undo"; likes can be given in the recommendation settings too. After a like, "Done" brings
 * "For you" in its place (the two are never shown together, HOME-04). A kids profile isn't offered the import (PRF-11).
 * While its titles load it holds its place with posters' skeletons (7.11), so the shelves under it don't jump down;
 * titles that don't come leave no shelf (an empty shelf is hidden).
 */
export function StarterRow({ likedGenres = [] }: { likedGenres?: number[] }) {
  const t = useTranslations("rows");
  const [genresOpen, setGenresOpen] = useState(false);
  const [genresUsed, setGenresUsed] = useState(false);
  const router = useRouter();
  const { me } = useSession();
  const kids = Boolean(me?.activeProfile?.isKids);
  const titles = useStarterTitles();
  const [liked, setLiked] = useState(0);
  const [gone, setGone] = useState(false);
  const setDismissed = (on: boolean) => api("/api/recommendations/settings", { method: "PUT", json: { startDismissed: on } });
  const dismiss = useAction({
    run: () => setDismissed(true),
    optimistic: () => {
      setGone(true);
      return () => setGone(false);
    },
    success: t("starterHidden"),
    undo: () => setDismissed(false),
  });
  if (gone || (!titles.isPending && !titles.data?.length)) return null;
  return (
    <Row
      id="starter"
      min={3}
      title={t("starterTitle")}
      note={t("starterNote")}
      rules={t("starterRules")}
      info={
        <Link variant="action" arrow href="/settings/recommendations">
          {t("forYouSettings")}
        </Link>
      }
      actions={
        // Three controls wrap onto two lines on a phone rather than breaking a label (8.11).
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
          {genresUsed && (
            <Suspense fallback={null}>
              <GenresDialog open={genresOpen} onOpenChange={setGenresOpen} initial={likedGenres} />
            </Suspense>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setGenresUsed(true);
              setGenresOpen(true);
            }}
          >
            {t("starterGenres")}
          </Button>
          {!kids && (
            <Link variant="action" arrow href="/import" className="whitespace-nowrap">
              {t("starterImport")}
            </Link>
          )}
          {liked > 0 ? (
            <Button size="sm" onClick={() => router.refresh()}>
              {t("starterDone", { count: liked })}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void dismiss.run()}>
              {t("starterSkip")}
            </Button>
          )}
        </div>
      }
    >
      {titles.data
        ? titles.data.map((title) => <StarterCard key={title.id} title={title} onChange={(on) => setLiked((n) => n + (on ? 1 : -1))} />)
        : // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-2/3 w-full" />)}
    </Row>
  );
}
