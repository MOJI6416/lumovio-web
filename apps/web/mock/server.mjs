#!/usr/bin/env node
// Lumovio mock API — lets the open-source web app run without the private backend.
//   node mock/server.mjs            (listens on :4000, or MOCK_PORT)
// Any email + password signs in. State lives in memory and resets on restart.
// Endpoints that only make sense with the real backend answer 501 "not_configured".
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { all, db, details, episodesOf, GENRES, isKidsSafe, seasonsOf } from "./data.mjs";

const PORT = Number(process.env.MOCK_PORT ?? 4000);
const COOKIE = "lumovio_mock_session";
const now = () => new Date().toISOString();

/* ── State ─────────────────────────────────────────────────────────────── */

const users = new Map(); // email → user
const sessions = new Map(); // token → { email, activeProfileId, createdAt }
const libraries = new Map(); // profileId → library
const connections = []; // { summary, auth, index: [] }
let preferences = {
  emailNotifications: false,
  discordNotifications: false,
  discordActivity: false,
  aiHistoryOptIn: false,
  discord: null,
};

function newProfile(name, isKids) {
  return {
    id: randomUUID(),
    name,
    avatar: isKids ? "bloom" : "aurora",
    isKids,
    maturity: isKids ? "kids" : "adult",
    hasPin: false,
    uiLocale: null,
    metadataLocale: null,
    region: null,
    audioLanguages: [],
    subtitleLanguages: [],
    voiceStudios: [],
    releaseQuality: "auto",
    spoilers: { stills: true, overviews: true, names: false },
    showAnime: true,
    handle: null,
    isPublic: false,
    createdAt: now(),
  };
}

function ensureUser(email, name) {
  let u = users.get(email);
  if (!u) {
    const display = name || email.split("@")[0];
    u = {
      id: randomUUID(),
      email,
      name: display,
      createdAt: now(),
      profiles: [newProfile(display, false), newProfile("Kids", true)],
    };
    users.set(email, u);
  }
  return u;
}

function lib(profileId) {
  let l = libraries.get(profileId);
  if (!l) {
    l = {
      watchlist: new Map(),
      favorites: new Map(),
      ratings: new Map(),
      lists: new Map(),
      progress: new Map(),
      seqs: new Map(),
      history: [],
      follows: new Set(),
    };
    libraries.set(profileId, l);
  }
  return l;
}

/* ── HTTP helpers ──────────────────────────────────────────────────────── */

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, code, message) => {
  throw new HttpError(status, code, message);
};

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function ctx(req) {
  const token = cookies(req)[COOKIE];
  const session = token ? sessions.get(token) : undefined;
  const user = session ? users.get(session.email) : undefined;
  const profile = user?.profiles.find((p) => p.id === session.activeProfileId) ?? null;
  return { token, session, user, profile };
}
function needUser(c) {
  if (!c.user) fail(401, "unauthorized", "Sign in first");
  return c.user;
}
function needProfile(c) {
  needUser(c);
  if (!c.profile) fail(409, "profile_required", "Pick a profile first");
  return c.profile;
}

/* ── Catalog ───────────────────────────────────────────────────────────── */

const visible = (c) => (c.profile?.isKids ? all().filter(isKidsSafe) : all());
const byId = (id) => db.titles.get(id) ?? fail(404, "not_found", "Title not found");
function allowed(c, t) {
  if (c.profile?.isKids && !isKidsSafe(t)) fail(403, "maturity_blocked", "Not available on this profile");
  return t;
}
function paged(items, page = 1, size = 20) {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  return {
    page,
    totalPages,
    totalResults: items.length,
    results: items.slice((page - 1) * size, page * size),
  };
}
const row = (key, titleKey, items, href = null) => ({ key, titleKey, href, items: items.slice(0, 20) });

function home(c) {
  const v = visible(c);
  const movies = v.filter((t) => t.kind === "movie");
  const tv = v.filter((t) => t.kind === "tv");
  const byRating = (a, b) => b.tmdbRating - a.tmdbRating;
  const byDate = (a, b) => b.releaseDate.localeCompare(a.releaseDate);
  return [
    row(
      "trending",
      "rows.trending",
      [...v].sort((a, b) => b.tmdbVotes - a.tmdbVotes),
    ),
    row(
      "popular_tv",
      "rows.popularSeries",
      tv.filter((t) => !t.isAnime),
      "/browse/tv",
    ),
    row(
      "anime",
      "rows.anime",
      tv.filter((t) => t.isAnime),
      "/browse/tv?anime=1",
    ),
    row("top_movies", "rows.topRatedMovies", [...movies].sort(byRating), "/browse/movie?sort=rating"),
    row("now_playing", "rows.inTheaters", [...movies].sort(byDate), "/browse/movie?sort=release_desc"),
  ].filter((r) => r.items.length > 0);
}

