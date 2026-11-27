import type { MoreBy, TitleDetails } from "@lumovio/contracts";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { collectionName, notOutYet, titleCore, utcToday } from "@/components/title/core";
import { MaturityBlocked } from "@/components/title/MaturityBlocked";
import { OpenedSignal } from "@/components/title/OpenedSignal";
import { Availability, PeopleRows, RatingsSection, RelatedShelves, SeasonBrowser, Soundtrack, VideoShelf } from "@/components/title/parts";
import { SectionArrival } from "@/components/title/SectionArrival";
import { TitleFacts } from "@/components/title/TitleFacts";
import { TitleHero } from "@/components/title/TitleHero";
import { TitleUnavailable } from "@/components/title/TitleUnavailable";
import { ApiRequestError } from "@/lib/api";
import { OG_IMAGE } from "@/lib/brand";
import { tmdbImage } from "@/lib/images";
import { meFailure } from "@/lib/me-state";
import { optional } from "@/lib/optional";
import { titleJsonLd } from "@/lib/json-ld";
import { canonicalLocale, localizedPath, ogBase, seoAlternatesIn } from "@/lib/seo";
import { getMeState, serverApi } from "@/lib/server-api";
import { parseCodeSlug } from "@/lib/address-read";
import { titleHref } from "@/lib/slug";

type Params = Promise<{ locale: string; ref: string }>;

/**
 * A title's address in a language: its code, and its name there in the slug (links and the canonical are the same
 * address). The page's own language uses the name it shows; the others the title's name there.
 */
const titlePath = (d: TitleDetails, own: string, l: string) => titleHref(d, l === own ? d.title : (d.localTitles?.[l as "en"] ?? d.title));
type Search = Promise<Record<string, string | string[] | undefined>>;

/** A section's place under the sticky header when a link brings it up. */
const SECTION = "scroll-mt-24";

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// One request per render for the metadata and the page (a tab switch renders the page again).
const load = cache(async (ref: string): Promise<TitleDetails | "blocked" | "unavailable" | null> => {
  const code = parseCodeSlug(ref);
  if (!code) return null;
  try {
    return await serverApi<TitleDetails>(`/api/catalog/title/${code}`);
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === "maturity_blocked") return "blocked";
    // Hidden at a rights holder's request (Admin → Catalog): the same for everyone.
    if (e instanceof ApiRequestError && e.code === "title_unavailable") return "unavailable";
    // A code never issued (404) is a 404 page, not "probably temporary".
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, ref } = await params;
  // Metadata only: a page that fails to load says so itself.
  const d = await optional(load(ref), null);
  if (!d) return {};
  // A title closed to this profile isn't named in the tab either.
  if (d === "blocked") return { title: (await getTranslations("title"))("maturityBlocked"), robots: { index: false } };
  if (d === "unavailable") return { title: (await getTranslations("titlePage"))("unavailableTitle"), robots: { index: false } };
  // A link preview is landscape: the backdrop, else the brand image — a poster would be cropped to a strip.
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

/**
 * A title's page: one page to scroll, as Apple TV's and the TV's —
 * no tabs to guess at. The hero decides and starts; under it what starting needs — a series' episodes, then where to
 * watch it (the main button's own choices: the audio, the cut, the quality) — then the trailer and the videos, what is
 * like it, who made it and who is in it, and the reference at the foot: the ratings in full, the details, the
 * soundtrack. Sections without anything to show aren't there.
 */
export default async function TitlePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, ref } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("title");
  let d: Awaited<ReturnType<typeof load>>;
  try {
    d = await load(ref);
  } catch (e) {
    // The API not answering a signed-in person is "temporarily unavailable" with Retry, not the error page.
    if (meFailure(e) === "unavailable" && (await getMeState()) === "unavailable") {
      return (
        <ServiceUnavailable variant="page" />
      );
    }
    throw e;
  }
  if (d === null) notFound();
  if (d === "blocked") return <MaturityBlocked from={`/title/${ref}`} />;
  if (d === "unavailable") return <TitleUnavailable />;
  // "More by …" (the director's or creator's other titles), from a cache.
  const moreByLoad = optional(serverApi<MoreBy | null>(`/api/catalog/title/${d.kind}/${d.tmdbId}/more-by`), null);
  // One address per title and language: a merged code, an old or foreign slug (or none) goes to the one with its own
  // code and name, for good, with the whole query (a section to open).
  const canonical = titleHref(d);
  if (`/title/${safeDecode(ref)}` !== canonical) {
    const q = new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x])))).toString();
    // The name may be Cyrillic: the Location header takes it percent-encoded.
    permanentRedirect(`${encodeURI(localizedPath(locale, canonical))}${q ? `?${q}` : ""}`);
  }

  const jsonLd = titleJsonLd(d, localizedPath(canonicalLocale(locale), canonical));
  const core = titleCore(d, locale.slice(0, 2));

  // The collection without TMDB's "(Collection)" and without this title.
  const collection = d.collection ? { name: collectionName(d.collection.name), parts: d.collection.parts.filter((p) => p.id !== d.id) } : null;
  // Each title once on the page: what the collection shows isn't repeated in the recommendations.
  const shown = new Set([d.id, ...(collection?.parts.map((p) => p.id) ?? [])]);
  const related = d.related.filter((p) => !shown.has(p.id));
  const relatedOther = d.relatedOther.filter((p) => !shown.has(p.id));
  const moreBy = await moreByLoad;
  const anyRelated = related.length > 0 || relatedOther.length > 0 || (collection && collection.parts.length > 0) || (moreBy?.items.length ?? 0) > 0;

  return (
    <article>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <TitleHero details={d} core={core} />
      <OpenedSignal titleId={d.id} />
      {/* The catalog is loading the title's details: the page asks again and shows them as they come. */}
      <SectionArrival />
      <div className="mx-auto flex max-w-media flex-col gap-8 pt-8 pb-10 md:gap-12 md:pt-10">
        {d.kind === "tv" && d.seasons.length > 0 && <SeasonBrowser title={core} />}
        <section id="watch" aria-labelledby="watch-h" className={`page-x ${SECTION}`}>
          <h2 id="watch-h" className="mb-3 text-h2 text-text-1 md:mb-4">
            {t("availability")}
          </h2>
          <Availability title={core} />
        </section>
        {d.videos.length > 0 && (
          <div id="videos" className={SECTION}>
            <VideoShelf videos={d.videos} title={d.title} />
          </div>
        )}
        {anyRelated && (
          <div id="related" className={SECTION}>
            <RelatedShelves collection={collection} related={related} relatedOther={relatedOther} moreBy={moreBy} />
          </div>
        )}
        {(d.cast.length > 0 || d.crew.length > 0 || d.creators.length > 0) && (
          <div id="people" className={SECTION}>
            <PeopleRows cast={d.cast} crew={d.crew} creators={d.creators} />
          </div>
        )}
        {/* No ratings for a title not out yet (as in the hero). */}
        {!notOutYet(d, utcToday()) && <RatingsSection kind={d.kind} tmdbId={d.tmdbId} tmdbRating={d.tmdbRating} tmdbVotes={d.tmdbVotes} />}
        <TitleFacts details={d} locale={locale} />
        <div className="page-x">
          <Soundtrack kind={d.kind} tmdbId={d.tmdbId} searchQuery={`${d.originalTitle ?? d.title} soundtrack`} />
        </div>
      </div>
    </article>
  );
}
