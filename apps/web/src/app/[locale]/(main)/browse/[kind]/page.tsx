import type { Genre, Paged, TitleSummary } from "@lumovio/contracts";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { BrowseView } from "@/components/browse/BrowseView";
import { SectionLanding } from "@/components/browse/SectionLanding";
import { shelfHeading } from "@/components/media/shelf-copy";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "@/i18n/navigation";
import { browseState, discoverQuery, wantsGrid } from "@/lib/discover";
import { optional } from "@/lib/optional";
import { pageSeo } from "@/lib/seo";
import { serverApi } from "@/lib/server-api";

type Params = Promise<{ locale: string; kind: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, kind } = await params;
  const t = await getTranslations("browse");
  // Filters in the address (?genre=…) are views of the section: the canonical is the section itself (SH-13).
  return { title: kind === "tv" ? t("titleSeries") : t("titleMovies"), ...(kind === "movie" || kind === "tv" ? pageSeo(locale, `/browse/${kind}`) : {}) };
}

export default async function BrowsePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, kind } = await params;
  if (kind !== "movie" && kind !== "tv") notFound();
  setRequestLocale(locale);
  const t = await getTranslations("browse");
  const tr = await getTranslations();
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  // Anime has a section of its own: "?anime=1" (an old link, a typed address) opens its grid with the same filters,
  // as the home's "All" does since CAT-11, not this section's landing or a grid named "All series".
  if (get("anime") === "1") {
    const next = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "anime" ? [[k, v]] : [])));
    if (kind === "movie") next.set("kind", "movie");
    if (!wantsGrid((k) => next.get(k))) next.set("view", "all");
    redirect({ href: `/anime?${next}`, locale });
  }
  const { genres } = await serverApi<{ genres: Genre[] }>(`/api/catalog/genres/${kind}`).catch(() => ({ genres: [] as Genre[] }));
  const title = kind === "tv" ? t("titleSeries") : t("titleMovies");

  if (!wantsGrid(get)) {
    return (
      <SectionLanding
        kind={kind}
        anime={false}
        title={title}
        allLabel={kind === "tv" ? t("allSeries") : t("allMovies")}
        base={`/browse/${kind}`}
        genres={genres}
      />
    );
  }

  const query = discoverQuery(kind, browseState(get, false));
  // The first page rendered on the server; without it the browser loads it (with its own error and Retry).
  const first = await optional(serverApi<Paged<TitleSummary>>(`/api/catalog/discover?${query}&page=1`), null);
  // A shelf's "All" page keeps its name and what it is for (CAT-05, CAT-11) — the latter for a screen reader only:
  // no explanatory line on the screen (redesign 2026-11).
  const shelf = shelfHeading(get("shelf"), (k) => tr(k as "rows.oneEvening"), genres, locale);
  return (
    <div className="page-x mx-auto max-w-media">
      <PageHeader back={{ href: `/browse/${kind}`, label: title }} title={shelf?.title ?? (kind === "tv" ? t("allSeries") : t("allMovies"))} />
      {shelf?.description && <p className="sr-only">{shelf.description}</p>}
      <Suspense>
        <BrowseView kind={kind} genres={genres} initial={first ? { query, page: first } : undefined} />
      </Suspense>
    </div>
  );
}