/** A section landing (Movies, Series, Anime): its best-known and best-rated titles, then a shelf per genre. */
function section(c, kind, anime) {
  if (!GENRES[kind]) fail(400, "bad_request", "Unknown kind");
  const items = visible(c).filter((t) => t.kind === kind && (kind === "movie" || t.isAnime === anime));
  const browse = kind === "movie" ? "/browse/movie" : anime ? "/browse/tv?anime=1" : "/browse/tv";
  const sep = browse.includes("?") ? "&" : "?";
  return [
    row("trending", "rows.trending", [...items].sort((a, b) => b.tmdbVotes - a.tmdbVotes), browse),
    row("top_rated", kind === "movie" ? "rows.topRatedMovies" : "rows.popularSeries", [...items].sort((a, b) => b.tmdbRating - a.tmdbRating), `${browse}${sep}sort=rating`),
    ...GENRES[kind].map((g) => ({
      ...row(`genre_${g.id}`, "rows.trending", items.filter((t) => t.genreIds.includes(g.id)), `${browse}${sep}genre=${g.id}`),
      title: g.name,
    })),
  ].filter((r) => r.items.length > 0);
}

/** The home page or a section landing (CatalogPage): a billboard from the first shelf; "watch now" has no copies here. */
function catalogPage(c, q, rows) {
  const now = q.get("watch") === "now" && c.profile !== null;
  return {
    mode: now ? "now" : "all",
    servers: c.profile ? connections.length : 0,
    featured: now ? [] : (rows[0]?.items ?? []).slice(0, 5).map((t) => ({ ...t, logo: null })),
    rows: now ? [] : rows,
  };
}

function discover(c, q) {
  const kind = q.get("kind") ?? "movie";
  const genres = (q.get("genres") ?? "").split(",").filter(Boolean).map(Number);
  const without = (q.get("withoutGenres") ?? "").split(",").filter(Boolean).map(Number);
  const from = Number(q.get("yearFrom") ?? 0);
  const to = Number(q.get("yearTo") ?? 9999);
  const ratingMin = Number(q.get("ratingMin") ?? 0);
  const anime = q.get("anime") === "1" || q.get("anime") === "true";
  let items = visible(c).filter(
    (t) =>
      t.kind === kind &&
      genres.every((g) => t.genreIds.includes(g)) &&
      !without.some((g) => t.genreIds.includes(g)) &&
      (t.year ?? 0) >= from &&
      (t.year ?? 0) <= to &&
      (t.tmdbRating ?? 0) >= ratingMin &&
      (!anime || t.isAnime),
  );
  const sort = q.get("sort") ?? "popularity";
  const cmp = {
    popularity: (a, b) => b.tmdbVotes - a.tmdbVotes,
    rating: (a, b) => b.tmdbRating - a.tmdbRating,
    release_desc: (a, b) => b.releaseDate.localeCompare(a.releaseDate),
    release_asc: (a, b) => a.releaseDate.localeCompare(b.releaseDate),
    title: (a, b) => a.title.localeCompare(b.title),
  }[sort];
  if (cmp) items = [...items].sort(cmp);
  return paged(items, Number(q.get("page") ?? 1));
}

function search(c, q) {
  const needle = (q.get("q") ?? "").trim().toLowerCase();
  if (!needle) fail(400, "bad_request", "Query is required");
  const titles = visible(c).filter((t) => t.title.toLowerCase().includes(needle));
  const people = c.profile?.isKids
    ? []
    : [...db.people.values()].filter((p) => p.name.toLowerCase().includes(needle)).slice(0, 8);
  return { titles: paged(titles, Number(q.get("page") ?? 1)), people };
}

function person(c, id) {
  if (c.profile?.isKids) fail(403, "maturity_blocked", "People pages are not available on this profile");
  const p = db.people.get(id) ?? fail(404, "not_found", "Person not found");
  const credits = all()
    .map((t) => {
      const d = details(t);
      const cast = d.cast.find((m) => m.id === id);
      const crew = d.crew.find((m) => m.id === id);
      return cast || crew ? { ...t, role: cast?.character ?? crew?.job ?? null } : null;
    })
    .filter(Boolean);
  return {
    ...p,
    biography: `${p.name} is a fictional person generated by the Lumovio mock API.`,
    birthday: null,
    deathday: null,
    placeOfBirth: null,
    knownForDepartment: p.knownFor,
    credits,
  };
}

/* ── Library ───────────────────────────────────────────────────────────── */

const pkey = (titleId, season, episode) => `${titleId}|${season ?? ""}|${episode ?? ""}`;

