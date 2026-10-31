import type { TitleDetails } from "@lumovio/contracts";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { collectionName, TITLE_TABS, type TitleTabId, titleCore } from "@/components/title/core";
import { MaturityBlocked } from "@/components/title/MaturityBlocked";
import { TitleUnavailable } from "@/components/title/TitleUnavailable";
import { TitleActions } from "@/components/title/TitleActions";
import { TitleFacts } from "@/components/title/TitleFacts";
import { OpenedSignal } from "@/components/title/OpenedSignal";
import { TitleHero } from "@/components/title/TitleHero";
import { TitleTabs } from "@/components/title/TitleTabs";
import { Availability, RelatedTab, SeasonBrowser, VideosTab } from "@/components/title/tab-parts";
import { ApiRequestError } from "@/lib/api";
import { OG_IMAGE } from "@/lib/brand";
import { tmdbImage } from "@/lib/images";
import { meFailure } from "@/lib/me-state";
import { optional } from "@/lib/optional";
import { canonicalLocale, localizedPath, ogBase, seoAlternatesIn } from "@/lib/seo";
import { getMeState, serverApi } from "@/lib/server-api";
import { parseSlugId, titleHref } from "@/lib/slug";

type Params = Promise<{ locale: string; kind: string; slug: string }>;

/**
 * A title's address in a language: its name there in the slug (SH-13, Search Console 2026-10-29 — links and the
 * canonical are the same address). The page's own language uses the name it shows; the others TMDB's name there.
 */
const titlePath = (d: TitleDetails, own: string, l: string) => titleHref(d.kind, d.tmdbId, l === own ? d.title : (d.localTitles?.[l as "en"] ?? d.title));
type Search = Promise<{ tab?: string | string[] }>;

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// One request per render for the metadata and the page (a tab switch renders the page again).
const load = cache(async (kind: string, slug: string): Promise<TitleDetails | "blocked" | "unavailable" | null> => {
  const id = parseSlugId(slug);
  if ((kind !== "movie" && kind !== "tv") || !id) return null;
  try {
    return await serverApi<TitleDetails>(`/api/catalog/title/${kind}/${id}`);
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === "maturity_blocked") return "blocked";
    // Hidden at a rights holder's request (Admin → Catalog): the same for everyone.
    if (e instanceof ApiRequestError && e.code === "title_unavailable") return "unavailable";
    // An id TMDB never had (404) or one out of range (400) is a 404 page, not "probably temporary" (SH-02).
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, kind, slug } = await params;
  // Metadata only: a page that fails to load says so itself.
  const d = await optional(load(kind, slug), null);
  if (!d) return {};
  // A title closed to this profile isn't named in the tab either (SH-12).
  if (d === "blocked") return { title: (await getTranslations("title"))("maturityBlocked"), robots: { index: false } };
  if (d === "unavailable") return { title: (await getTranslations("titlePage"))("unavailableTitle"), robots: { index: false } };
  // A link preview is landscape (11.3): the backdrop, else the brand image — a poster would be cropped to a strip.
  const image = tmdbImage(d.backdropPath, "w1280");
  const title = d.year ? `${d.title} (${d.year})` : d.title;
  // The canonical address carries the name in the page's language, as every link to it does; another slug redirects.
  const own = canonicalLocale(locale);
  const path = titlePath(d, locale, own);
  return {
    title,
    description: d.overview ?? undefined,
    alternates: seoAlternatesIn(locale, (l) => titlePath(d, locale, l)),
    openGraph: {
      ...ogBase(locale, path),
      title,
      description: d.overview ?? undefined,
      type: d.kind === "movie" ? "video.movie" : "video.tv_show",
      images: [image ? { url: image, width: 1280, height: 720 } : OG_IMAGE],
    },
  };
}

