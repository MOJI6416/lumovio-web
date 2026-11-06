"use client";

import type { MoreBy, TitleSummary } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { PosterCard } from "@/components/media/PosterCard";
import { TitleGrid } from "@/components/media/Row";
import { withNameLang } from "@/components/media/recommendation-copy";

/**
 * "More like this" (design-system 7.12, 7.13, TTL-16): the collection the title belongs to — named without TMDB's
 * "(Collection)" and without the title itself — then recommendations of the same form and of another one, and the
 * director's (a series': its creator's) other titles, in grids of PosterCards (each with its "More" menu). What each grid
 * is goes in its "i", not in a grey line under the heading. A title shows once on the tab: "More by" leaves out what the
 * grids above it show.
 */
export function RelatedTab({
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
  const above = new Set([...(collection?.parts ?? []), ...related, ...relatedOther].map((p) => p.id));
  const byPerson = moreBy ? moreBy.items.filter((p) => !above.has(p.id)) : [];
  const sections = [
    collection && collection.parts.length > 0 ? { id: "collection", title: t("collection", { name: collection.name }), items: collection.parts, note: undefined } : null,
    related.length > 0 ? { id: "related", title: t("relatedSame"), items: related, note: t("relatedSameNote") } : null,
    relatedOther.length > 0 ? { id: "related-other", title: t("relatedOther"), items: relatedOther, note: t("relatedOtherNote") } : null,
    moreBy && byPerson.length >= 3
      ? {
          id: "more-by",
          title: t(moreBy.person.role === "director" ? "moreByDirector" : "moreByCreator", { name: moreBy.person.name }),
          name: moreBy.person.name,
          items: byPerson,
          note: t(moreBy.person.role === "director" ? "moreByDirectorNote" : "moreByCreatorNote", { name: moreBy.person.name }),
        }
      : null,
  ].filter((s) => s !== null);
  return (
    <div className="page-x flex flex-col gap-12">
      {sections.map((s) => (
        <section key={s.id} aria-labelledby={`${s.id}-h`}>
          <div className="mb-4 flex items-center gap-1">
            <h2 id={`${s.id}-h`} className="text-h2 text-text-1">
              {/* A name TMDB has only in Latin letters on a ru/uk page is marked with its language (8.11, L10N-11). */}
              {"name" in s && s.name ? withNameLang(s.title, s.name, locale) : s.title}
            </h2>
            {/* No "i" by the heading (2026-11-06); what the section is stays for a screen reader. */}
            {s.note && <p className="sr-only">{s.note}</p>}
          </div>
          <TitleGrid>
            {s.items.map((p) => (
              <PosterCard key={p.id} title={p} />
            ))}
          </TitleGrid>
        </section>
      ))}
    </div>
  );
}
