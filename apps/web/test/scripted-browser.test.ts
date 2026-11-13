import { describe, expect, it } from "vitest";
import { type PageRequest, scriptedBrowser } from "../src/lib/scripted-browser";

/** Which page requests are refused as programs posing as a browser, and which never are. */
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const WIN_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const MAC_FIREFOX = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0";
const LINUX_EDGE =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0";

const guest = (userAgent: string | null, more: Partial<PageRequest> = {}): PageRequest => ({
  userAgent,
  fetchMode: null,
  forwardedProto: "https",
  signedIn: false,
  ...more,
});

describe("scriptedBrowser", () => {
  it("refuses a desktop Chrome or Firefox that sends no Fetch Metadata", () => {
    for (const ua of [MAC_CHROME, WIN_CHROME, MAC_FIREFOX, LINUX_EDGE])
      expect(scriptedBrowser(guest(ua))).toBe(true);
  });

  it("lets a real browser through: it sends Sec-Fetch-Mode", () => {
    expect(scriptedBrowser(guest(MAC_CHROME, { fetchMode: "navigate" }))).toBe(false);
    expect(scriptedBrowser(guest(MAC_FIREFOX, { fetchMode: "cors" }))).toBe(false);
  });

  it("never refuses a signed-in person, or a request that didn't come over HTTPS", () => {
    expect(scriptedBrowser(guest(MAC_CHROME, { signedIn: true }))).toBe(false);
    expect(scriptedBrowser(guest(MAC_CHROME, { forwardedProto: "http" }))).toBe(false);
    expect(scriptedBrowser(guest(MAC_CHROME, { forwardedProto: null }))).toBe(false);
  });

  it("leaves search engines, link previews and audits alone", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/146.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 (compatible; Epochal-Search/1.0)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Chrome-Lighthouse",
      "TelegramBot (like TwitterBot)",
    ])
      expect(scriptedBrowser(guest(ua))).toBe(false);
  });

  it("leaves phones, web views, TVs, Safari and old browsers alone", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
      "Mozilla/5.0 (SMART-TV; X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.31 Safari/537.36 Tizen 7.0",
      "Mozilla/5.0 (Linux; Android 12; BRAVIA 4K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 LumovioTV/1.4 (AndroidTV)",
      "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.18363",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:78.0) Gecko/20100101 Firefox/78.0",
      null,
    ])
      expect(scriptedBrowser(guest(ua))).toBe(false);
  });
});
