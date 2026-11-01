import type { CatalogPage, CatalogRow, ContinueWatchingItem, Genre, Recommendations, TitleSummary } from "@lumovio/contracts";
import { clsx } from "clsx";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Billboard } from "@/components/media/Billboard";
import { cardRow, cardShelf, forCard } from "@/components/media/card-data";
import { ContinueRow } from "@/components/media/ContinueRow";
import { PersonalShelf } from "@/components/media/ForYouRow";
import { LandscapeCard } from "@/components/media/LandscapeCard";
import { interleave, personalShelves, withoutPersonal } from "@/components/media/personal-home";
import { PosterCard } from "@/components/media/PosterCard";
import { Row } from "@/components/media/Row";
import { shelfHref, shelfInfo } from "@/components/media/shelf-copy";
import { StarterRow } from "@/components/media/StarterRow";
import { Top10Card } from "@/components/media/Top10Card";
import { TorrentFindsRow } from "@/components/media/TorrentFindsRow";
import { WatchNowToggle } from "@/components/media/WatchNowToggle";
import { GuestGateLinks } from "@/components/shell/GuestGate";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { Link as UiLink } from "@/components/ui/Link";
import { optional } from "@/lib/optional";
import { pageSeo } from "@/lib/seo";
import { getMeState, serverApi } from "@/lib/server-api";

/** Canonical and hreflang of the home page in each language (SH-13); the title is the layout's default. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageSeo((await params).locale, "/");
}

/** Shelves shown as 16:9 artwork instead of posters, for rhythm (as streaming homes do). */
const LANDSCAPE_ROWS = new Set(["popular_tv", "on_air", "miniseries"]);

/**
 * The home page (design-system 9, Media; S01). The billboard, then for a guest what Lumovio is, on the same stage in the
 * first screen (HOME-13); then the profile's own shelves — "Continue watching", one shelf of what is on its servers
 * (from its lists first, HOME-05), finds on its TorrServer, "For you" or, with nothing to start from, the starter
 * (never both, HOME-04) — the Top 10 (the page's only one, HOME-14) and the curated shelves (no editorial block: the
 * owner took "Lumovio's pick" out on 2026-10-25), with the other personal shelves ("Because you watched", a person's
 * titles, new in the profile's genres) between them and no title repeated from a personal shelf's first cards.
 * Shelves with fewer than three cards are not shown (Row); no filter chips inside shelves: "Watch now" is the server
 * shelf's "All" page (HOME-05).
 */
