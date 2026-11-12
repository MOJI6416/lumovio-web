/** Smart-TV / set-top browsers that should get the 10-foot UI by default. */
export function isTvUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|AFT[A-Z]|Android TV|GoogleTV|CrKey|AppleTV|Roku|PhilipsTV|VIDAA|Hisense|TV Safari/i.test(ua);
}

/** The Lumovio TV app (apps/tv-android) marks its WebView with `LumovioTV/<version>`: it always gets the TV shell. */
export const TV_APP_UA = /LumovioTV\/([\d.]+)/;

/** The app's version from its user agent, or null in a browser. */
export function tvAppVersion(ua: string | null | undefined): string | null {
  return (ua && TV_APP_UA.exec(ua)?.[1]) || null;
}

/**
 * The oldest TV app the site works with: 1.3 is the first release CI signed with the
 * release key and the site offers. An older app is asked to update; raise this when the site starts relying on
 * something a newer app adds. A local build is "1.0" — build it with `-PversionName=1.<n>` to skip the question.
 */
export const TV_APP_MIN_VERSION = "1.3";

/** Whether dotted version `a` is older than `b` ("1.10" is newer than "1.9"). */
export function versionBelow(a: string, b: string): boolean {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d < 0;
  }
  return false;
}

/**
 * The installed TV app's version when it is older than the site's minimum and a newer one is published (`latest`, the
 * site's lumovio-tv.json), else null: then the TV shell asks to update it.
 */
export function tvAppToUpdate(ua: string | null | undefined, latest: string | null): string | null {
  const v = tvAppVersion(ua);
  return v && latest && versionBelow(v, TV_APP_MIN_VERSION) && versionBelow(v, latest) ? v : null;
}

/** The device's choice of shell: "1" TV, "0" the site, absent — decided by the user agent. */
export const TV_COOKIE = "lumovio_tv";

/**
 * Whether this device gets the TV shell: the TV app always; else the device's own choice (`/tv` sets it, the TV
 * settings and the account menu change it); else a TV's user agent. Never by the window's width.
 */
export function isTvMode(cookie: string | null | undefined, ua: string | null | undefined): boolean {
  if (tvAppVersion(ua)) return true;
  if (cookie === "1") return true;
  if (cookie === "0") return false;
  return isTvUserAgent(ua);
}

/** Request header the proxy sets on a request it hands to the TV shell (`app/[locale]/tvui`). */
export const TV_SHELL_HEADER = "x-lumovio-shell";
/** The address the person sees (path and query, without the locale), for the TV shell's "next" and "Continue on phone". */
export const TV_PATH_HEADER = "x-lumovio-path";

/** Addresses a TV keeps as they are: confirming a code is done on the other device, and the design showcase. */
const SITE_ONLY = new Set(["link", "dev"]);

/**
 * Where the TV shell answers an address (without the locale prefix), or null for the site's own page. One address for
 * every device: a title's link sent from a phone opens on the TV in the TV shell. Sign-in pages
 * become the code screen (a password is never typed with a remote); the rest keeps its path under `tvui`, where a page
 * of the same name answers or the catch-all offers to continue on a phone.
 */
export function tvShellPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "tvui") parts.shift();
  if (parts[0] && SITE_ONLY.has(parts[0])) return null;
  if (parts[0] === "auth") return "/tvui/tv";
  return `/tvui${parts.length ? `/${parts.join("/")}` : ""}`;
}

/** Back on a remote: Tizen's Return (10009), webOS's Back (461), Escape; Backspace outside text fields. */
export const BACK_KEYCODES = new Set([10009, 461, 8, 27]);
