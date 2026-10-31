// Synthetic catalog for the mock API. Every title, person and text here is generated:
// no TMDB data is stored in this repository. The four Blender Foundation films are real
// (CC BY, playable from their official hosts) so the player can be developed offline.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ADJ = [
  "Silent",
  "Golden",
  "Last",
  "Hidden",
  "Northern",
  "Paper",
  "Crimson",
  "Electric",
  "Distant",
  "Quiet",
  "Broken",
  "Wild",
  "Glass",
  "Midnight",
  "Iron",
  "Velvet",
  "Hollow",
  "Bright",
];
const NOUN = [
  "Harbor",
  "Signal",
  "Orchard",
  "Frontier",
  "Archive",
  "Lantern",
  "Tide",
  "Circuit",
  "Garden",
  "Compass",
  "Summit",
  "Atlas",
  "Meridian",
  "Echo",
  "Harvest",
  "Station",
  "Kingdom",
  "River",
];
const FIRST = [
  "Ava",
  "Noah",
  "Mira",
  "Leo",
  "Yuki",
  "Omar",
  "Lena",
  "Ivan",
  "Sofia",
  "Kenji",
  "Amara",
  "Teo",
  "Nadia",
  "Elias",
  "Rin",
  "Maya",
];
const LAST = [
  "Hart",
  "Novak",
  "Sato",
  "Reyes",
  "Lund",
  "Okafor",
  "Brandt",
  "Moreau",
  "Kowalski",
  "Ito",
  "Silva",
  "Park",
  "Weber",
  "Costa",
];
const PLOT = [
  "A reluctant hero discovers that the town's oldest secret is about to resurface.",
  "Two strangers share a long night that changes both of their lives.",
  "An expedition to the edge of the map finds something that should not exist.",
  "A small family business becomes the center of an unexpected rivalry.",
  "When the signals stop, a lighthouse keeper must decide whom to trust.",
  "A gifted student uncovers a pattern hidden in a century of letters.",
];

export const GENRES = {
  movie: [
    { id: 28, name: "Action" },
    { id: 12, name: "Adventure" },
    { id: 16, name: "Animation" },
    { id: 35, name: "Comedy" },
    { id: 80, name: "Crime" },
    { id: 99, name: "Documentary" },
    { id: 18, name: "Drama" },
    { id: 10751, name: "Family" },
    { id: 14, name: "Fantasy" },
    { id: 27, name: "Horror" },
    { id: 9648, name: "Mystery" },
    { id: 10749, name: "Romance" },
    { id: 878, name: "Science Fiction" },
    { id: 53, name: "Thriller" },
  ],
  tv: [
    { id: 10759, name: "Action & Adventure" },
    { id: 16, name: "Animation" },
    { id: 35, name: "Comedy" },
    { id: 80, name: "Crime" },
    { id: 18, name: "Drama" },
    { id: 10751, name: "Family" },
    { id: 10762, name: "Kids" },
    { id: 9648, name: "Mystery" },
    { id: 10765, name: "Sci-Fi & Fantasy" },
  ],
};
const KIDS_GENRES = new Set([16, 10751, 10762]);

function summary(kind, tmdbId, title, year, r, extra = {}) {
  const pool = GENRES[kind];
  const genreIds = [
    ...new Set([pool[Math.floor(r() * pool.length)].id, pool[Math.floor(r() * pool.length)].id]),
  ];
  const month = String(1 + Math.floor(r() * 12)).padStart(2, "0");
  return {
    id: `${kind}:${tmdbId}`,
    kind,
    tmdbId,
    title,
    originalTitle: null,
    year,
    releaseDate: `${year}-${month}-15`,
    posterPath: null,
    backdropPath: null,
    overview: PLOT[Math.floor(r() * PLOT.length)],
    tmdbRating: Math.round((5 + r() * 4) * 10) / 10,
    tmdbVotes: Math.floor(50 + r() * 20000),
    genreIds,
    originalLanguage: "en",
    isAnime: false,
    ...extra,
  };
}

const BLENDER = [
  {
    tmdbId: 10378,
    title: "Big Buck Bunny",
    year: 2008,
    runtime: 10,
    overview: "A giant, gentle rabbit takes comic revenge on three forest bullies.",
  },
  {
    tmdbId: 45745,
    title: "Sintel",
    year: 2010,
    runtime: 15,
    overview: "A young woman searches a harsh world for the baby dragon she once rescued.",
  },
  {
    tmdbId: 9761,
    title: "Elephants Dream",
    year: 2006,
    runtime: 11,
    overview: "Two men explore a strange, ever-changing mechanical world.",
  },
  {
    tmdbId: 133701,
    title: "Tears of Steel",
    year: 2012,
    runtime: 12,
    overview: "In a future Amsterdam, scientists try to undo a breakup that endangered the world.",
  },
];

