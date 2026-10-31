"use client";

import type { Video } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Artwork } from "@/components/media/Artwork";
import { CardMeta } from "@/components/media/CardMeta";
import { CARD_GAP_X, LANDSCAPE_SIZES } from "@/components/media/card-sizes";
import { TrailerDialog, videoPage } from "./TrailerDialog";

// TMDB's video types, said in the interface language (TTL-07).
const TYPES = ["Trailer", "Teaser", "Clip", "Featurette", "Behind the Scenes", "Bloopers", "Opening Credits", "Recap"] as const;
const typeKey = (type: string) => (TYPES as readonly string[]).includes(type) ? `videoType_${type.replace(/ /g, "")}` : null;
const ORDER = (type: string) => {
  const i = (TYPES as readonly string[]).indexOf(type);
  return i < 0 ? TYPES.length : i;
};

/**
 * The "Videos" tab (design-system 7.12, C13): 16:9 cards — the frame, the name in up to two lines, "Trailer · Russian"
 * under it — trailers first, the interface language's first among them. A card is a link to the video's page; a press
 * plays it here, in the privacy-enhanced player, only once asked for.
 */
export function VideosTab({ videos, title }: { videos: Video[]; title: string }) {
  const t = useTranslations("titlePage");
  const locale = useLocale();
  const [active, setActive] = useState<Video | null>(null);
  const names = new Intl.DisplayNames([locale], { type: "language" });
  const lang = locale.slice(0, 2);
  const language = (code: string | null) => {
    if (!code) return null;
    const n = names.of(code) ?? code;
    return n.charAt(0).toLocaleUpperCase(locale) + n.slice(1);
  };
  const sorted = [...videos].sort((a, b) => ORDER(a.type) - ORDER(b.type) || Number(b.language === lang) - Number(a.language === lang) || Number(b.official) - Number(a.official));
  return (
    <section aria-labelledby="videos-h" className="page-x">
      <h2 id="videos-h" className="mb-4 text-h2 text-text-1">
        {t("videos")}
      </h2>
      <ul className={`grid grid-cols-1 gap-y-6 sm:grid-cols-2 md:grid-cols-[repeat(auto-fill,17.5rem)] xl:grid-cols-[repeat(auto-fill,19rem)] 2xl:grid-cols-[repeat(auto-fill,21rem)] ${CARD_GAP_X}`}>
        {sorted.map((v) => {
          const key = typeKey(v.type);
          // biome-ignore lint/suspicious/noExplicitAny: the videoType_* keys are built from TYPES
          const type = key ? t(key as any) : <span lang="en">{v.type}</span>;
          return (
            <li key={v.key} className="group/card min-w-0">
              <a
                href={videoPage(v)}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(e) => {
                  e.preventDefault();
                  setActive(v);
                }}
                aria-label={t("playVideo", { name: v.name })}
                className="group/link block rounded-sm focus-visible:outline-none"
              >
                <Artwork
                  shape="landscape"
                  src={v.site === "YouTube" ? `https://i.ytimg.com/vi/${v.key}/hqdefault.jpg` : null}
                  sizes={LANDSCAPE_SIZES}
                  placeholder="movie"
                />
                {/* The video's own title is in its language ("Official Trailer" on a Russian page, TTL-07). */}
                <CardMeta title={v.name} titleLang={v.language && v.language !== lang ? v.language : undefined} meta={[type, language(v.language)]} />
              </a>
            </li>
          );
        })}
      </ul>
      <TrailerDialog video={active} title={title} onClose={() => setActive(null)} />
    </section>
  );
}