function state(profileId, titleId) {
  const l = lib(profileId);
  const progress =
    [...l.progress.values()]
      .filter((p) => p.titleId === titleId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  const watched = l.history.filter((h) => h.titleId === titleId);
  return {
    titleId,
    inWatchlist: l.watchlist.has(titleId),
    isFavorite: l.favorites.has(titleId),
    rating: l.ratings.get(titleId)?.value ?? null,
    listIds: [...l.lists.values()].filter((x) => x.items.has(titleId)).map((x) => x.id),
    progress,
    watchedCount: watched.length,
    lastWatchedAt:
      watched
        .map((h) => h.watchedAt)
        .sort()
        .at(-1) ?? null,
    watchedEpisodes: watched.filter((h) => h.season !== null).map((h) => `s${h.season}e${h.episode}`),
  };
}

function listSummary(profile, l) {
  const titles = [...l.items.keys()].map((id) => db.titles.get(id)).filter(Boolean);
  return {
    id: l.id,
    kind: l.kind,
    name: l.name,
    description: l.description ?? null,
    visibility: l.visibility ?? "private",
    collaborative: Boolean(l.collaborative),
    itemCount: titles.length,
    role: "owner",
    cover: titles.slice(0, 4).map((t) => t.posterPath),
    owner: { profileId: profile.id, name: profile.name, handle: profile.handle },
    updatedAt: l.updatedAt,
  };
}
function listDetails(profile, l) {
  return {
    ...listSummary(profile, l),
    items: [...l.items.entries()]
      .filter(([id]) => db.titles.has(id))
      .map(([id, addedAt]) => ({
        title: db.titles.get(id),
        note: null,
        addedAt,
        addedBy: { profileId: profile.id, name: profile.name },
      })),
    members: [{ profileId: profile.id, name: profile.name, avatar: profile.avatar, role: "owner" }],
  };
}
function systemList(profile, kind) {
  const l = lib(profile.id);
  return {
    id: `${kind}-${profile.id}`,
    kind,
    name: kind === "watchlist" ? "Watchlist" : "Favorites",
    items: l[kind],
    updatedAt: now(),
  };
}
function findList(profile, id) {
  if (id === `watchlist-${profile.id}`) return systemList(profile, "watchlist");
  if (id === `favorites-${profile.id}`) return systemList(profile, "favorites");
  return lib(profile.id).lists.get(id) ?? fail(404, "not_found", "List not found");
}

function addHistory(profileId, titleId, season, episode, watchedAt = now(), source = "lumovio") {
  const l = lib(profileId);
  if (l.history.some((h) => h.titleId === titleId && h.season === season && h.episode === episode)) return;
  l.history.push({ id: randomUUID(), titleId, season, episode, watchedAt, source });
}

function markWatched(profile, body) {
  const t = byId(body.titleId);
  const l = lib(profile.id);
  const scope = body.scope ?? "item";
  let targets = [[null, null]];
  if (t.kind === "tv" && scope !== "item") {
    const seasons =
      scope === "season" ? seasonsOf(t).filter((s) => s.seasonNumber === body.season) : seasonsOf(t);
    targets = seasons.flatMap((s) =>
      episodesOf(t, s.seasonNumber).map((e) => [s.seasonNumber, e.episodeNumber]),
    );
  } else if (t.kind === "tv" && body.season !== null && body.season !== undefined) {
    targets = [[body.season, body.episode]];
  }
  for (const [s, e] of targets) {
    if (body.watched === false)
      l.history = l.history.filter((h) => !(h.titleId === t.id && h.season === s && h.episode === e));
    else addHistory(profile.id, t.id, s, e, body.watchedAt ?? now(), "manual");
  }
  return state(profile.id, t.id);
}

function reportProgress(profile, b) {
  const l = lib(profile.id);
  const key = pkey(b.titleId, b.season, b.episode);
  const prev = l.seqs.get(key);
  if (prev && prev.session === b.playbackSessionId && b.seq <= prev.seq)
    return { accepted: false, progress: l.progress.get(key) };
  const dur = b.durationSec ?? null;
  const completed =
    b.event === "complete" || (dur ? b.positionSec / dur >= 0.92 || dur - b.positionSec < 240 : false);
  const p = {
    titleId: b.titleId,
    season: b.season ?? null,
    episode: b.episode ?? null,
    positionSec: b.positionSec,
    durationSec: dur,
    fraction: dur ? Math.min(1, b.positionSec / dur) : null,
    completed,
    updatedAt: now(),
    source: b.source ?? "lumovio",
  };
  l.progress.set(key, p);
  l.seqs.set(key, { session: b.playbackSessionId, seq: b.seq });
  if (completed) addHistory(profile.id, b.titleId, p.season, p.episode);
  return { accepted: true, progress: p };
}

function stats(profile) {
  const l = lib(profile.id);
  const genres = new Map();
  const months = new Map();
  const titles = new Map();
  let minutes = 0;
  for (const h of l.history) {
    const t = db.titles.get(h.titleId);
    if (!t) continue;
    minutes += db.runtime.get(t.id) ?? 45;
    for (const g of t.genreIds) genres.set(g, (genres.get(g) ?? 0) + 1);
    const m = new Date(h.watchedAt).getUTCMonth() + 1;
    months.set(m, (months.get(m) ?? 0) + 1);
    titles.set(t.id, (titles.get(t.id) ?? 0) + 1);
  }
  const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]);
  return {
    year: null,
    minutes,
    films: l.history.filter((h) => h.season === null && db.titles.get(h.titleId)?.kind === "movie").length,
    episodes: l.history.filter((h) => h.season !== null).length,
    series: new Set(l.history.filter((h) => h.season !== null).map((h) => h.titleId)).size,
    topGenres: top(genres)
      .slice(0, 8)
      .map(([id, count]) => ({ id, count })),
    byMonth: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: months.get(i + 1) ?? 0 })),
    topTitles: top(titles)
      .slice(0, 10)
      .map(([id, count]) => ({ title: db.titles.get(id), count })),
    firstWatch: l.history.map((h) => h.watchedAt).sort()[0] ?? null,
    longestStreakDays: l.history.length > 0 ? 1 : 0,
  };
}

