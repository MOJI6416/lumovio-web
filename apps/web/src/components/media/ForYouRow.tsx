"use client";

import type { Genre, RecommendationShelf, TitleLibraryState } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Link } from "@/components/ui/Link";
import { useSetLibraryState } from "@/hooks/useLibraryState";
import { api } from "@/lib/api";
import { PosterCard } from "./PosterCard";
import { genreNames, reasonLine, shelfNote, shelfTitle, whyLines, withNameLang } from "./recommendation-copy";
import { Row } from "./Row";

/** Sends "like", "not interested" or "don't use" for a title and keeps the card's library state in step. */
export function useRecommendationFeedback() {
  const setState = useSetLibraryState();
  return async (titleId: string, kind: "like" | "hide" | "ignore", on: boolean) => {
    const s = await api<TitleLibraryState>("/api/recommendations/feedback", { method: "POST", json: { titleId, kind, on } });
    setState(s);
    return s;
  };
}

/**
 * One personal shelf: "For you", "Because you watched «X»", a
 * director's or actor's titles, the next parts of a film series, new titles in the profile's genres. "For you" cards
 * say in one line where they come from; every card's "More" has "Why this?" with all of its reason and
 * "Not interested" with a reason (the card leaves the shelf at once, with "Undo"). What the shelf is built from and the
 * way to adjust it are in the "i".
 */
export function PersonalShelf({ shelf, genres, seeds }: { shelf: RecommendationShelf; genres: Genre[]; seeds: number }) {
  const t = useTranslations("rows");
  const locale = useLocale();
  const byId = useMemo(() => genreNames(genres), [genres]);
  const forYou = shelf.kind === "for_you";
  const title = shelfTitle(t, shelf);
  return (
    <Row
      id={shelf.key}
      min={3}
      title={title}
      // A name TMDB has only in Latin letters stays as it is, marked with its language.
      heading={shelf.person ? withNameLang(title, shelf.person.name, locale) : undefined}
      note={forYou && seeds < 3 ? t("forYouNoteFew", { count: seeds }) : shelfNote(t, shelf, byId)}
      rules={t("forYouRules")}
      info={
        <Link variant="action" arrow href="/settings/recommendations">
          {t("forYouSettings")}
        </Link>
      }
    >
      {shelf.items.map((rec) => (
        <PosterCard
          key={rec.title.id}
          title={rec.title}
          subtitle={forYou ? reasonLine(t, rec.reason, byId) : undefined}
          more={{ why: whyLines(t, rec.title, rec.reason, byId) }}
        />
      ))}
    </Row>
  );
}
