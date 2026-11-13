import { isTvUserAgent, tvAppVersion } from "./tv";

/** Search engines, link previews and audits name themselves: they are never refused here. */
const NAMED =
  /bot|crawl|spider|slurp|google|bing|yandex|baidu|preview|facebook|meta-|lighthouse|compatible;/i;
/** A desktop system: phones' in-app browsers and web views are left out. */
const DESKTOP = /Macintosh|Windows NT|X11/;
const CHROMIUM = /Chrome\/(\d+)/;
const FIREFOX = /Firefox\/(\d+)/;

export interface PageRequest {
  userAgent: string | null;
  /** `Sec-Fetch-Mode`: every Chromium browser since 76 and Firefox since 90 sends it with each request over HTTPS. */
  fetchMode: string | null;
  /** The scheme the visitor used, as the proxy in front of the site reports it. */
  forwardedProto: string | null;
  signedIn: boolean;
}

/**
 * A guest's page request from a program that only calls itself a browser: a desktop Chrome or Firefox new enough to
 * always send Fetch Metadata, over HTTPS, without it. Such clients walk thousands of pages from rotating home
 * addresses; refusing them before the page renders keeps the server and the catalog's quota for people.
 */
export function scriptedBrowser(r: PageRequest): boolean {
  const ua = r.userAgent;
  if (r.fetchMode || r.signedIn || r.forwardedProto !== "https" || !ua) return false;
  if (NAMED.test(ua) || !DESKTOP.test(ua) || isTvUserAgent(ua) || tvAppVersion(ua)) return false;
  const chromium = CHROMIUM.exec(ua);
  if (chromium) return Number(chromium[1]) >= 80;
  const firefox = FIREFOX.exec(ua);
  return firefox ? Number(firefox[1]) >= 90 : false;
}