function calendar(profile, q) {
  const l = lib(profile.id);
  const from = q.get("from") ?? now().slice(0, 10);
  const to = q.get("to") ?? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const tracked = new Set([...l.follows, ...[...l.watchlist.keys()].filter((id) => id.startsWith("tv:"))]);
  const events = [...tracked].map((id, i) => {
    const t = db.titles.get(id);
    const last = seasonsOf(t).at(-1);
    return {
      date: new Date(Date.now() + ((i * 3) % 21) * 864e5).toISOString().slice(0, 10),
      title: t,
      kind: "episode",
      season: (last?.seasonNumber ?? 0) + 1,
      episode: 1,
      episodeName: "Chapter 1",
      badge: "season_premiere",
    };
  });
  return { from, to, events: events.filter((e) => e.date >= from && e.date <= to) };
}

/* ── Routes ────────────────────────────────────────────────────────────── */

const routes = [];
const on = (method, pattern, handler) =>
  routes.push({ method, parts: pattern.split("/").filter(Boolean), handler });
// A handler that answered on `res` itself (the event stream) returns this.
const STREAM = Symbol("stream");

const browserOf = (ua) =>
  /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
const osOf = (ua) =>
  /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;

function match(method, path) {
  const segs = path.split("/").filter(Boolean).map(decodeURIComponent);
  for (const r of routes) {
    if (r.method !== method || r.parts.length !== segs.length) continue;
    if (!r.parts.every((p, i) => p.startsWith(":") || p === segs[i])) continue;
    const params = {};
    r.parts.forEach((p, i) => {
      if (p.startsWith(":")) params[p.slice(1)] = segs[i];
    });
    return { r, params };
  }
  return null;
}

const authUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  emailVerified: true,
  image: null,
  createdAt: u.createdAt,
  updatedAt: u.createdAt,
  role: "user",
  twoFactorEnabled: false,
});

function signIn(res, email, name) {
  const u = ensureUser(String(email).toLowerCase(), name);
  const token = randomUUID();
  sessions.set(token, { email: u.email, activeProfileId: null, createdAt: now() });
  res.setHeader("set-cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`);
  return { redirect: false, token, user: authUser(u) };
}

// Better Auth endpoints used by the web client.
on("POST", "/api/auth/sign-up/email", async ({ body, res }) => {
  if (!body.email || !body.password) fail(400, "bad_request", "Email and password are required");
  return signIn(res, body.email, body.name);
});
on("POST", "/api/auth/sign-in/email", async ({ body, res }) => {
  if (!body.email || !body.password) fail(400, "bad_request", "Email and password are required");
  return signIn(res, body.email);
});
on("POST", "/api/auth/sign-out", async ({ c, res }) => {
  if (c.token) sessions.delete(c.token);
  res.setHeader("set-cookie", `${COOKIE}=; Path=/; Max-Age=0`);
  return { success: true };
});
on("GET", "/api/auth/get-session", async ({ c }) =>
  c.user
    ? {
        session: {
          id: c.token,
          userId: c.user.id,
          activeProfileId: c.session.activeProfileId,
          expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
        },
        user: authUser(c.user),
      }
    : null,
);
on("POST", "/api/auth/request-password-reset", async () => ({ status: true }));
on("POST", "/api/auth/send-verification-email", async () => ({ status: true }));

on("GET", "/api/health", async () => ({ ok: true, mock: true }));
// Registration open, no maintenance, no announcements, no Lumovio Score (the admin sets them on the real backend).
on("GET", "/api/platform", async () => ({
  registration: "open",
  maintenance: { on: false, message: null },
  announcements: [],
  score: false,
}));
// The account's live updates (a TV hears them): the stream stays open and quiet here.
on("GET", "/api/events", async ({ c, req, res }) => {
  needUser(c);
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
  res.write(": mock\n\n");
  const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => clearInterval(ping));
  return STREAM;
});
on("GET", "/api/ready", async () => ({ ok: true, checks: { db: true, redis: true }, mock: true }));
on("GET", "/api/auth-capabilities", async () => ({
  emailPassword: true,
  google: false,
  apple: false,
  discord: false,
  turnstileSiteKey: null,
}));
on("GET", "/api/me", async ({ c }) => {
  const u = needUser(c);
  return {
    user: {
      id: u.id,
      email: u.email,
      emailVerified: true,
      name: u.name,
      role: "user",
      twoFactorEnabled: false,
      createdAt: u.createdAt,
    },
    activeProfile: c.profile,
    profiles: c.profile?.isKids ? u.profiles.filter((p) => p.isKids) : u.profiles,
    linkedProviders: ["credential"],
  };
});
on("GET", "/api/sessions", async ({ c, req }) => {
  needUser(c);
  return {
    sessions: [
      {
        id: c.token,
        current: true,
        userAgent: req.headers["user-agent"] ?? null,
        deviceLabel: "This browser (mock)",
        device: { client: "browser", browser: browserOf(req.headers["user-agent"] ?? ""), os: osOf(req.headers["user-agent"] ?? "") },
        ipCountry: null,
        createdAt: c.session.createdAt,
        lastSeenAt: now(),
      },
    ],
  };
});

