"use client";

import type { Video } from "@lumovio/contracts";
import { Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ArtCaption } from "@/components/media/ArtCaption";
import { Artwork } from "@/components/media/Artwork";
import { LANDSCAPE_SIZES } from "@/components/media/card-sizes";
import { Row } from "@/components/media/Row";
import { TrailerDialog, videoPage } from "./TrailerDialog";

// TMDB's video types, said in the interface language.
const TYPES = ["Trailer", "Teaser", "Clip", "Featurette", "Behind the Scenes", "Bloopers", "Opening Credits", "Recap"] as const;
const typeKey = (type: string) => ((TYPES as readonly string[]).includes(type) ? `videoType_${type.replace(/ /g, "")}` : null);
const ORDER = (type: string) => {
  const i = (TYPES as readonly string[]).indexOf(type);
  return i < 0 ? TYPES.length : i;
};

/**
 * "Videos" on the title page (a shelf, right after what starting needs — the
 * episodes, "Where to watch"): 16:9 cards of the shelf with the name and "Trailer ·
 * Russian" on the frame's foot (ArtCaption, ▶ before it: a press plays), as every card of a shelf — trailers first, the
 * interface language's first among them. A card is a link to the video's page; a press plays it here, in the
 * privacy-enhanced player, only once asked for.
 */
export function VideoShelf({ videos, title }: { videos: Video[]; title: string }) {
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
    <>
      <Row id="videos" title={t("videos")} kind="landscape">
        {sorted.map((v) => {
          const key = typeKey(v.type);
          // biome-ignore lint/suspicious/noExplicitAny: the videoType_* keys are built from TYPES
          const type = key ? t(key as any) : <span lang="en">{v.type}</span>;
          return (
            <div key={v.key} className="group/card relative w-full min-w-0 select-none">
              <a
                href={videoPage(v)}
                target="_blank"
                rel="noreferrer noopener"
                draggable={false}
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
                {/* The video's own title is in its language ("Official Trailer" on a Russian page). */}
                <ArtCaption
                  shape="landscape"
                  title={v.name}
                  titleLang={v.language && v.language !== lang ? v.language : undefined}
                  meta={[type, language(v.language)]}
                  lead={<Play aria-hidden className="me-1 size-3 shrink-0 self-center fill-current" />}
                />
              </a>
            </div>
          );
        })}
      </Row>
      <TrailerDialog video={active} title={title} onClose={() => setActive(null)} />
    </>
  );
}
