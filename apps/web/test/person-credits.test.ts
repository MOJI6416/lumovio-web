import { describe, expect, it } from "vitest";
import { age, byYear, type Credit, character, countGroups, groupsOf, knownFor, mainGroup } from "../src/components/person/credits";

const credit = (id: string, x: Partial<Credit>): Credit => ({
  id,
  kind: "movie",
  tmdbId: Number(id.replace(/\D/g, "")) || 1,
  title: id,
  originalTitle: null,
  year: null,
  releaseDate: null,
  posterPath: "/p.jpg",
  backdropPath: null,
  overview: null,
  tmdbRating: null,
  tmdbVotes: null,
  genreIds: [],
  originalLanguage: null,
  isAnime: false,
  role: null,
  ...x,
});

describe("a person's filmography groups", () => {
  it("splits crew work by what they did, with TMDB's departments", () => {
    const inception = credit("movie:27205", {
      as: ["crew"],
      jobs: ["Producer", "Director", "Writer", "Thanks"],
      departments: { Producer: "Production", Director: "Directing", Writer: "Writing", Thanks: "Crew" },
    });
    expect(groupsOf(inception)).toEqual(["directing", "writing", "production"]);
    // An assistant director is crew work, not "Director"; a creator writes the series.
    expect(groupsOf(credit("tv:1", { as: ["crew"], jobs: ["First Assistant Director"], departments: { "First Assistant Director": "Directing" } }))).toEqual(["crew"]);
    expect(groupsOf(credit("tv:2", { as: ["crew"], jobs: ["Creator"], departments: { Creator: "Creator" } }))).toEqual(["writing"]);
    // A casting director in Production is not a producer.
    expect(groupsOf(credit("movie:3", { as: ["crew"], jobs: ["Casting"], departments: { Casting: "Production" } }))).toEqual(["crew"]);
  });

  it("leaves out a credit that is only thanks, and reads older answers by job name", () => {
    expect(groupsOf(credit("movie:4", { as: ["crew"], jobs: ["Thanks"], departments: { Thanks: "Crew" } }))).toEqual([]);
    expect(groupsOf(credit("movie:5", { as: ["crew"], jobs: ["Screenplay", "Executive Producer"] }))).toEqual(["writing", "production"]);
    expect(groupsOf(credit("movie:6", { role: "Walter" }))).toEqual(["acting"]);
    expect(groupsOf(credit("movie:7", {}))).toEqual(["crew"]);
  });

  it("opens on what they are known for, else on what they did most", () => {
    const counts = countGroups([
      credit("movie:1", { as: ["acting"] }),
      credit("movie:2", { as: ["crew"], jobs: ["Director"] }),
      credit("movie:3", { as: ["crew"], jobs: ["Director"] }),
      credit("tv:4", { as: ["self"] }),
    ]);
    expect(counts).toMatchObject({ acting: 1, directing: 2, self: 1 });
    expect(mainGroup({ knownForDepartment: "Acting" }, counts)).toBe("acting");
    expect(mainGroup({ knownForDepartment: "Writing" }, counts)).toBe("directing");
    expect(mainGroup({ knownForDepartment: null }, { ...counts, acting: 0, directing: 0 })).toBe("self");
  });
});

describe("known for", () => {
  it("takes an actor's real roles, not cameos and guest episodes", () => {
    const list = [
      credit("tv:1396", { kind: "tv", as: ["acting"], episodes: 62 }),
      credit("movie:857", { as: ["acting"], billing: 76 }),
      credit("tv:456", { kind: "tv", as: ["acting"], episodes: 1 }),
      credit("movie:64690", { as: ["acting"], billing: 2 }),
      credit("movie:9", { as: ["acting"], billing: 1, posterPath: null }),
    ];
    expect(knownFor(list, "acting").map((c) => c.id)).toEqual(["tv:1396", "movie:64690"]);
  });

  it("takes a director's films, not what they only produced", () => {
    const list = [
      credit("movie:209112", { as: ["crew"], jobs: ["Executive Producer"], departments: { "Executive Producer": "Production" } }),
      credit("movie:157336", { as: ["crew"], jobs: ["Director"], departments: { Director: "Directing" } }),
    ];
    expect(knownFor(list, "directing").map((c) => c.id)).toEqual(["movie:157336"]);
  });
});

describe("the rest of the page", () => {
  it("sorts newest first, titles without a date last", () => {
    const list = [credit("a", { releaseDate: "2008-01-20" }), credit("b", { releaseDate: null }), credit("c", { releaseDate: "2023-07-19" })];
    expect([...list].sort(byYear).map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("counts full years", () => {
    expect(age("1970-07-30", "2026-11-06")).toBe(56);
    expect(age("1956-03-07", "2026-03-06")).toBe(69);
    expect(age("1956-03-07", "2026-03-07")).toBe(70);
    expect(age(null, "2026-11-06")).toBeNull();
  });

  it("says a voice role and drops TMDB's '(uncredited)'", () => {
    expect(character("Mitsuri Kanroji (voice)")).toEqual({ name: "Mitsuri Kanroji", voice: true });
    expect(character("The President (voice) (uncredited)")).toEqual({ name: "The President", voice: true });
    expect(character("Walter White")).toEqual({ name: "Walter White", voice: false });
  });
});