// Profiles
on("POST", "/api/profiles", async ({ c, body }) => {
  const u = needUser(c);
  const p = { ...newProfile(body.name ?? "Profile", Boolean(body.isKids)), avatar: body.avatar ?? "aurora" };
  u.profiles.push(p);
  return p;
});
on("PATCH", "/api/profiles/:id", async ({ c, body, params }) => {
  const u = needUser(c);
  const p = u.profiles.find((x) => x.id === params.id) ?? fail(404, "not_found", "Profile not found");
  Object.assign(
    p,
    Object.fromEntries(
      Object.entries(body).filter(([k]) =>
        [
          "name",
          "avatar",
          "maturity",
          "uiLocale",
          "metadataLocale",
          "region",
          "audioLanguages",
          "subtitleLanguages",
        ].includes(k),
      ),
    ),
  );
  return p;
});
on("DELETE", "/api/profiles/:id", async ({ c, params }) => {
  const u = needUser(c);
  if (u.profiles.length <= 1) fail(409, "conflict", "The last profile can't be deleted");
  u.profiles = u.profiles.filter((p) => p.id !== params.id);
  return { ok: true };
});
on("PUT", "/api/profiles/:id/pin", async ({ c, body, params }) => {
  const p =
    needUser(c).profiles.find((x) => x.id === params.id) ?? fail(404, "not_found", "Profile not found");
  p.hasPin = Boolean(body.pin);
  return { ok: true };
});
on("POST", "/api/profiles/select", async ({ c, body }) => {
  const u = needUser(c);
  const target =
    u.profiles.find((p) => p.id === body.profileId) ?? fail(404, "not_found", "Profile not found");
  // Same rule as the real API: leaving a kids profile needs the target PIN, the account password or the mailed code.
  if (c.profile?.isKids && !target.isKids && !body.pin && !body.password && !body.code)
    fail(403, target.hasPin ? "pin_required" : "password_required", "Confirm to leave the kids profile");
  c.session.activeProfileId = target.id;
  return target;
});
// The mock mails nothing: any 6 digits pass above.
on("POST", "/api/profiles/select/code", async ({ c }) => {
  needUser(c);
  return { sent: true, resendAfter: 60 };
});
on("GET", "/api/preferences", async ({ c }) => {
  needUser(c);
  return preferences;
});
on("PUT", "/api/preferences", async ({ c, body }) => {
  needUser(c);
  preferences = { ...preferences, ...body };
  return { ok: true };
});
// Discord through a channel's webhook: the mock checks only the address's shape and never posts.
let discordUndo = null;
on("PUT", "/api/preferences/discord", async ({ c, body }) => {
  needUser(c);
  if (!/^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d{15,22}\/[\w-]{20,}$/.test(String(body?.url ?? "")))
    fail(400, "bad_request", "Not a Discord webhook address");
  preferences = { ...preferences, discord: { name: "Lumovio" }, discordNotifications: true };
  return { name: "Lumovio" };
});
on("DELETE", "/api/preferences/discord", async ({ c }) => {
  needUser(c);
  discordUndo = preferences.discord;
  preferences = { ...preferences, discord: null, discordNotifications: false };
  return { undoKey: discordUndo ? "mock" : null };
});
on("POST", "/api/preferences/discord/restore", async ({ c }) => {
  needUser(c);
  preferences = { ...preferences, discord: discordUndo, discordNotifications: Boolean(discordUndo) };
  return discordUndo ?? { name: "Lumovio" };
});
on("POST", "/api/preferences/discord/test", async ({ c }) => {
  needUser(c);
  return { ok: true };
});

