"use client";

import type { PersonDetails, TitleSummary } from "@lumovio/contracts";
import { User } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FocusEvent, useState } from "react";
import { CardRating } from "@/components/media/CardRating";
import { tmdbImage } from "@/lib/images";
import { TvCard } from "../media/TvCard";

/**
 * A person on a TV: the photo, the name, a few lines of the biography, then the films and series as one grid,
 * most known first — the same data as the site's page.
 */
export function PersonScreen({ person: p, credits }: { person: PersonDetails; credits: TitleSummary[] }) {
  const t = useTranslations("personPage");
  const [focused, setFocused] = useState<TitleSummary | null>(null);
  const photo = tmdbImage(p.profilePath, "h632");
  const onFocus = (e: FocusEvent<HTMLDivElement>) => setFocused(credits[Number((e.target as HTMLElement).dataset.index)] ?? null);
  return (
    <div data-tv-screen="detail" className="relative h-full">
      <div data-tv-scroller className="absolute inset-0 overflow-hidden">
        <div data-tv-content className="flex flex-col gap-8 pb-24">
          <header data-zone-frame="top" className="flex items-end gap-10 ps-(--tv-pad) pe-(--gutter) pt-12">
            <span className="grid aspect-2/3 w-44 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-2">
              {photo ? <img src={photo} alt="" className="size-full object-cover" /> : <User aria-hidden className="size-16 text-text-3" />}
            </span>
            <div className="flex min-w-0 flex-col gap-3">
              <h1 className="text-h1 text-text-1">{p.name}</h1>
              {p.biography && <p className="line-clamp-4 max-w-measure text-body-l text-text-2">{p.biography}</p>}
              <div className="flex h-9 items-center gap-4 text-body-l text-text-2" aria-live="polite">
                {focused && (
                  <>
                    <span className="truncate font-semibold text-text-1">{focused.title}</span>
                    {focused.year && <span>{focused.year}</span>}
                    <CardRating title={focused} className="text-text-1" />
                  </>
                )}
              </div>
            </div>
          </header>
          <section aria-label={t("filmography")} className="flex flex-col gap-4 ps-(--tv-pad) pe-(--gutter)">
            <h2 className="text-h3 text-text-1">{t("filmography")}</h2>
            <div data-zone="grid" data-zone-axis="grid" onFocus={onFocus} className="grid grid-cols-7 gap-x-6 gap-y-8">
              {credits.map((x, i) => (
                <TvCard key={x.id} title={x} index={i} fluid initial={i === 0} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
