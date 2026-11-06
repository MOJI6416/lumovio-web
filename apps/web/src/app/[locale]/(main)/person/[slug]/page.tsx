import type { PersonDetails, PersonSite } from "@lumovio/contracts";
import { clsx } from "clsx";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { Artwork } from "@/components/media/Artwork";
import { BRAND_NAMES } from "@/components/media/BrandMark";
import { PosterCard } from "@/components/media/PosterCard";
import { Row } from "@/components/media/Row";
import { Bio } from "@/components/person/Bio";
import { age, character, countGroups, GROUPS, type Group, knownFor, mainGroup, type RowCredit } from "@/components/person/credits";
import { Filmography } from "@/components/person/Filmography";
import { PersonMuteSlot } from "@/components/person/PersonMuteSlot";
import { MaturityBlocked } from "@/components/title/MaturityBlocked";
import { ApiRequestError } from "@/lib/api";
import { OG_IMAGE } from "@/lib/brand";
import { formatDate, latinLang } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import { optional } from "@/lib/optional";
import { localizedPath, ogBase, seoAlternates } from "@/lib/seo";
import { serverApi } from "@/lib/server-api";
import { parseSlugId, personHref } from "@/lib/slug";

type Params = Promise<{ locale: string; slug: string }>;

const load = cache(async (slug: string): Promise<PersonDetails | "blocked" | null> => {
  const id = parseSlugId(slug);
  if (!id) return null;
  try {
    return await serverApi<PersonDetails>(`/api/catalog/person/${id}`);
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === "maturity_blocked") return "blocked";
    // An id TMDB never had (404) or one out of range (400) is a 404 page, not "probably temporary" (SH-02).
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
});

/** TMDB's departments in the order of the `person.dept{n}` words (Search says a person's department with them too). */
const DEPTS = ["Acting", "Directing", "Writing", "Production", "Sound", "Camera", "Editing", "Art", "Visual Effects", "Costume & Make-Up", "Lighting", "Crew"];
// TMDB's decorations in biographies ("💥", "🏆") are left out (PER-02).
const EMOJI = /\p{Extended_Pictographic}️?/gu;
/** The other sites without a logo of ours, as they write their names; the person's own site is its address. */
const SITE_NAMES: Partial<Record<PersonSite, string>> = { instagram: "Instagram", x: "X", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook" };
// "Elsewhere": quiet links that leave the site (↗), 44 px on a phone (5.6; "X" is that wide too) — the title page's
// "On other sites".
const LINK = "inline-flex min-h-8 items-center gap-1 text-body text-text-1 underline decoration-1 underline-offset-3 hover:decoration-2 max-sm:min-h-11 max-sm:min-w-11";

const known = (p: PersonDetails) => knownFor(p.credits, mainGroup(p, countGroups(p.credits)));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  // Metadata only: a page that fails to load says so itself.
  const p = await optional(load(slug), null);
  if (!p || p === "blocked") return {};
  // A link preview is landscape (11.3, SH-13): a frame from what they are known for, else the brand image — not the
  // portrait photo, which a preview crops to a strip of face.
  const frame = tmdbImage(known(p).find((c) => c.backdropPath)?.backdropPath, "w1280");
  const path = personHref(p.id);
  return {
    title: p.name,
    description: p.biography?.replace(EMOJI, "").trim().slice(0, 200) || undefined,
    alternates: seoAlternates(locale, path),
    openGraph: { ...ogBase(locale, path), type: "profile", images: [frame ? { url: frame, width: 1280, height: 720 } : OG_IMAGE] },
  };
}

/**
 * A person (S08, design-system 9 "Person"; 2026-11-06 from scratch): the page answers "what else is there with them".
 * At the top who they are — the photo in a circle, as everywhere a person is (their card, Search's best match), what they
 * do in words ("Actor · Producer · Director", "Actress" for a woman), the name, the birth date with the age and the place,
 * the biography in three lines with "More" (none without one) and, for a signed-in profile, "Don't show in
 * recommendations". Then "Known for", a shelf of the best-known titles in what they are known for (an actor's real
 * roles, the character under the poster), and the filmography, one profession at a time, by year. Last, the person on
 * other sites. A kids profile sees only the titles it may open; data TMDB gives only in English is marked `lang="en"`.
 */
