"use client";

export type ThemePref = "dark" | "light" | "system";

const THEME_EVENT = "lumovio:theme";
const LIGHT_OS = "(prefers-color-scheme: light)";

const resolve = (pref: ThemePref) => (pref === "system" ? (matchMedia(LIGHT_OS).matches ? "light" : "dark") : pref);

/**
 * Puts a theme on the page: `data-theme` (what the styles read), `data-theme-pref` (the choice) and the browser's
 * `theme-color`, which follows the chosen theme rather than the OS (X-28): the page's own --bg.
 */
export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  root.dataset.theme = resolve(pref);
  root.dataset.themePref = pref;
  const color = getComputedStyle(root).getPropertyValue("--bg").trim();
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.removeAttribute("media");
    meta.setAttribute("content", color);
  }
}

/** Saves and applies a theme; every theme control on the page (footer, account menu) hears about it. */
export function setTheme(pref: ThemePref) {
  document.cookie = `lumovio_theme=${pref}; path=/; max-age=31536000; samesite=lax`;
  applyTheme(pref);
  window.dispatchEvent(new CustomEvent<ThemePref>(THEME_EVENT, { detail: pref }));
}

export function getThemePref(): ThemePref {
  const m = /(?:^|; )lumovio_theme=(\w+)/.exec(document.cookie);
  return m?.[1] === "light" || m?.[1] === "system" ? m[1] : "dark";
}

/** Calls `on` whenever the theme is chosen anywhere on the page. */
export function onThemeChange(on: (pref: ThemePref) => void) {
  const handler = (e: Event) => on((e as CustomEvent<ThemePref>).detail);
  window.addEventListener(THEME_EVENT, handler);
  return () => window.removeEventListener(THEME_EVENT, handler);
}

/** "As the system": follows the OS while the page is open, not only when it loads (X-28). */
export function followSystemTheme() {
  const mq = matchMedia(LIGHT_OS);
  const on = () => {
    if (getThemePref() === "system") applyTheme("system");
  };
  mq.addEventListener("change", on);
  return () => mq.removeEventListener("change", on);
}

export function setTvMode(on: boolean) {
  document.cookie = `lumovio_tv=${on ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}