// Catalog
on("GET", "/api/catalog/home", async ({ c, q }) => catalogPage(c, q, home(c)));
on("GET", "/api/catalog/section/:kind", async ({ c, q, params }) => catalogPage(c, q, section(c, params.kind, q.get("anime") === "1")));
on("GET", "/api/catalog/discover", async ({ c, q }) => discover(c, q));
on("GET", "/api/catalog/search", async ({ c, q }) => search(c, q));
on("GET", "/api/catalog/title/:kind/:id", async ({ c, params }) =>
  details(allowed(c, byId(`${params.kind}:${params.id}`))),
);
on("GET", "/api/catalog/tv/:id/season/:season", async ({ c, params }) => {
  const t = allowed(c, byId(`tv:${params.id}`));
  const s =
    seasonsOf(t).find((x) => x.seasonNumber === Number(params.season)) ??
    fail(404, "not_found", "Season not found");
  return { ...s, titleId: t.id, episodes: episodesOf(t, s.seasonNumber) };
});
// Third-party scores aren't mocked: the title page shows the TMDB-style score only.
on("GET", "/api/catalog/title/:kind/:id/external", async ({ params }) => ({
  titleId: `${params.kind}:${params.id}`,
  ratings: [],
  links: [],
  credits: [],
  updatedAt: null,
}));
on("GET", "/api/catalog/person/:id", async ({ c, params }) => person(c, Number(params.id)));
on("GET", "/api/catalog/genres/:kind", async ({ params }) => ({
  genres: GENRES[params.kind] ?? fail(400, "bad_request", "Unknown kind"),
}));
on("POST", "/api/catalog/resolve", async ({ body }) => ({
  resolved: Object.fromEntries((body.items ?? []).map((i) => [i.key, null])),
}));

// Library
on("GET", "/api/library/state", async ({ c, q }) => {
  const p = needProfile(c);
  return {
    states: (q.get("ids") ?? "")
      .split(",")
      .filter((id) => db.titles.has(id))
      .slice(0, 100)
      .map((id) => state(p.id, id)),
  };
});
for (const kind of ["watchlist", "favorites"]) {
  on("POST", `/api/library/${kind}`, async ({ c, body }) => {
    const p = needProfile(c);
    allowed(c, byId(body.titleId));
    if (body.on) lib(p.id)[kind].set(body.titleId, now());
    else lib(p.id)[kind].delete(body.titleId);
    return state(p.id, body.titleId);
  });
  on("GET", `/api/library/${kind}`, async ({ c }) => {
    const p = needProfile(c);
    return listDetails(p, systemList(p, kind));
  });
}
on("PUT", "/api/library/rating", async ({ c, body }) => {
  const p = needProfile(c);
  byId(body.titleId);
  if (body.value === null) lib(p.id).ratings.delete(body.titleId);
  else lib(p.id).ratings.set(body.titleId, { value: body.value, ratedAt: now() });
  return state(p.id, body.titleId);
});
on("GET", "/api/library/ratings", async ({ c }) => {
  const p = needProfile(c);
  return {
    ratings: [...lib(p.id).ratings.entries()].map(([id, r]) => ({
      title: db.titles.get(id),
      value: r.value,
      source: "personal",
      ratedAt: r.ratedAt,
    })),
  };
});
on("GET", "/api/library/title/:titleId", async ({ c, params }) => state(needProfile(c).id, params.titleId));

on("GET", "/api/lists", async ({ c }) => {
  const p = needProfile(c);
  return {
    lists: [systemList(p, "watchlist"), systemList(p, "favorites"), ...lib(p.id).lists.values()].map((l) =>
      listSummary(p, l),
    ),
  };
});
on("POST", "/api/lists", async ({ c, body }) => {
  const p = needProfile(c);
  const l = {
    id: randomUUID(),
    kind: "custom",
    name: body.name ?? "List",
    description: body.description ?? null,
    visibility: body.visibility ?? "private",
    collaborative: Boolean(body.collaborative),
    items: new Map(),
    updatedAt: now(),
  };
  lib(p.id).lists.set(l.id, l);
  return listSummary(p, l);
});
on("GET", "/api/lists/:id", async ({ c, params }) => {
  const p = needProfile(c);
  return listDetails(p, findList(p, params.id));
});
on("PATCH", "/api/lists/:id", async ({ c, body, params }) => {
  const p = needProfile(c);
  const l = findList(p, params.id);
  if (l.kind !== "custom") fail(409, "conflict", "System lists can't be edited");
  Object.assign(
    l,
    Object.fromEntries(
      Object.entries(body).filter(([k]) =>
        ["name", "description", "visibility", "collaborative"].includes(k),
      ),
    ),
    { updatedAt: now() },
  );
  return listDetails(p, l);
});
on("DELETE", "/api/lists/:id", async ({ c, params }) => {
  const p = needProfile(c);
  lib(p.id).lists.delete(params.id);
  return { ok: true };
});
on("POST", "/api/lists/:id/items", async ({ c, body, params }) => {
  const p = needProfile(c);
  byId(body.titleId);
  findList(p, params.id).items.set(body.titleId, now());
  return { ok: true };
});
on("DELETE", "/api/lists/:id/items/:titleId", async ({ c, params }) => {
  const p = needProfile(c);
  findList(p, params.id).items.delete(params.titleId);
  return { ok: true };
});