function build() {
  const r = rng(20261022);
  const titles = new Map();
  const runtime = new Map();
  for (const b of BLENDER) {
    const s = summary("movie", b.tmdbId, b.title, b.year, r, {
      overview: b.overview,
      genreIds: [16, 14],
      tmdbRating: 6.8,
      tmdbVotes: 1200,
    });
    titles.set(s.id, s);
    runtime.set(s.id, b.runtime);
  }
  for (let i = 0; i < 60; i++) {
    const name = `The ${ADJ[i % ADJ.length]} ${NOUN[(i * 7) % NOUN.length]}`;
    const s = summary("movie", 9_000_001 + i, name, 1985 + Math.floor(r() * 41), r);
    titles.set(s.id, s);
    runtime.set(s.id, 85 + Math.floor(r() * 70));
  }
  for (let i = 0; i < 30; i++) {
    const anime = i % 3 === 0;
    const name = anime
      ? `${NOUN[(i * 5) % NOUN.length]} no ${ADJ[(i * 3) % ADJ.length]}`
      : `${ADJ[(i * 5 + 3) % ADJ.length]} ${NOUN[(i * 3 + 1) % NOUN.length]}`;
    const extra = anime ? { isAnime: true, originalLanguage: "ja", genreIds: [16, 10765] } : {};
    const s = summary("tv", 9_100_001 + i, name, 2005 + Math.floor(r() * 21), r, extra);
    titles.set(s.id, s);
    runtime.set(s.id, 24 + Math.floor(r() * 36));
  }
  const people = new Map();
  for (let i = 0; i < 40; i++) {
    const id = 8_000_001 + i;
    people.set(id, {
      id,
      name: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
      profilePath: null,
      knownFor: i % 5 === 0 ? "Directing" : "Acting",
    });
  }
  return { titles, runtime, people, r };
}

export const db = build();
export const all = () => [...db.titles.values()];
export const isKidsSafe = (t) => t.genreIds.some((g) => KIDS_GENRES.has(g));

function hash(s) {
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return h >>> 0;
}

/** Seasons are derived from the id so every request returns the same show. */
export function seasonsOf(t) {
  if (t.kind !== "tv") return [];
  const r = rng(hash(t.id));
  const n = 1 + Math.floor(r() * 4);
  return Array.from({ length: n }, (_, i) => {
    const episodeCount = 6 + Math.floor(r() * 5);
    return {
      seasonNumber: i + 1,
      name: `Season ${i + 1}`,
      episodeCount,
      airDate: `${(t.year ?? 2020) + i}-03-01`,
      posterPath: null,
      overview: null,
    };
  });
}

export function episodesOf(t, season) {
  const s = seasonsOf(t).find((x) => x.seasonNumber === season);
  if (!s) return null;
  const start = new Date(`${s.airDate}T00:00:00Z`);
  return Array.from({ length: s.episodeCount }, (_, i) => ({
    id: t.tmdbId * 1000 + season * 100 + i + 1,
    seasonNumber: season,
    episodeNumber: i + 1,
    name: `Chapter ${i + 1}`,
    overview: PLOT[(i + season) % PLOT.length],
    airDate: new Date(start.getTime() + i * 7 * 864e5).toISOString().slice(0, 10),
    runtime: db.runtime.get(t.id) ?? 45,
    stillPath: null,
    tmdbRating: 7.5,
  }));
}

export function details(t) {
  const r = rng(hash(t.id) ^ 0x5bd1e995);
  const people = [...db.people.values()];
  // Distinct people: stride 3 over 40 never repeats within the 8 cast slots, and the
  // director's offset (25) is never one of the cast offsets.
  const start = Math.floor(r() * people.length);
  const cast = Array.from({ length: 8 }, (_, i) => ({
    ...people[(start + i * 3) % people.length],
    character: FIRST[(i * 5) % FIRST.length],
    order: i,
  }));
  const director = people[(start + 25) % people.length];
  const seasons = seasonsOf(t);
  const genres = GENRES[t.kind].filter((g) => t.genreIds.includes(g.id));
  const related = all()
    .filter((x) => x.id !== t.id && x.kind === t.kind && x.genreIds.some((g) => t.genreIds.includes(g)))
    .slice(0, 12);
  const lastSeason = seasons.at(-1);
  return {
    ...t,
    tagline: null,
    runtime: db.runtime.get(t.id) ?? null,
    status: t.kind === "tv" ? "Returning Series" : "Released",
    genres,
    countries: ["US"],
    spokenLanguages: [t.originalLanguage ?? "en"],
    certification: isKidsSafe(t) ? "PG" : "PG-13",
    homepage: null,
    externalIds: { imdb: null, tvdb: null, wikidata: null },
    cast,
    crew: [
      {
        ...director,
        job: t.kind === "tv" ? "Executive Producer" : "Director",
        department: t.kind === "tv" ? "Production" : "Directing",
      },
    ],
    creators: t.kind === "tv" ? [director] : [],
    videos: [],
    related,
    relatedOther: [],
    collection: null,
    seasons,
    nextEpisode: null,
    lastEpisode: lastSeason ? (episodesOf(t, lastSeason.seasonNumber)?.at(-1) ?? null) : null,
    numberOfSeasons: t.kind === "tv" ? seasons.length : null,
    numberOfEpisodes: t.kind === "tv" ? seasons.reduce((n, s) => n + s.episodeCount, 0) : null,
    networks: [],
    keywords: [],
    watchProviders: null,
    logo: null,
  };
}
