import type { Genre } from "@lumovio/contracts";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionPage } from "@/components/tvui/screens/section-page";
import { wantsGrid } from "@/lib/discover";
import { serverApi } from "@/lib/server-api";

type Params = Promise<{ locale: string; kind: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }) {
  const t = await getTranslations("browse");
  return { robots: { index: false }, title: (await params).kind === "tv" ? t("titleSeries") : t("titleMovies") };
}

/** Movies and Series on a TV (S02 TV). */
export default async function TvBrowsePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, kind } = await params;
  if (kind !== "movie" && kind !== "tv") notFound();
  setRequestLocale(locale);
  const t = await getTranslations("browse");
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const { genres } = await serverApi<{ genres: Genre[] }>(`/api/catalog/genres/${kind}`).catch(() => ({ genres: [] as Genre[] }));
  return (
    <SectionPage
      kind={kind}
      anime={false}
      base={`/browse/${kind}`}
      title={kind === "tv" ? t("titleSeries") : t("titleMovies")}
      allLabel={kind === "tv" ? t("allSeries") : t("allMovies")}
      genres={genres}
      grid={wantsGrid(get)}
      get={get}
    />
  );
}
