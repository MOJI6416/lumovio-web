import type { PersonDetails, PersonSummary, TitleDetails } from "@lumovio/contracts";
import { tmdbImage } from "@/lib/images";
import { SITE_URL } from "@/lib/seo";
import { personHref } from "@/lib/slug";

/*
 * schema.org markup of the title and person pages (JSON-LD): each names itself by its canonical address (`@id`,
 * `url`) and the same entity on IMDb, Wikidata and TMDB (`sameAs`); people in a title's credits link their own page.
 */

/** An address of the site, absolute and percent-encoded (a slug may be Cyrillic). */
const absolute = (path: string) => `${SITE_URL}${encodeURI(path)}`;

const personRef = (p: PersonSummary) => ({ "@type": "Person", name: p.name, ...(p.code ? { url: absolute(personHref(p)) } : {}) });

/** `path`: the page's canonical address in its language. */
export function titleJsonLd(d: TitleDetails, path: string) {
  const url = absolute(path);
  const sameAs = [
    d.externalIds.imdb ? `https://www.imdb.com/title/${d.externalIds.imdb}/` : null,
    d.externalIds.wikidata ? `https://www.wikidata.org/wiki/${d.externalIds.wikidata}` : null,
    `https://www.themoviedb.org/${d.kind}/${d.tmdbId}`,
  ].filter((x): x is string => x !== null);
  return {
    "@context": "https://schema.org",
    "@type": d.kind === "movie" ? "Movie" : "TVSeries",
    "@id": url,
    url,
    name: d.title,
    alternateName: d.originalTitle ?? undefined,
    datePublished: d.releaseDate ?? undefined,
    description: d.overview ?? undefined,
    image: tmdbImage(d.posterPath, "w500") ?? undefined,
    genre: d.genres.map((g) => g.name),
    director: d.crew.filter((c) => c.job === "Director").map(personRef),
    ...(d.kind === "tv" && d.creators.length > 0 ? { creator: d.creators.map(personRef) } : {}),
    actor: d.cast.slice(0, 8).map(personRef),
    sameAs,
  };
}

/** `path`: the page's canonical address in its language; `description`: the biography as the page shows it. */
export function personJsonLd(p: PersonDetails, path: string, description: string | null) {
  const url = absolute(path);
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": url,
    url,
    name: p.name,
    image: tmdbImage(p.profilePath, "h632") ?? undefined,
    description: description ? description.slice(0, 300) : undefined,
    birthDate: p.birthday ?? undefined,
    deathDate: p.deathday ?? undefined,
    birthPlace: p.placeOfBirth ? { "@type": "Place", name: p.placeOfBirth } : undefined,
    gender: p.gender === "female" ? "Female" : p.gender === "male" ? "Male" : undefined,
    // The person's own site and profiles elsewhere, TMDB, IMDb and Wikidata among them.
    sameAs: (p.links ?? []).map((l) => l.url),
  };
}