export default async function HomePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  // The API not answering a signed-in visitor is "temporarily unavailable", not a guest's home page (8.5, C38).
  const me = await getMeState();
  if (me === "unavailable") {
    return (
      <div className="page-x pt-8">
        <ServiceUnavailable />
      </div>
    );
  }
  const profile = me?.activeProfile ?? null;
  const { watch } = await searchParams;
  const empty = { items: [] as TitleSummary[], wanted: [] as TitleSummary[] };
  const [home, movieGenres, tvGenres, cont, onServers, recs, library] = await Promise.all([
    serverApi<CatalogPage>(`/api/catalog/home${watch === "now" && profile ? "?watch=now" : ""}`),
    serverApi<{ genres: Genre[] }>("/api/catalog/genres/movie").catch(() => ({ genres: [] })),
    serverApi<{ genres: Genre[] }>("/api/catalog/genres/tv").catch(() => ({ genres: [] })),
    profile ? serverApi<{ items: ContinueWatchingItem[] }>("/api/continue").catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
    // Personal, so it is fetched per request beside the shared (cached) home response.
    profile ? serverApi<typeof empty>("/api/library/on-servers").catch(() => empty) : Promise.resolve(empty),
    // Picks from this profile's own favorites and ratings; guests get none (no taste is claimed for them).
    profile ? optional(serverApi<Recommendations>("/api/recommendations"), null) : Promise.resolve(null),
    // Shelves of the profile's own Watchlist (short films, finished series); none in "watch now".
    profile && watch !== "now" ? optional(serverApi<{ rows: CatalogRow[] }>("/api/library/shelves"), { rows: [] }) : Promise.resolve({ rows: [] as CatalogRow[] }),
  ]);
  // "Watch now": every shelf keeps only titles with a copy on the profile's servers (the API decides).
  const now = home.mode === "now";
  // The Top 10 is the week's trend blended with Lumovio's own week (API catalog/top.ts); other lead shelves (kids profiles) render as normal shelves,
  // and so does a "watch now" page, where ranks of a thinned list would mislead.
  // Cards get their titles without the overviews no card shows (./card-data: a lighter page to download).
  const rows = home.rows.map(cardRow);
  const trending = rows[0]?.key === "trending" && !now ? rows[0] : null;
  const catalogRows = trending ? rows.slice(1) : rows;
  const top10 = (trending?.items ?? []).slice(0, 10);
  // One shelf of the profile's servers (HOME-05): what arrived from its own lists first, then other recent copies.
  // (`?? []`: an API from before this change, while a deploy rolls out, has no `wanted`.)
  const arrived = (onServers.wanted ?? []).map(forCard);
  const wanted = new Set(arrived.map((x) => x.id));
  const servers = [...arrived, ...onServers.items.filter((x) => !wanted.has(x.id)).map(forCard)];
  // The personal shelves: "For you" (and the next parts of a film series) where "For you" always was, the others between
  // the catalog shelves; the catalog shelves don't repeat their first cards. In "watch now" only titles with a copy.
  const shelves = personalShelves(recs, now);
  const personal = { lead: shelves.lead.map(cardShelf), later: shelves.later.map(cardShelf) };
  const forYou = personal.lead.some((s) => s.kind === "for_you");
  // "For you" is a shelf only with three picks (Row); the starter stands in for it until then, never beside it.
  const starter = Boolean(recs && !now && !forYou && !recs.startDismissed && recs.seeds.length < 3);
  const nothing = now && !cont.items.length && !servers.length && !personal.lead.length && !rows.length;
  // The Watchlist's shelves go first among the ones placed between the catalog shelves.
  const rest = interleave(withoutPersonal(catalogRows, [...personal.lead, ...personal.later]), [...library.rows.map(cardRow), ...personal.later]);
  const genres = [...movieGenres.genres, ...tvGenres.genres];
  const seeds = recs?.seeds.length ?? 0;
  const featured = home.featured.length > 0;
  const guest = !me;

  const shelf = (row: CatalogRow) => {
    const props = { id: row.key, title: t(row.titleKey as "rows.trending"), href: shelfHref(row.key, row.href), ...shelfInfo(row.key, (k) => t(k as "rows.top10Note")) };
    return LANDSCAPE_ROWS.has(row.key) ? (
      <Row key={row.key} kind="landscape" min={3} {...props}>
        {row.items.map((item) => (
          <LandscapeCard key={item.id} title={item} />
        ))}
      </Row>
    ) : (
      <Row key={row.key} min={3} {...props}>
        {row.items.map((item) => (
          <PosterCard key={item.id} title={item} />
        ))}
      </Row>
    );
  };

  return (
    <>
      {/* One h1 per page (4.2): the home page names itself for screen readers; the billboard titles are h2. */}
      <h1 className="sr-only">{t("shell.homeHeading")}</h1>
      {featured && <Billboard items={home.featured} genres={[...movieGenres.genres, ...tvGenres.genres]} />}
      {guest && (
        // What Lumovio is, on the billboard's stage in the first screen (HOME-13); the way in is the same as everywhere (GuestGate).
        <section
          aria-labelledby="welcome-h"
          className={clsx(
            "stage page-x relative z-10 flex flex-col gap-4 border-t border-line bg-stage py-6 md:flex-row md:items-center md:gap-8 md:py-8",
            featured && "md:in-data-[theme=dark]:-mt-32",
          )}
        >
          <div className="min-w-0 flex-1">
            <h2 id="welcome-h" className="text-h2 text-text-1">
              {t("home.guestTitle")}
            </h2>
            <p className="mt-2 max-w-measure text-body text-text-2">{t("home.guestText")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <GuestGateLinks lead="signUp" />
          </div>
        </section>
      )}
      <div
        // The C5 comparison arm the API built this page in: its shelves' counters carry it (lib/discovery-metrics).
        data-discovery-variant={home.variant}
        className={clsx(
          "relative z-10 mx-auto flex max-w-media flex-col gap-8 md:gap-12",
          // The first shelf comes up onto the dark billboard in the dark theme only; in the light one the stage ends with
          // an even edge and the page starts under it (X-27). A guest's welcome takes that place.
          featured && !guest ? "mt-2 md:in-data-[theme=dark]:-mt-32 md:in-data-[theme=light]:mt-12" : "mt-8 md:mt-12",
        )}
      >
        {now && (
          <div className="page-x flex flex-wrap items-center gap-x-4 gap-y-2">
            <WatchNowToggle on href="/" label={t("rows.watchNow")} />
            <p className="text-body-s text-text-2">{t("rows.watchNowNote")}</p>
          </div>
        )}
        {cont.items.length > 0 && <ContinueRow items={cont.items} />}
        {servers.length > 0 && (
          <Row
            id="on_servers"
            min={3}
            title={t("rows.inYourLibraries")}
            note={t("rows.inYourLibrariesNote")}
            rules={arrived.length > 0 ? t("rows.fromYourListsNote") : undefined}
            // "Watch now" — the whole catalog with a copy on the servers — is this shelf's "All" page (HOME-05).
            href={!now && home.servers > 0 ? "/?watch=now" : null}
          >
            {servers.map((item) => (
              <PosterCard key={item.id} title={item} />
            ))}
          </Row>
        )}
        {/* Watchlist titles this device found on the profile's TorrServer in its languages (client-side, device-local). */}
        {profile && !profile.isKids && <TorrentFindsRow />}
        {personal.lead.map((s) => (
          <PersonalShelf key={s.key} shelf={s} genres={genres} seeds={seeds} />
        ))}
        {/* Nothing or little to start from: offer the optional starter until it is finished or put off (HOME-03). */}
        {starter && <StarterRow likedGenres={recs?.likedGenres ?? []} />}
        {nothing && (
          <p className="page-x text-body-s text-text-2">
            {home.servers > 0 ? t("rows.watchNowEmpty") : t("title.noServers")}{" "}
            {home.servers === 0 && (
              <UiLink variant="action" arrow href="/settings/connections">
                {t("title.connectServer")}
              </UiLink>
            )}
          </p>
        )}
        {top10.length > 0 && (
          <Row title={t("rows.top10")} note={t("rows.top10Note")} id="top10" kind="top10" min={3}>
            {top10.map((item, i) => (
              <Top10Card key={item.id} title={item} rank={i + 1} priority={i < 4} />
            ))}
          </Row>
        )}
        {rest.map((row) => ("titleKey" in row ? shelf(row) : <PersonalShelf key={row.key} shelf={row} genres={genres} seeds={seeds} />))}
      </div>
    </>
  );
}
