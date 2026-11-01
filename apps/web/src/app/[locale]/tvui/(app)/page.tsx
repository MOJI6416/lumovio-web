import type { CatalogPage, CatalogRow, ContinueWatchingItem, Genre, Recommendations, TitleSummary } from "@lumovio/contracts";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { interleave, personalShelves, withoutPersonal } from "@/components/media/personal-home";
import { catalogShelf, continueShelf, personalShelf } from "@/components/tvui/media/shelves";
import { trimOverview, type TvShelfData } from "@/components/tvui/media/types";
import { HeroActions } from "@/components/tvui/screens/HeroActions";
import { ShelvesScreen } from "@/components/tvui/screens/ShelvesScreen";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";

/**
 * The TV's home (TV document §4 "Главная"): the featured title in the spotlight with "More info" and "Watchlist", then
 * the profile's shelves in the site's order — Continue watching (straight to the player), its servers, its personal
 * shelves, the Top 10 and the catalog — with the same data as the site's home.
 */
export default async function TvHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const empty = { items: [] as TitleSummary[], wanted: [] as TitleSummary[] };
  const [home, movieGenres, tvGenres, cont, onServers, recs, library] = await Promise.all([
    serverApi<CatalogPage>("/api/catalog/home"),
    serverApi<{ genres: Genre[] }>("/api/catalog/genres/movie").catch(() => ({ genres: [] })),
    serverApi<{ genres: Genre[] }>("/api/catalog/genres/tv").catch(() => ({ genres: [] })),
    serverApi<{ items: ContinueWatchingItem[] }>("/api/continue").catch(() => ({ items: [] })),
    serverApi<typeof empty>("/api/library/on-servers").catch(() => empty),
    optional(serverApi<Recommendations>("/api/recommendations"), null),
    optional(serverApi<{ rows: CatalogRow[] }>("/api/library/shelves"), { rows: [] as CatalogRow[] }),
  ]);
  const genres = [...movieGenres.genres, ...tvGenres.genres];
  const rows = home.rows;
  const trending = rows[0]?.key === "trending" ? rows[0] : null;
  const catalogRows = trending ? rows.slice(1) : rows;
  const shelves = personalShelves(recs, false);
  const wanted = new Set((onServers.wanted ?? []).map((x) => x.id));
  const servers = [...(onServers.wanted ?? []), ...onServers.items.filter((x) => !wanted.has(x.id))];

  const list: (TvShelfData | null)[] = [
    continueShelf(cont.items, t),
    servers.length >= 3 ? { key: "servers", title: t("rows.inYourLibraries"), shape: "poster", items: servers.map((x) => ({ title: trimOverview(x) })), href: "/browse/movie?view=all&watch=now" } : null,
    ...shelves.lead.map((s) => personalShelf(s, t, genres)),
    trending ? catalogShelf(trending, t, true) : null,
    // The Watchlist's shelves (short films, finished series) without "Show all": the TV's library has no such filters.
    ...interleave(withoutPersonal(catalogRows, [...shelves.lead, ...shelves.later]), [...library.rows.map((r) => ({ ...r, href: null })), ...shelves.later]).map((r) =>
      "kind" in r ? personalShelf(r, t, genres) : catalogShelf(r, t),
    ),
  ];
  const hero = home.featured[0] ? trimOverview(home.featured[0]) : null;
  return (
    <ShelvesScreen
      level="home"
      heading={t("shell.homeHeading")}
      hero={hero}
      heroActions={hero ? <HeroActions title={hero} /> : undefined}
      shelves={list.filter((s): s is TvShelfData => Boolean(s))}
      genres={genres}
    />
  );
}