export default async function PersonPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const p = await load(slug);
  if (p === null) notFound();
  // One address per person (lib/slug.ts personHref): an older one with a name goes there, for good.
  if (p !== "blocked" && slug !== String(p.id)) permanentRedirect(localizedPath(locale, personHref(p.id)));
  if (p === "blocked") return <MaturityBlocked from={`/person/${slug}`} person />;

  const gender = p.gender ?? null;
  const counts = countGroups(p.credits);
  const main = mainGroup(p, counts);
  const best = knownFor(p.credits, main);
  const deptIndex = p.knownForDepartment ? DEPTS.indexOf(p.knownForDepartment) : -1;
  const word = (g: Group) =>
    g === "crew" ? (deptIndex >= 4 ? t(`person.dept${deptIndex}` as "person.dept0") : null) : t(`person.as_${g}`, { gender: gender ?? "other" });
  // What they do: what they are known for first, then the professions with two works or more, most first; "Other" and
  // "As themselves" are not a profession (a cinematographer's "Other" is said by their department: "Camera").
  const others = GROUPS.filter((g) => g !== main && g !== "crew" && g !== "self" && counts[g] >= 2).sort((a, b) => counts[b] - counts[a]);
  const professions = [...(main && main !== "self" ? [main] : []), ...others]
    .slice(0, 3)
    .map(word)
    .filter(Boolean);

  const today = new Date().toISOString().slice(0, 10);
  const years = age(p.birthday, p.deathday ?? today);
  const date = (iso: string) => formatDate(iso, locale, { dateStyle: "long" }) ?? iso;
  const bio = p.biography?.replace(EMOJI, "").replace(/[ \t]+\n/g, "\n").trim() || null;
  const lang = latinLang(p.name, locale);
  // The browser gets what the rows show: no overviews, backdrops or vote counts of up to 500 titles.
  const rows: RowCredit[] = p.credits.map((c) => ({
    id: c.id,
    kind: c.kind,
    tmdbId: c.tmdbId,
    title: c.title,
    year: c.year,
    releaseDate: c.releaseDate,
    posterPath: c.posterPath,
    isAnime: c.isAnime,
    imdbRating: c.imdbRating,
    tmdbRating: c.tmdbRating,
    lumovioScore: c.lumovioScore,
    role: c.role,
    as: c.as,
    jobs: c.jobs,
    departments: c.departments,
    characters: c.characters,
    episodes: c.episodes,
  }));
  // Under an actor's poster the character they played; under a director's the card's rating, year and type.
  const played = (c: PersonDetails["credits"][number]) => {
    const r = main === "acting" && c.characters?.[0] ? character(c.characters[0]) : null;
    return r?.name ? (r.voice ? t("person.voiceRole", { name: r.name }) : r.name) : undefined;
  };
  const links = p.links ?? [];

  return (
    <div className="flex flex-col gap-10 pt-20 md:gap-12 md:pt-28">
      {/* Who: the circle and the name side by side, the biography under them on a phone and beside the circle from md. */}
      <header className="page-x mx-auto grid w-full max-w-media grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-5 md:grid-cols-[10rem_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:items-start md:gap-x-8 xl:grid-cols-[12rem_minmax(0,1fr)] xl:gap-x-10">
        <Artwork
          shape="person"
          src={tmdbImage(p.profilePath, "w185")}
          srcSet={p.profilePath ? `${tmdbImage(p.profilePath, "w185")} 185w, ${tmdbImage(p.profilePath, "h632")} 421w` : undefined}
          sizes="(min-width: 1280px) 192px, (min-width: 768px) 160px, 112px"
          alt={p.name}
          placeholder="person"
          priority
          className="w-full md:row-span-2"
        />
        {/* Without a biography the name stands by the circle's middle, as it does on a phone. */}
        <div className={clsx("min-w-0", !bio && "md:row-span-2 md:self-center")}>
          {professions.length > 0 && <p className="text-body-s font-semibold text-text-2">{professions.join(" · ")}</p>}
          <h1 className="mt-1 text-h1 text-text-1" lang={lang}>
            {p.name}
          </h1>
          {/* The facts with " · " between them (2.2), the label of each for a screen reader; the place as TMDB writes it,
              in English. */}
          {(p.birthday || p.deathday || p.placeOfBirth) && (
            <p className="mt-2 flex flex-wrap gap-x-2 text-body-s text-text-2 md:text-body">
              {(p.birthday || p.deathday) && (
                <span className={years !== null || p.placeOfBirth ? "after:ms-2 after:content-['·']" : undefined}>
                  {/* Each date whole on its line: "22 January / 2008" broke on a phone. */}
                  {p.birthday && (
                    <span className="whitespace-nowrap">
                      <span className="sr-only">{t("person.bornLabel")}: </span>
                      {date(p.birthday)}
                    </span>
                  )}
                  {p.birthday && p.deathday && " – "}
                  {p.deathday && (
                    <span className="whitespace-nowrap">
                      <span className="sr-only">{t("person.diedLabel")}: </span>
                      {date(p.deathday)}
                    </span>
                  )}
                </span>
              )}
              {years !== null && <span className={p.placeOfBirth ? "after:ms-2 after:content-['·']" : undefined}>{t("person.age", { count: years })}</span>}
              {p.placeOfBirth && (
                <span lang="en">
                  <span className="sr-only">{t("person.placeLabel")}: </span>
                  {p.placeOfBirth}
                </span>
              )}
            </p>
          )}
          {!bio && <PersonMuteSlot id={p.id} name={p.name} />}
        </div>
        {bio && (
          <div className="col-span-2 mt-4 min-w-0 md:col-span-1 md:col-start-2">
            <Bio text={bio} />
            <PersonMuteSlot id={p.id} name={p.name} />
          </div>
        )}
      </header>
      {best.length >= 3 && (
        <Row title={t("person.knownFor")} id="known">
          {best.map((c, i) => (
            <PosterCard key={c.id} title={c} subtitle={played(c)} priority={i < 6} />
          ))}
        </Row>
      )}
      <div className="mx-auto w-full max-w-media">
        <Filmography credits={rows} main={main} gender={gender} />
      </div>
      {links.length > 0 && (
        <section aria-labelledby="elsewhere-h" className="page-x mx-auto w-full max-w-media">
          <h2 id="elsewhere-h" className="text-h2 text-text-1">
            {t("title.externalLinks")}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noreferrer noopener" className={LINK}>
                  {l.site === "homepage" ? host(l.url) : (SITE_NAMES[l.site] ?? BRAND_NAMES[l.site as keyof typeof BRAND_NAMES])}
                  <ExternalLink aria-hidden className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** A site by its address, as the title page names a title's own site ("hanazawa-kana.com"). */
function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