on("POST", "/api/progress", async ({ c, body }) => reportProgress(needProfile(c), body));
on("GET", "/api/progress/:titleId", async ({ c, params }) => ({
  progress: [...lib(needProfile(c).id).progress.values()].filter((p) => p.titleId === params.titleId),
}));
on("GET", "/api/continue", async ({ c }) => {
  const p = needProfile(c);
  const latest = new Map();
  for (const pr of [...lib(p.id).progress.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    if (!latest.has(pr.titleId)) latest.set(pr.titleId, pr);
  return {
    items: [...latest.values()]
      .filter((pr) => !pr.completed && db.titles.has(pr.titleId))
      .map((pr) => ({ title: db.titles.get(pr.titleId), progress: pr, next: null })),
  };
});
on("DELETE", "/api/continue/:titleId", async ({ c, params }) => {
  const l = lib(needProfile(c).id);
  for (const [k, v] of l.progress) if (v.titleId === params.titleId) l.progress.delete(k);
  return { ok: true };
});
on("POST", "/api/history/mark", async ({ c, body }) => markWatched(needProfile(c), body));
on("GET", "/api/history", async ({ c }) => {
  const l = lib(needProfile(c).id);
  const entries = [...l.history]
    .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))
    .map((h) => ({
      id: h.id,
      title: db.titles.get(h.titleId),
      season: h.season,
      episode: h.episode,
      episodeName: null,
      watchedAt: h.watchedAt,
      source: h.source,
    }));
  return { entries, nextBefore: null };
});
on("DELETE", "/api/history/:id", async ({ c, params }) => {
  const l = lib(needProfile(c).id);
  l.history = l.history.filter((h) => h.id !== params.id);
  return { ok: true };
});

// Insights
on("GET", "/api/calendar", async ({ c, q }) => calendar(needProfile(c), q));
on("POST", "/api/follow", async ({ c, body }) => {
  const l = lib(needProfile(c).id);
  if (body.on) l.follows.add(body.titleId);
  else l.follows.delete(body.titleId);
  return { following: Boolean(body.on) };
});
on("GET", "/api/follow/:titleId", async ({ c, params }) => ({
  following: lib(needProfile(c).id).follows.has(params.titleId),
}));
on("GET", "/api/notifications", async ({ c }) => {
  needUser(c);
  return { notifications: [], unread: 0 };
});
on("POST", "/api/notifications/read", async () => ({ ok: true }));
on("GET", "/api/stats", async ({ c }) => stats(needProfile(c)));
on("GET", "/api/ai/status", async () => ({ available: false }));
on("GET", "/api/imports/sources", async () => ({
  sources: ["trakt", "letterboxd", "imdb", "simkl", "netflix", "lampa", "stremio", "lumovio"].map(
    (source) => ({
      source,
      method: "file",
      available: false,
      accept: [".json", ".csv", ".zip"],
      helpKey: `import.help_${source}`,
    }),
  ),
  traktOauth: false,
}));
on("GET", "/api/imports", async () => ({ jobs: [] }));

// Media servers: the browser talks to them directly, the mock only stores what the client sends.
// Recently added to the profile's servers and arrived from its lists: the mock indexes no server.
on("GET", "/api/library/on-servers", async ({ c }) => {
  needProfile(c);
  return { items: [], wanted: [] };
});
on("GET", "/api/connections", async ({ c }) => {
  needUser(c);
  return { connections: connections.map((x) => x.summary) };
});
on("POST", "/api/connections", async ({ c, body }) => {
  needUser(c);
  const summary = {
    id: randomUUID(),
    kind: body.kind,
    name: body.name,
    baseUrl: String(body.baseUrl ?? "").replace(/\/+$/, ""),
    status: "unknown",
    statusDetail: null,
    lastCheckedAt: null,
    lastSyncedAt: null,
    itemCount: 0,
    settings: {
      syncProgressToServer: false,
      importWatchedFromServer: false,
      maxBitrateKbps: null,
      preferDirectPlay: true,
      ...(body.settings ?? {}),
    },
    profileIds: body.profileIds ?? c.user.profiles.map((p) => p.id),
    createdAt: now(),
  };
  connections.push({ summary, auth: body.auth, index: [] });
  return summary;
});
const conn = (id) =>
  connections.find((x) => x.summary.id === id) ?? fail(404, "not_found", "Connection not found");
