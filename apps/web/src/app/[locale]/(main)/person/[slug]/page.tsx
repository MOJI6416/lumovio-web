import type { PersonDetails } from "@lumovio/contracts";
import { User } from "lucide-react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { PosterCard } from "@/components/media/PosterCard";
import { Row } from "@/components/media/Row";
import { Bio } from "@/components/person/Bio";
import { Filmography } from "@/components/person/Filmography";
import { PersonMuteSlot } from "@/components/person/PersonMuteSlot";
import { MaturityBlocked } from "@/components/title/MaturityBlocked";
import { ApiRequestError } from "@/lib/api";
import { OG_IMAGE } from "@/lib/brand";
import { formatDate } from "@/lib/format";
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

const DEPTS = ["Acting", "Directing", "Writing", "Production", "Sound", "Camera", "Editing", "Art", "Visual Effects", "Costume & Make-Up", "Lighting", "Crew"];
// TMDB's decorations in biographies ("💥", "🏆") are left out (PER-02).
const EMOJI = /\p{Extended_Pictographic}️?/gu;

/** "Known for": their best-known work in what they are known for — not the start of the filmography (sorted by year). */
function knownFor(p: PersonDetails) {
  const acting = p.knownForDepartment === "Acting";
  return p.credits.filter((c) => (acting ? (c.as ?? ["acting"]).includes("acting") : (c.as ?? ["crew"]).includes("crew"))).slice(0, 12);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  // Metadata only: a page that fails to load says so itself.
  const p = await optional(load(slug), null);
  if (!p || p === "blocked") return {};
  // A link preview is landscape (11.3, SH-13): a frame from what they are known for, else the brand image — not the
  // portrait photo, which a preview crops to a strip of face.
  const frame = tmdbImage(knownFor(p).find((c) => c.backdropPath)?.backdropPath, "w1280");
  const path = personHref(p.id);
  return {
    title: p.name,
    description: p.biography?.replace(EMOJI, "").trim().slice(0, 200) || undefined,
    alternates: seoAlternates(locale, path),
    openGraph: { ...ogBase(locale, path), type: "profile", images: [frame ? { url: frame, width: 1280, height: 720 } : OG_IMAGE] },
  };
}

/**
 * A person (design-system 9 Media, S08; PER-01, PER-02): the photo, or the person icon on --surface-2 without one; what
 * they are known for as a word ("Actor", not "Acting"), the name, birth and death; the biography in six lines with
 * "More"; "Known for" — the best-known titles — and the filmography with its filter and sort. Data TMDB gives only in
 * English (the place of birth) is marked `lang="en"` (8.11). A kids profile sees only the titles it may open.
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
  const img = tmdbImage(p.profilePath, "h632");
  const deptIndex = p.knownForDepartment ? DEPTS.indexOf(p.knownForDepartment) : -1;
  const dept = deptIndex >= 0 ? t(`person.dept${deptIndex}` as "person.dept0") : p.knownForDepartment;
  const acting = p.knownForDepartment === "Acting";
  const known = knownFor(p);
  const bio = p.biography?.replace(EMOJI, "").replace(/[ \t]+\n/g, "\n").trim() || null;
  return (
    <div className="pt-24 md:pt-28">
      <div className="page-x mx-auto grid max-w-media gap-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-12 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="mx-auto w-40 md:mx-0 md:w-full">
          <div className="grid aspect-2/3 place-items-center overflow-hidden rounded-sm bg-surface-2 text-text-3">
            {img ? <img src={img} alt={p.name} className="size-full object-cover" /> : <User aria-hidden className="size-16" />}
          </div>
        </div>
        <div className="min-w-0 max-md:text-center">
          {dept && <p className="text-body-s font-semibold text-text-2">{dept}</p>}
          <h1 className="mt-1 text-h1 text-text-1">{p.name}</h1>
          <p className="mt-3 flex flex-wrap gap-x-2 text-body-s text-text-2 max-md:justify-center md:text-body">
            {/* " · " between the facts (2.2), ending the fact before it so a wrapped line never starts with one; the
                place of birth is as TMDB gives it, in English. */}
            {p.birthday && (
              <span className={p.placeOfBirth || p.deathday ? "after:ms-2 after:content-['·']" : undefined}>
                {t("person.born", { date: formatDate(p.birthday, locale, { dateStyle: "long" }) ?? p.birthday })}
              </span>
            )}
            {p.placeOfBirth && (
              <span lang="en" className={p.deathday ? "after:ms-2 after:content-['·']" : undefined}>
                {p.placeOfBirth}
              </span>
            )}
            {p.deathday && <span>{t("person.died", { date: formatDate(p.deathday, locale, { dateStyle: "long" }) ?? p.deathday })}</span>}
          </p>
          <PersonMuteSlot id={p.id} name={p.name} />
          <section className="mt-6 max-md:text-start" aria-labelledby="bio-h">
            <h2 id="bio-h" className="mb-2 text-h3 text-text-1">
              {t("person.biography")}
            </h2>
            {bio ? <Bio text={bio} /> : <p className="text-body text-text-2">{t("person.noBio")}</p>}
          </section>
        </div>
      </div>
      {known.length >= 3 && (
        <div className="mt-12">
          <Row title={t("person.knownFor")} id="known">
            {known.map((c) => (
              <PosterCard key={c.id} title={c} />
            ))}
          </Row>
        </div>
      )}
      <div className="mx-auto mt-12 max-w-media">
        <Filmography credits={p.credits} main={acting ? "acting" : "crew"} />
      </div>
    </div>
  );
}
