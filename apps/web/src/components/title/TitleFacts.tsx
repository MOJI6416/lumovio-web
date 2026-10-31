import type { TitleDetails } from "@lumovio/contracts";
import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { formatDate, languageName, regionName } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import { ExternalLinks, FactsInfo, PeopleRows, RatingsSection, Soundtrack } from "./tab-parts";

// TMDB's statuses, said in the interface language (TTL-07).
const STATUSES = ["Rumored", "Planned", "In Production", "Post Production", "Released", "Canceled", "Returning Series", "Ended", "Pilot"];

const LINK =
  "inline-flex min-h-8 items-center gap-1.5 rounded-sm border border-line px-3 text-body-s text-text-1 transition-colors duration-fast ease-fast hover:border-line-2 hover:bg-surface-2 max-sm:min-h-11";

/** A section of the tab: the h2 of a shelf (7.13), an optional "i", on the page gutter. */
function Section({ id, title, info, children }: { id: string; title: string; info?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="page-x">
      <div className="mb-3 flex items-center gap-1 md:mb-4">
        <h2 id={id} className="text-h2 text-text-1">
          {title}
        </h2>
        {info}
      </div>
      {children}
    </section>
  );
}

/**
 * The "Details" tab (S06, S07, C13; TTL-07, TTL-10, TTL-16, TTL-21; owner 2026-10-25: "everything piled up"): sections
 * with one heading style and one rhythm (48 between them, 32 on a phone), each said once —
 * 1. Facts — a grid of what the hero doesn't say: status in the interface language, the full release date, the number
 *    of episodes, countries, languages, networks (and TMDB's keywords in English only, they have no translation); the
 *    credits for the data and the art (TMDB, Fanart.tv) in the "i";
 * 2. Ratings — a compact grid of the sources, "How the Lumovio Score is calculated" folded under it (./RatingsSection);
 * 3. Cast and 4. Creators — shelves of PersonCards;
 * 5. Soundtrack;
 * 6. Elsewhere — the title on TMDB, IMDb, Wikidata, its own site, Letterboxd, Kinopoisk…
 * Nothing the hero shows is repeated: overview, genres, the director or creators' line, the original title, the age rating.
 */
export async function TitleFacts({ details: d, locale }: { details: TitleDetails; locale: string }) {
  const t = await getTranslations("title");
  const tp = await getTranslations("titlePage");
  const rows: [string, ReactNode][] = [];
  if (d.status) rows.push([t("status"), STATUSES.includes(d.status) ? tp(`status_${d.status.replace(/ /g, "")}` as "status_Released") : <span key="s" lang="en">{d.status}</span>]);
  if (d.releaseDate) rows.push([d.kind === "movie" ? t("released") : t("firstAired"), formatDate(d.releaseDate, locale, { dateStyle: "long" })]);
  if (d.kind === "tv" && d.numberOfEpisodes) rows.push([tp("episodeCount"), (await getTranslations("common"))("episodes", { count: d.numberOfEpisodes })]);
  // Numbered as releases count it, in one of TMDB's episode groups (api modules/numbering): which one, and why in the "i".
  const nb = d.kind === "tv" ? d.numbering : null;
  if (nb)
    rows.push([
      tp("numbering"),
      <span key="nb" className="inline-flex items-center gap-1">
        {tp("numberingValue", { group: nb.group })}
        <FactsInfo
          title={tp("numbering")}
          note={nb.tmdbSeasons ? tp("numberingNote", { group: nb.group, seasons: nb.seasons, tmdbSeasons: nb.tmdbSeasons }) : tp("numberingNoteShort", { group: nb.group })}
        />
      </span>,
    ]);
  if (d.countries.length) rows.push([t("countries"), d.countries.map((c) => regionName(c, locale)).join(", ")]);
  const langs = [d.originalLanguage, ...d.spokenLanguages].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);
  if (langs.length) rows.push([t("languages"), langs.slice(0, 5).map((l) => languageName(l, locale)).join(", ")]);
  if (d.networks.length)
    rows.push([
      t("networks"),
      <span key="n" className="flex flex-wrap items-center gap-2">
        {d.networks.map((n) =>
          n.logoPath ? (
            // A white plate in both themes: network logos are drawn for a light background (3.6).
            <span key={n.id} className="rounded-sm bg-white px-2 py-1">
              <img src={tmdbImage(n.logoPath, "w92") ?? undefined} alt={n.name} className="h-5 w-auto" loading="lazy" />
            </span>
          ) : (
            <span key={n.id}>{n.name}</span>
          ),
        )}
      </span>,
    ]);
  const english = locale.startsWith("en");

  // Art shown from Fanart.tv is credited with the rights holder it records — in the "i" of the facts.
  const fanart = [
    d.logo?.source === "fanart" ? { what: t("artLogo"), art: d.logo } : null,
    !d.backdropPath && d.altBackdrop ? { what: t("artBackground"), art: d.altBackdrop } : null,
  ].filter((x) => x !== null);
  const credits = [tp("tmdbCredit"), ...fanart.map((f) => `${f.what}: fanart.tv${f.art.copyright ? ` · © ${f.art.copyright}` : ""}`)].join(" ");

  let homepageHost: string | null = null;
  try {
    homepageHost = d.homepage ? new URL(d.homepage).hostname.replace(/^www\./, "") : null;
  } catch {
    homepageHost = null;
  }
  const links = [
    { href: `https://www.themoviedb.org/${d.kind}/${d.tmdbId}`, label: "TMDB" },
    d.externalIds.imdb ? { href: `https://www.imdb.com/title/${d.externalIds.imdb}/`, label: "IMDb" } : null,
    d.externalIds.wikidata ? { href: `https://www.wikidata.org/wiki/${d.externalIds.wikidata}`, label: "Wikidata" } : null,
    d.homepage && homepageHost ? { href: d.homepage, label: homepageHost } : null,
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="flex flex-col gap-8 md:gap-12">
      {rows.length > 0 && (
        <Section id="facts-h" title={tp("facts")} info={<FactsInfo title={tp("facts")} note={credits} />}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {rows.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-body-s text-text-2">{k}</dt>
                <dd className="mt-1 text-body text-text-1">{v}</dd>
              </div>
            ))}
            {english && d.keywords.length > 0 && (
              <div className="col-span-full">
                <dt className="text-body-s text-text-2">{t("keywords")}</dt>
                <dd className="mt-1 text-body text-text-1">{d.keywords.slice(0, 12).join(" · ")}</dd>
              </div>
            )}
          </dl>
        </Section>
      )}
      <RatingsSection kind={d.kind} tmdbId={d.tmdbId} tmdbRating={d.tmdbRating} tmdbVotes={d.tmdbVotes} />
      <PeopleRows cast={d.cast} crew={d.crew} creators={d.creators} />
      <div className="page-x">
        <Soundtrack kind={d.kind} tmdbId={d.tmdbId} searchQuery={`${d.originalTitle ?? d.title} soundtrack`} />
      </div>
      <Section id="links-h" title={t("externalLinks")}>
        <ul className="flex flex-wrap gap-2">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} target="_blank" rel="noreferrer noopener" className={LINK}>
                {l.label}
                <ExternalLink aria-hidden className="size-4" />
              </a>
            </li>
          ))}
          <ExternalLinks kind={d.kind} tmdbId={d.tmdbId} exclude={["imdb"]} className={LINK} />
        </ul>
      </Section>
    </div>
  );
}