on("PATCH", "/api/connections/:id", async ({ body, params }) => {
  const x = conn(params.id);
  Object.assign(
    x.summary,
    Object.fromEntries(
      Object.entries(body).filter(([k]) => ["name", "baseUrl", "settings", "profileIds"].includes(k)),
    ),
  );
  if (body.auth) x.auth = body.auth;
  return x.summary;
});
on("DELETE", "/api/connections/:id", async ({ params }) => {
  connections.splice(connections.indexOf(conn(params.id)), 1);
  return { ok: true };
});
on("GET", "/api/connections/:id/credentials", async ({ c, params }) => {
  needProfile(c);
  const x = conn(params.id);
  return { id: x.summary.id, baseUrl: x.summary.baseUrl, auth: x.auth };
});
on("POST", "/api/connections/:id/check", async ({ body, params }) => {
  Object.assign(conn(params.id).summary, {
    status: body.status,
    statusDetail: body.detail ?? null,
    lastCheckedAt: now(),
  });
  return { ok: true };
});
on("POST", "/api/connections/:id/index", async ({ body, params }) => {
  const x = conn(params.id);
  if (body.mode === "replace" && !x.scanning) x.index = [];
  x.scanning = body.final === false;
  x.index.push(...(body.entries ?? []));
  Object.assign(x.summary, { itemCount: new Set(x.index.map((e) => e.titleId)).size, lastSyncedAt: now() });
  return { stored: body.entries?.length ?? 0 };
});
const hashOf = (e) => e.externalId.split(":")[0].toLowerCase();
on("GET", "/api/connections/:id/index/torrents", async ({ params }) => {
  const byHash = new Map();
  for (const e of conn(params.id).index) {
    if (!byHash.has(hashOf(e))) byHash.set(hashOf(e), { hash: hashOf(e), links: [] });
    byHash.get(hashOf(e)).links.push({ titleId: e.titleId, season: e.season ?? null, episode: e.episode ?? null, externalId: e.externalId, label: e.label ?? null, quality: e.quality ?? null });
  }
  const torrents = [...byHash.values()];
  const ids = new Set(torrents.flatMap((t) => t.links.map((l) => l.titleId)));
  const titles = Object.fromEntries(all().filter((t) => ids.has(t.id)).map((t) => [t.id, { title: t.title, year: t.year, posterPath: t.posterPath }]));
  return { torrents, titles };
});
on("POST", "/api/connections/:id/index/forget", async ({ body, params }) => {
  const x = conn(params.id);
  const removed = Object.fromEntries((body.hashes ?? []).map((h) => [h.toLowerCase(), 0]));
  x.index = x.index.filter((e) => !(hashOf(e) in removed && ++removed[hashOf(e)]));
  x.summary.itemCount = new Set(x.index.map((e) => e.titleId)).size;
  return { removed };
});
on("GET", "/api/availability/:titleId", async ({ c, params }) => {
  const servers = c.profile
    ? connections.flatMap((x) =>
        x.index
          .filter((e) => e.titleId === params.titleId && e.season === null)
          .map((e) => ({
            connectionId: x.summary.id,
            kind: x.summary.kind,
            connectionName: x.summary.name,
            externalId: e.externalId,
            label: e.label,
            season: null,
            episode: null,
            quality: e.quality,
          })),
      )
    : [];
  return {
    servers,
    connections: c.profile ? connections.length : 0,
    sources: c.profile ? connections.map((x) => ({ id: x.summary.id, kind: x.summary.kind, name: x.summary.name, status: x.summary.status, indexed: true })) : [],
  };
});
on("GET", "/api/availability/:titleId/episode", async ({ c, params, q }) => {
  needProfile(c);
  const s = Number(q.get("s"));
  const e = Number(q.get("e"));
  return {
    items: connections.flatMap((x) =>
      x.index
        .filter((i) => i.titleId === params.titleId && i.season === s && i.episode === e)
        .map((i) => ({
          connectionId: x.summary.id,
          externalId: i.externalId,
          label: i.label,
          quality: i.quality,
        })),
    ),
  };
});
on("POST", "/api/playback/diagnostics", async () => ({ ok: true }));
on("POST", "/api/client-errors", async () => ({ ok: true }));
on("POST", "/api/reports", async () => ({ ok: true }));
on("POST", "/api/rights-notice", async () => ({ ok: true }));

/* ── Server ────────────────────────────────────────────────────────────── */

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://mock.local");
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  try {
    const m = match(req.method ?? "GET", url.pathname);
    if (!m && url.pathname.startsWith("/api/"))
      fail(501, "not_configured", `${req.method} ${url.pathname} isn't available in the mock API`);
    if (!m) fail(404, "not_found", "Not found");
    const body = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method ?? "") ? await readJson(req) : {};
    const out = await m.r.handler({ req, res, body, params: m.params, q: url.searchParams, c: ctx(req) });
    if (out !== STREAM) send(200, out);
  } catch (e) {
    if (e instanceof HttpError) send(e.status, { error: { code: e.code, message: e.message } });
    else {
      console.error(e);
      send(500, { error: { code: "internal", message: "Mock API error" } });
    }
  } finally {
    if (process.env.MOCK_LOG !== "0") console.log(`${req.method} ${url.pathname} → ${res.statusCode}`);
  }
}).listen(PORT, () => {
  console.log(
    `Lumovio mock API on http://localhost:${PORT} — any email/password signs in; data resets on restart.`,
  );
});