export default async function TitlePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, kind, slug } = await params;
  const { tab: tabParam } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("title");
  const tp = await getTranslations("titlePage");
  let d: Awaited<ReturnType<typeof load>>;
  try {
    d = await load(kind, slug);
  } catch (e) {
    // The API not answering a signed-in person is "temporarily unavailable" with Retry (8.5, C38), not the error page.
    if (meFailure(e) === "unavailable" && (await getMeState()) === "unavailable") {
      return (
        <div className="page-x pt-8">
          <ServiceUnavailable />
        </div>
      );
    }
    throw e;
  }
  if (d === null) notFound();
  if (d === "blocked") return <MaturityBlocked from={`/title/${kind}/${slug}`} />;
  if (d === "unavailable") return <TitleUnavailable />;
  // One address per title and language: an old or foreign slug (or none) goes to the one with its name, for good.
  const canonical = titleHref(d.kind, d.tmdbId, d.title);
  if (`/title/${kind}/${safeDecode(slug)}` !== canonical) {
    const q = typeof tabParam === "string" ? `?tab=${encodeURIComponent(tabParam)}` : "";
    // The name may be Cyrillic: the Location header takes it percent-encoded.
    permanentRedirect(`${encodeURI(localizedPath(locale, canonical))}${q}`);
  }

  const directors = d.crew.filter((c) => c.job === "Director");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": d.kind === "movie" ? "Movie" : "TVSeries",
    name: d.title,
    alternateName: d.originalTitle ?? undefined,
    datePublished: d.releaseDate ?? undefined,
    description: d.overview ?? undefined,
    image: tmdbImage(d.posterPath, "w500") ?? undefined,
    genre: d.genres.map((g) => g.name),
    director: directors.map((p) => ({ "@type": "Person", name: p.name })),
    actor: d.cast.slice(0, 8).map((p) => ({ "@type": "Person", name: p.name })),
  };
  const core = titleCore(d, locale.slice(0, 2));

  // The collection without TMDB's "(Collection)" and without this title (TTL-16).
  const collection = d.collection ? { name: collectionName(d.collection.name), parts: d.collection.parts.filter((p) => p.id !== d.id) } : null;
  // Each title once on the tab: what the collection shows isn't repeated in the recommendations.
  const shown = new Set([d.id, ...(collection?.parts.map((p) => p.id) ?? [])]);
  const related = d.related.filter((p) => !shown.has(p.id));
  const relatedOther = d.relatedOther.filter((p) => !shown.has(p.id));
  const tabs: { id: TitleTabId; label: string }[] = [];
  if (d.kind === "tv" && d.seasons.length > 0) tabs.push({ id: "episodes", label: t("episodesTitle") });
  tabs.push({ id: "watch", label: t("availability") });
  if (related.length > 0 || relatedOther.length > 0 || (collection && collection.parts.length > 0)) tabs.push({ id: "related", label: t("related") });
  if (d.videos.length > 0) tabs.push({ id: "videos", label: t("trailers") });
  tabs.push({ id: "details", label: t("details") });
  const asked = (Array.isArray(tabParam) ? tabParam[0] : tabParam) as TitleTabId | undefined;
  const active: TitleTabId = asked && TITLE_TABS.includes(asked) && tabs.some((x) => x.id === asked) ? asked : tabs[0]!.id;

  return (
    <article>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <TitleHero details={d}>
        <TitleActions title={core} />
      </TitleHero>
      <OpenedSignal titleId={d.id} />
      <TitleTabs tabs={tabs} active={active} label={tp("sections", { title: d.title })}>
        {active === "episodes" && (
          <div className="page-x">
            <SeasonBrowser title={core} />
          </div>
        )}
        {active === "watch" && (
          <div className="page-x">
            <Availability title={core} />
          </div>
        )}
        {active === "related" && <RelatedTab collection={collection} related={related} relatedOther={relatedOther} />}
        {active === "videos" && <VideosTab videos={d.videos} title={d.title} />}
        {active === "details" && <TitleFacts details={d} locale={locale} />}
      </TitleTabs>
    </article>
  );
}
