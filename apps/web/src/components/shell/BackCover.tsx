"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { BrandLoader } from "@/components/ui/BrandMotion";

/** How long the art on screen may keep the cover after the page has come, and the whole wait at most. */
const ART_WAIT_MS = 1000;
const MAX_WAIT_MS = 8000;
/** --dur-base: the cover's fade. */
const FADE_MS = 200;

const decoded = (path: string) => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

// Every browser on an iPhone or iPad is WebKit (an iPad says it is a Mac, but has touch).
const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const state = {
  el: null as HTMLDivElement | null,
  /** The page on screen (the router's pathname), kept by the component. */
  here: "",
  waiting: false,
  /** Counts the history steps: a second Back while the first page's art is awaited keeps the cover for its own page. */
  step: 0,
  max: 0,
  fade: 0,
};

function uncover() {
  const el = state.el;
  state.waiting = false;
  clearTimeout(state.max);
  if (!el || el.hidden) return;
  el.dataset.leaving = "";
  state.fade = window.setTimeout(() => {
    el.hidden = true;
    delete el.dataset.leaving;
  }, FADE_MS);
}

/** The images on screen ready to be painted: those from memory decoded, those still coming at most ART_WAIT_MS. */
function artOnScreen(): Promise<unknown> {
  const shown = [...document.images].filter((img) => {
    const r = img.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 0 && img.checkVisibility();
  });
  return Promise.race([
    Promise.all(shown.map((img) => img.decode().catch(() => {}))), // ui-lint-ignore swallowed-error: only a wait; a broken image shows its own placeholder
    new Promise((done) => setTimeout(done, ART_WAIT_MS)),
  ]);
}

// Registered when the module loads, before the router's own listener (an effect of the app's root): the cover is in the
// document before the router puts the page of that history entry in, both in the same task, before the first paint.
if (typeof window !== "undefined" && ios())
  addEventListener("popstate", () => {
    const el = state.el;
    // Another state of the same page (filters, tabs, a dialog closed by Back) keeps it on screen.
    if (!el || decoded(location.pathname) === decoded(state.here)) return;
    clearTimeout(state.fade);
    delete el.dataset.leaving;
    el.hidden = false;
    state.waiting = true;
    state.step++;
    clearTimeout(state.max);
    state.max = window.setTimeout(uncover, MAX_WAIT_MS);
  });

/**
 * Back and Forward on an iPhone or iPad: during a swipe iOS shows its snapshot of the page,
 * and after it the live page blinked, however it was drawn (even with the previous page's DOM kept).
 * So a page from the history comes under a cover of the page's colour, over the header, with the loader after
 * --loader-delay; the cover fades once the router has put the page in, the scroll is restored and the art on screen is
 * ready. Elsewhere Back shows the page at once, as before.
 */
export function BackCover() {
  const t = useTranslations("common");
  const pathname = usePathname();

  useEffect(() => {
    state.here = pathname;
    if (!state.waiting) return;
    state.waiting = false;
    const step = state.step;
    // The page's layout and the restored scroll first (two frames), then its art.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => void artOnScreen().then(() => step === state.step && uncover())),
    );
  }, [pathname]);

  return (
    <div
      ref={(el) => {
        state.el = el;
      }}
      hidden
      role="status"
      aria-label={t("loading")}
      className="fixed inset-0 z-scrim grid place-items-center bg-bg transition-opacity duration-base ease-base data-leaving:opacity-0"
    >
      <div className="loader-appear">
        <BrandLoader />
      </div>
    </div>
  );
}
