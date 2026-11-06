"use client";

import type { MoreBy, TitleSummary } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { PosterCard } from "@/components/media/PosterCard";
import { Row } from "@/components/media/Row";
import { withNameLang } from "@/components/media/recommendation-copy";

/** Fewer cards than this aren't a shelf of their own (7.13): they lead "More like this" instead. */
const SHELF_MIN = 3;

/**
 * "More like this" on the title page (design-system 7.12, 7.13, TTL-16; 2026-11-06 shelves instead of the tab's grids):
 * the collection the title belongs to — named without TMDB's "(Collection)" and without the title itself — then what is
 * like it in the same form, then in another form, then the director's (a series': its creator's) other titles. Each is a
 * shelf of PosterCards; one with fewer than three cards doesn't stand alone: the collection's parts lead "More like
 * this" (as on the TV), another form's follow it. A title shows once: "More by" leaves out what the shelves above show.
 * What each shelf is stays for a screen reader (Row's `note`).
 */
export function RelatedShelves({
  collection,
  related,
  relatedOther,
  moreBy,
}: {
  collection: { name: string; parts: TitleSummary[] } | null;
  related: TitleSummary[];
  relatedOther: TitleSummary[];
  moreBy?: MoreBy | null;
}) {
  const t = useTranslations("title");
  const locale = useLocale();
  const parts = collection?.parts ?? [];
  const ownCollection = parts.length >= SHELF_MIN;
  const ownOther = relatedOther.length >= SHELF_MIN;
  const like = [...(ownCollection ? [] : parts), ...related, ...(ownOther ? [] : relatedOther)];
  const above = new Set([...parts, ...related, ...relatedOther].map((p) => p.id));
  const byPerson = moreBy ? moreBy.items.filter((p) => !above.has(p.id)) : [];
  return (
    <div className="flex flex-col gap-8 md:gap-12">
      {collection && ownCollection && (
        <Row id="collection" title={t("collection", { name: collection.name })}>
          {parts.map((p) => (
            <PosterCard key={p.id} title={p} />
          ))}
        </Row>
      )}
      {like.length > 0 && (
        <Row id="related" title={t("related")} note={t("relatedSameNote")}>
          {like.map((p) => (
            <PosterCard key={p.id} title={p} />
          ))}
        </Row>
      )}
      {ownOther && (
        <Row id="related-other" title={t("relatedOther")} note={t("relatedOtherNote")}>
          {relatedOther.map((p) => (
            <PosterCard key={p.id} title={p} />
          ))}
        </Row>
      )}
      {moreBy && byPerson.length >= SHELF_MIN && (
        <Row
          id="more-by"
          title={t(moreBy.person.role === "director" ? "moreByDirector" : "moreByCreator", { name: moreBy.person.name })}
          // A name TMDB has only in Latin letters on a ru/uk page is marked with its language (8.11, L10N-11).
          heading={withNameLang(t(moreBy.person.role === "director" ? "moreByDirector" : "moreByCreator", { name: moreBy.person.name }), moreBy.person.name, locale)}
          note={t(moreBy.person.role === "director" ? "moreByDirectorNote" : "moreByCreatorNote", { name: moreBy.person.name })}
        >
          {byPerson.map((p) => (
            <PosterCard key={p.id} title={p} />
          ))}
        </Row>
      )}
    </div>
  );
}
