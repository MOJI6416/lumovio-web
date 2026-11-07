import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { interfaceAcceptLanguage, LOCALE_CODES, pickInterfaceLocale, removedLocaleRedirect } from "./i18n/locales";
import { routing } from "./i18n/routing";
import { ON_MY_SERVERS_HREF } from "./lib/on-my-servers";
import { isTvMode, TV_COOKIE, TV_PATH_HEADER, TV_SHELL_HEADER, tvShellPath } from "./lib/tv";

const intl = createMiddleware(routing);

/** Public profile vanity URLs: /@handle and /uk/@handle → the /u/[handle] route. */
const VANITY = /^(?:\/([a-zA-Z-]{2,5}))?\/@([a-zA-Z0-9_]{3,24})\/?$/;

/** The home page and the catalog sections in any language: with `?watch=now`, the old addresses of "Watch now". */
const WATCH_NOW_PAGE = new RegExp(`^(?:/(${LOCALE_CODES.join("|")}))?(?:/browse/(?:movie|tv)|/anime)?/?$`);

/** Alternate and former hosts (www, the old staging domain) permanently redirect to the site URL. */
const CANONICAL = process.env.SITE_URL ? new URL(process.env.SITE_URL) : null;
const REDIRECT_HOSTS = new Set(
  (process.env.REDIRECT_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

/** The API inside the deployment (as server-api.ts reaches it). */
const INTERNAL = process.env.API_INTERNAL_URL ?? process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";
let maintenance = { at: 0, on: false };

/**
 * Maintenance (Admin → Management → Settings): asked of the API at most every 15 s; an API that doesn't answer in time
 * isn't maintenance (its own error pages say so).
 */
async function inMaintenance() {
  if (Date.now() - maintenance.at < 15_000) return maintenance.on;
  try {
    const res = await fetch(`${INTERNAL}/api/platform`, { signal: AbortSignal.timeout(1500) });
    maintenance = { at: Date.now(), on: res.ok && Boolean(((await res.json()) as { maintenance?: { on?: boolean } }).maintenance?.on) };
  } catch {
    maintenance = { at: Date.now(), on: false };
  }
  return maintenance.on;
}

const isLocale = (s: string | undefined): s is (typeof LOCALE_CODES)[number] => Boolean(s) && (LOCALE_CODES as readonly string[]).includes(s!);

/**
 * Next answers 400 to a path whose segments don't survive decoding twice ("/ru/u/%25"). Such an address
 * is simply unknown: it gets the branded 404 at the same URL (SH-01).
 */
function undecodable(pathname: string): boolean {
  try {
    decodeURIComponent(decodeURIComponent(pathname));
    return false;
  } catch {
    return true;
  }
}

/**
 * Locale detection by browser language only considers finished translations (L10N-02): a first visit
 * from a de-DE or ar-EG browser gets English (or ru/uk when the browser lists them too), not a draft.
 * The address (/de/…) and a saved choice (cookie) still win, as before.
 */
function withInterfaceLanguages(req: NextRequest): NextRequest {
  if (req.method !== "GET" && req.method !== "HEAD") return req;
  if (isLocale(req.cookies.get("lumovio_locale")?.value)) return req;
  const header = req.headers.get("accept-language");
  if (!header) return req;
  const narrowed = interfaceAcceptLanguage(header);
  if (narrowed === header) return req;
  const headers = new Headers(req.headers);
  // Nothing left means the default; an empty header would make next-intl pin that default in a cookie.
  headers.set("accept-language", narrowed || routing.defaultLocale);
  return new NextRequest(req.url, { method: req.method, headers });
}

const DEV = process.env.NODE_ENV === "development";

/**
 * The pages' Content-Security-Policy for scripts (TV document §11.1 «Смешанный контент»: the TV app lets the page reach
 * `http://` servers at home, which is safe only while no script but the site's own can run). A script runs only with
 * this response's nonce — Next reads it from the request's header and puts it on its own scripts, the theme script
 * takes it from `x-nonce` — or when such a script loads it ('strict-dynamic': Next's chunks, Cloudflare Turnstile on
 * the sign-in, sign-up, password reset and support forms). WebAssembly may compile (the player's decoders and
 * rebuild), workers come from the site or a blob (hls.js, JASSUB, the codec workers, the service worker). The rest stays
 * open on purpose: posters and art come from TMDB and services, media from servers the person chose (any host, `http`
 * at home), trailers and the Spotify player are frames. 'self' and Turnstile's host only count in a browser without
 * 'strict-dynamic' (Chromium before 52); development adds 'unsafe-eval' for React's error overlay.
 */
function csp(nonce: string) {
  return [
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' https://challenges.cloudflare.com${DEV ? " 'unsafe-eval'" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

/** A page's response gets its own nonce and the policy above; a redirect has no page to protect. */
function secure(req: NextRequest, res: NextResponse): NextResponse {
  if (res.headers.get("location")) return res;
  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  passHeaders(req, res, { "content-security-policy": policy, "x-nonce": nonce });
  res.headers.set("content-security-policy", policy);
  return res;
}

export default async function proxy(req: NextRequest) {
  return secure(req, await route(req));
}

async function route(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0]!.toLowerCase();
  if (CANONICAL && REDIRECT_HOSTS.has(host)) {
    return NextResponse.redirect(new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, CANONICAL), 308);
  }
  // Every page of the site shows the maintenance page at its own address while maintenance is on.
  if (await inMaintenance()) {
    const prefix = req.nextUrl.pathname.split("/")[1];
    const saved = req.cookies.get("lumovio_locale")?.value;
    const locale = isLocale(prefix) ? prefix : isLocale(saved) ? saved : pickInterfaceLocale(req.headers.get("accept-language"));
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/maintenance`;
    url.search = "";
    return NextResponse.rewrite(url, { status: 503, headers: { "retry-after": "300", "cache-control": "no-store" } });
  }
  if (undecodable(req.nextUrl.pathname)) {
    const prefix = req.nextUrl.pathname.split("/")[1];
    const saved = req.cookies.get("lumovio_locale")?.value;
    const locale = isLocale(prefix) ? prefix : isLocale(saved) ? saved : pickInterfaceLocale(req.headers.get("accept-language"));
    const url = req.nextUrl.clone();
    // A path no route claims: app/[locale]/[...rest] answers with the 404 page.
    url.pathname = `/${locale}/not-found`;
    url.search = "";
    return NextResponse.rewrite(url);
  }
  // English has no prefix (localePrefix "as-needed"): /en/… moves there for good — next-intl's own redirect is a
  // temporary 307, which keeps search engines on the old address (Search Console, 2026-10-29). The choice of English
  // is kept in the locale cookie, as next-intl does, so the unprefixed address doesn't send the visitor elsewhere.
  if (req.nextUrl.pathname === "/en" || req.nextUrl.pathname.startsWith("/en/")) {
    const url = req.nextUrl.clone();
    url.pathname = req.nextUrl.pathname.slice(3) || "/";
    const res = NextResponse.redirect(url, 308);
    res.cookies.set("lumovio_locale", "en", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }
  const removed = removedLocaleRedirect(req.nextUrl.pathname, req.cookies.get("lumovio_locale")?.value);
  if (removed) {
    const url = req.nextUrl.clone();
    url.pathname = removed.path;
    const res = NextResponse.redirect(url, 308);
    if (removed.pinEnglish) res.cookies.set("lumovio_locale", "en", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }
  // "Watch now" lives in the library since 2026-11-07: people's bookmarks of its old pages lead there.
  const old = req.nextUrl.searchParams.get("watch") === "now" ? WATCH_NOW_PAGE.exec(req.nextUrl.pathname) : null;
  if (old) {
    const url = req.nextUrl.clone();
    // The section's address may carry a query (`/library?tab=servers`): its path and its query, not a path with "?".
    const to = new URL(ON_MY_SERVERS_HREF, url);
    url.pathname = `${old[1] ? `/${old[1]}` : ""}${to.pathname}`;
    url.search = to.search;
    return NextResponse.redirect(url, 307);
  }
  const m = VANITY.exec(req.nextUrl.pathname);
  if (m) {
    const prefix = m[1] && (LOCALE_CODES as readonly string[]).includes(m[1]) ? m[1] : null;
    const cookie = req.cookies.get("lumovio_locale")?.value;
    const locale = prefix ?? (cookie && (LOCALE_CODES as readonly string[]).includes(cookie) ? cookie : routing.defaultLocale);
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/u/${m[2]!.toLowerCase()}`;
    return NextResponse.rewrite(url);
  }
  return tvShell(req, intl(withInterfaceLanguages(req)));
}

/** Adds request headers to a middleware response, keeping the ones next-intl already passes on. */
function passHeaders(req: NextRequest, res: NextResponse, add: Record<string, string>) {
  const listed = res.headers.get("x-middleware-override-headers");
  const keys = listed ? listed.split(",") : [...req.headers.keys()];
  if (!listed) for (const k of keys) res.headers.set(`x-middleware-request-${k}`, req.headers.get(k) ?? "");
  for (const [k, v] of Object.entries(add)) {
    res.headers.set(`x-middleware-request-${k}`, v);
    if (!keys.includes(k)) keys.push(k);
  }
  res.headers.set("x-middleware-override-headers", keys.join(","));
}

/**
 * The TV shell (TV document §4.1, §12.1): on a device in TV mode every address is answered by `app/[locale]/tvui`,
 * so a TV never loads the site's shell and a phone never loads the TV's. The address stays the one the person sees.
 * `/tv` turns TV mode on in this browser, signed in or not; `tvui` itself is not an address outside TV mode.
 */
function tvShell(req: NextRequest, res: NextResponse): NextResponse {
  if (res.headers.get("location")) return res;
  const external = req.nextUrl.pathname;
  const prefix = external.split("/")[1];
  const rest = isLocale(prefix) ? external.slice(prefix.length + 1) || "/" : external;
  const enter = rest.replace(/\/$/, "") === "/tv";
  const tv = enter || isTvMode(req.cookies.get(TV_COOKIE)?.value, req.headers.get("user-agent"));
  if (!tv) {
    if (rest === "/tvui" || rest.startsWith("/tvui/")) {
      const url = req.nextUrl.clone();
      url.pathname = `${isLocale(prefix) ? `/${prefix}` : ""}${rest.slice(5) || "/"}`;
      return NextResponse.redirect(url);
    }
    return res;
  }
  const target = tvShellPath(rest);
  if (!target) return res;
  const rewrite = res.headers.get("x-middleware-rewrite");
  const url = new URL(rewrite ?? req.url);
  const internal = url.pathname.split("/")[1];
  const locale = isLocale(internal) ? internal : isLocale(prefix) ? prefix : routing.defaultLocale;
  url.pathname = `/${locale}${target}`;
  res.headers.set("x-middleware-rewrite", url.toString());
  passHeaders(req, res, { [TV_SHELL_HEADER]: "tv", [TV_PATH_HEADER]: `${rest}${req.nextUrl.search}` });
  // Only a real visit switches the browser: never a prefetch of a link to /tv.
  const prefetch = req.headers.has("next-router-prefetch") || /prefetch/i.test(`${req.headers.get("purpose") ?? ""} ${req.headers.get("sec-purpose") ?? ""}`);
  if (enter && !prefetch) res.cookies.set(TV_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}

export const config = {
  // Everything except the API, Next internals and files with an extension (sw.js, manifest, images…).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
