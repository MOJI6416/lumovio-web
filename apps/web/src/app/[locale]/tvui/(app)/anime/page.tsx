import type { Genre } from "@lumovio/contracts";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionPage } from "@/components/tvui/screens/section-page";
import { redirect } from "@/i18n/navigation";
import { ANIME_GENRES, ANIME_MOVIE_GENRES } from "@/lib/anime-genres";
import { wantsGrid } from "@/lib/discover";
import { optional } from "@/lib/optional";
import { getMe, serverApi } from "@/lib/server-api";
import { showsAnime } from "@/lib/show-anime";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata() {
  const t = await getTranslations("browse");
  return { robots: { index: false }, title: t("titleAnime") };
}

/** Anime on a TV: series by default, films by the grid's "Films". */
export default async function TvAnimePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The profile has anime off: the menu has no Anime, and its address goes home.
  if (!showsAnime(await optional(getMe(), null))) redirect({ href: "/", locale });
  const t = await getTranslations("browse");
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const [tv, movie] = await Promise.all([
    serverApi<{ genres: Genre[] }>("/api/catalog/genres/tv").catch(() => ({ genres: [] as Genre[] })),
    serverApi<{ genres: Genre[] }>("/api/catalog/genres/movie").catch(() => ({ genres: [] as Genre[] })),
  ]);
  return (
    <SectionPage
      kind="tv"
      anime
      base="/anime"
      title={t("titleAnime")}
      allLabel={t("allAnime")}
      genres={tv.genres.filter((g) => ANIME_GENRES.has(g.id))}
      movieGenres={movie.genres.filter((g) => ANIME_MOVIE_GENRES.has(g.id))}
      grid={wantsGrid(get)}
      get={get}
    />
  );
}
