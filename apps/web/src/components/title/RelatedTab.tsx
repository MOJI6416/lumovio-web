"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import { PosterCard } from "@/components/media/PosterCard";
import { TitleGrid } from "@/components/media/Row";
import { ShelfInfo } from "@/components/media/ShelfInfo";

/**
 * "More like this" (design-system 7.12, 7.13, TTL-16): the collection the title belongs to — named without TMDB's
 * "(Collection)" and without the title itself — then recommendations of the same form and of another one, in grids of
 * PosterCards (each with its "More" menu). What each grid is goes in its "i", not in a grey line under the heading.
 */
export function RelatedTab({
  collection,
  related,
  relatedOther,
}: {
  collection: { name: string; parts: TitleSummary[] } | null;
  related: TitleSummary[];
  relatedOther: TitleSummary[];
}) {
  const t = useTranslations("title");
  const sections = [
    collection && collection.parts.length > 0 ? { id: "collection", title: t("collection", { name: collection.name }), items: collection.parts, note: undefined } : null,
    related.length > 0 ? { id: "related", title: t("relatedSame"), items: related, note: t("relatedSameNote") } : null,
    relatedOther.length > 0 ? { id: "related-other", title: t("relatedOther"), items: relatedOther, note: t("relatedOtherNote") } : null,
  ].filter((s) => s !== null);
  return (
    <div className="page-x flex flex-col gap-12">
      {sections.map((s) => (
        <section key={s.id} aria-labelledby={`${s.id}-h`}>
          <div className="mb-4 flex items-center gap-1">
            <h2 id={`${s.id}-h`} className="text-h2 text-text-1">
              {s.title}
            </h2>
            {s.note && <ShelfInfo title={s.title} note={s.note} />}
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

