import type { PersonDetails } from "@lumovio/contracts";

/*
 * A person's credits sorted for their page: by what they did — acted, directed,
 * wrote, produced, other crew work, or appeared as themselves — the way IMDb, Letterboxd and Kinopoisk split a
 * filmography, never "Crew" as one heap where a director's films sat among the ones they only produced.
 */

export type Credit = PersonDetails["credits"][number];
/** What the filmography's rows need of a credit (the page sends no more to the browser: no overviews, no backdrops). */
export type RowCredit = Pick<
  Credit,
  "id" | "kind" | "tmdbId" | "title" | "year" | "releaseDate" | "posterPath" | "isAnime" | "imdbRating" | "tmdbRating" | "lumovioScore" | "role" | "as" | "jobs" | "departments" | "characters" | "episodes"
>;
type Roles = Pick<Credit, "role" | "as" | "jobs" | "departments">;
export type Group = "acting" | "directing" | "writing" | "production" | "crew" | "self";

/** The order of the filmography's filters and of the professions under the name. */
export const GROUPS: Group[] = ["acting", "directing", "writing", "production", "crew", "self"];

/** Directing is the director's chair, not the assistants and the script supervisor in TMDB's department. */
const DIRECTING = new Set(["Director", "Co-Director", "Series Director"]);
/** TMDB's "Thanks" is a line in the credits, not work on the title. */
const NOT_WORK = new Set(["Thanks", "Special Thanks"]);
/** Without TMDB's departments (an older answer, the mock API): the writing jobs by name. */
const WRITING = /^(Screenplay|Writer|Story|Novel|Characters|Teleplay|Creator|Author|Book|Original Story)$/;

/** The group of one crew job. */
export function jobGroup(job: string, department: string | undefined): Exclude<Group, "acting" | "self"> | null {
  if (NOT_WORK.has(job)) return null;
  if (DIRECTING.has(job)) return "directing";
  if (department ? department === "Writing" || department === "Creator" : WRITING.test(job)) return "writing";
  if ((department === undefined || department === "Production") && /Producer/.test(job)) return "production";
  return "crew";
}

/** The groups a credit belongs to (an older answer without `as` counts as acting with a character, else crew). */
export function groupsOf(c: Roles): Group[] {
  const as = c.as ?? [c.role ? "acting" : "crew"];
  const out = new Set<Group>();
  if (as.includes("acting")) out.add("acting");
  if (as.includes("crew")) {
    const jobs = c.jobs ?? [];
    if (jobs.length === 0) out.add("crew");
    for (const j of jobs) {
      const g = jobGroup(j, c.departments?.[j]);
      if (g) out.add(g);
    }
  }
  if (as.includes("self")) out.add("self");
  return GROUPS.filter((g) => out.has(g));
}

/** The crew jobs of a credit in one group (its role there: "Screenplay, Story"). */
export const jobsIn = (c: Roles, g: Group): string[] => (c.jobs ?? []).filter((j) => jobGroup(j, c.departments?.[j]) === g);

export function countGroups(credits: Roles[]): Record<Group, number> {
  const n = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>;
  for (const c of credits) for (const g of groupsOf(c)) n[g] += 1;
  return n;
}

const DEPT_GROUP: Record<string, Group> = { Acting: "acting", Directing: "directing", Writing: "writing", Production: "production" };

/**
 * What the person is known for, as a group: TMDB's department when they have work in it, else the group with the most
 * (appearances as themselves only when there is nothing else) — Nolan's page opens on "Director", Cranston's on "Actor".
 */
export function mainGroup(p: Pick<PersonDetails, "knownForDepartment">, counts: Record<Group, number>): Group | null {
  const known = p.knownForDepartment ? (DEPT_GROUP[p.knownForDepartment] ?? "crew") : null;
  if (known && counts[known] > 0) return known;
  const work = GROUPS.filter((g) => g !== "self" && counts[g] > 0).sort((a, b) => counts[b] - counts[a]);
  return work[0] ?? (counts.self > 0 ? "self" : null);
}

/**
 * "Known for": the best-known titles (credits come most voted first) in what they are known for, with a poster — and for
 * an actor a real role: in a film within the first 16 of its billing, in a series three episodes or more (a cameo in
 * "Saving Private Ryan" at 76th, one episode of "The Simpsons" are not what Cranston is known for).
 */
export function knownFor(credits: Credit[], main: Group | null, max = 15): Credit[] {
  if (!main) return [];
  const real = (c: Credit) => main !== "acting" || (c.kind === "movie" ? (c.billing ?? 0) <= 15 : (c.episodes ?? 3) >= 3);
  return credits.filter((c) => c.posterPath && groupsOf(c).includes(main) && real(c)).slice(0, max);
}

/**
 * Newest first, the same year by date; titles without a date last — mostly announced projects without a poster, they
 * would open the list with rows of nothing (Cranston's had four).
 */
export const byYear = (a: Pick<Credit, "releaseDate">, b: Pick<Credit, "releaseDate">) => (b.releaseDate || "0").localeCompare(a.releaseDate || "0");

/** Full years between two ISO dates (YYYY-MM-DD), or null. */
export function age(birthday: string | null, until: string): number | null {
  const b = birthday?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const u = until.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!b || !u) return null;
  const years = Number(u[1]) - Number(b[1]) - (`${u[2]}${u[3]}` < `${b[2]}${b[3]}` ? 1 : 0);
  return years >= 0 && years < 130 ? years : null;
}

/** "Kanroji (voice)" → the name and whether it is a voice role; "(uncredited)" is dropped (TMDB's English notes). */
export function character(raw: string): { name: string; voice: boolean } {
  const voice = /\((?:[^)]*\b)?voice\)/i.test(raw);
  const name = raw
    .replace(/\s*\((?:[^)]*\b)?voice\)/gi, "")
    .replace(/\s*\(uncredited\)/gi, "")
    .trim();
  return { name, voice };
}
