"use client";

import type { MediaKind, Soundtrack as SoundtrackData, SoundtrackAlbum } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { Music2, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { InfoTip } from "@/components/sources/InfoTip";
import { Button, buttonClass } from "@/components/ui/Button";
import { api } from "@/lib/api";

const POLLS = 6;

/**
 * The soundtrack in "Details" (TTL-15, C13): the albums MusicBrainz or Wikidata link to the title by id, each with one
 * Spotify action — "Listen" opens Spotify's player here (nothing is fetched from Spotify before that), or "Find in
 * Spotify" opens its search. No "Looking…" line: while MusicBrainz is asked (up to half a minute) only the search is
 * offered, and an album that turns up takes its place. Where the albums come from is in the "i".
 */
export function Soundtrack({ kind, tmdbId, searchQuery }: { kind: MediaKind; tmdbId: number; searchQuery: string }) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const q = useQuery({
    queryKey: ["soundtrack", kind, tmdbId],
    queryFn: () => api<SoundtrackData>(`/api/catalog/title/${kind}/${tmdbId}/soundtrack`),
    staleTime: 3_600_000,
    retry: 1,
    // The lookup runs in the background; ask again a few times while it does.
    refetchInterval: (query) => (query.state.data?.status === "pending" && query.state.dataUpdateCount < POLLS ? 5000 : false),
  });
  const albums = q.data?.albums ?? [];
  const search = `https://open.spotify.com/search/${encodeURIComponent(searchQuery)}`;
  return (
    <section aria-labelledby="soundtrack-h">
      <div className="mb-3 flex items-center gap-1 md:mb-4">
        <h2 id="soundtrack-h" className="text-h2 text-text-1">
          {t("soundtrack")}
        </h2>
        <InfoTip title={t("soundtrack")} note={albums.length > 0 ? t("soundtrackSourced") : t("soundtrackNote")} rules={tp("soundtrackPlayerInfo")} />
      </div>
      {albums.length > 0 ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {albums.map((a) => (
            <Album key={a.mbid} album={a} search={search} />
          ))}
        </ul>
      ) : (
        <a href={search} target="_blank" rel="noreferrer noopener" className={buttonClass("secondary")}>
          <Music2 aria-hidden />
          {tp("soundtrackFind")}
        </a>
      )}
    </section>
  );
}

function Album({ album: a, search }: { album: SoundtrackAlbum; search: string }) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const [cover, setCover] = useState(true);
  const [player, setPlayer] = useState(false);
  return (
    <li className="rounded-md border border-line bg-surface-1 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {cover ? (
          <img src={a.coverUrl} alt="" loading="lazy" onError={() => setCover(false)} className="size-14 shrink-0 rounded-xs bg-surface-2 object-cover" />
        ) : (
          <div aria-hidden className="grid size-14 shrink-0 place-items-center rounded-xs bg-surface-2 text-text-3">
            <Music2 className="size-6" />
          </div>
        )}
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-title text-text-1">{a.title}</p>
          <p className="mt-0.5 text-body-s text-text-2">{[a.kind === "score" ? t("soundtrackScore") : t("soundtrackSongs"), a.artists.join(", ") || null, a.year].filter(Boolean).join(" · ")}</p>
        </div>
        {a.spotify ? (
          !player && (
            <Button variant="secondary" icon={Play} onClick={() => setPlayer(true)}>
              {tp("soundtrackListen")}
            </Button>
          )
        ) : (
          <a href={search} target="_blank" rel="noreferrer noopener" className={buttonClass("secondary")}>
            <Music2 aria-hidden />
            {tp("soundtrackFind")}
          </a>
        )}
      </div>
      {a.spotify && player && (
        <iframe
          title={t("soundtrackPlayerTitle", { title: a.spotify.title ?? a.title })}
          src={`https://open.spotify.com/embed/album/${a.spotify.albumId}`}
          width="100%"
          height="352"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className="mt-3 rounded-md border-0"
        />
      )}
    </li>
  );
}
