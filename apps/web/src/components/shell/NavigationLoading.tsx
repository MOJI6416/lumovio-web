"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BrandLoader } from "@/components/ui/BrandMotion";
import { usePathname } from "@/i18n/navigation";
import { pendingPages } from "./link-pending";

// A title's address carries its name, written in letters in a link and percent-encoded in the browser's path.
const decode = (path: string) => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

/** --loader-delay (globals.css) in ms: the wait after which a loading state shows. A production build writes it in s. */
const loaderDelay = () => {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--loader-delay").trim();
  const n = Number.parseFloat(v);
  return Number.isNaN(n) ? 300 : v.endsWith("ms") ? n : n * 1000;
};

/**
 * Whether a tapped link's page has been prepared by the server for longer than --loader-delay — a link to another page;
 * one to this same page (filters, tabs, search parameters) keeps the page it changes (8.4). The loader and the header
 * (which then leaves the old page's artwork for its plain look) follow it together.
 */
export function useNavigationLoading() {
  const here = decode(usePathname());
  const pending = useSyncExternalStore(
    pendingPages.subscribe,
    () => pendingPages.list().some((to) => to !== "" && decode(to) !== here && !framed(here, decode(to))),
    () => false,
  );
  return useLate(pending);
}

/**
 * A move between two sections of a frame that stays on screen — the settings beside their menu, from lg — shows its
 * loader in the section's place (SettingsFrame, useSectionLoading), not over the whole page.
 */
const FRAMES = ["/settings"];
const wide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 64rem)").matches;
const inFrame = (frame: string, path: string) => path === frame || path.startsWith(`${frame}/`);
function framed(here: string, to: string) {
  return wide() && FRAMES.some((f) => inFrame(f, here) && inFrame(f, to));
}

/** Whether another section of `frame` is being prepared for longer than --loader-delay (the frame's own loader). */
export function useSectionLoading(frame: string) {
  const here = decode(usePathname());
  const pending = useSyncExternalStore(
    pendingPages.subscribe,
    () => pendingPages.list().some((to) => to !== "" && decode(to) !== here && inFrame(frame, here) && inFrame(frame, decode(to))),
    () => false,
  );
  return useLate(pending) && wide();
}

function useLate(pending: boolean) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!pending) {
      setLate(false);
      return;
    }
    const id = setTimeout(() => setLate(true), loaderDelay());
    return () => clearTimeout(id);
  }, [pending]);
  return pending && late;
}

/**
 * While a tapped link's page is prepared by the server (design-system 6.3.1, 8.4): the loader in the page's place,
 * under the header — after --loader-delay, so a quick page comes without it. The header can be used meanwhile. `tv`: the
 * TV shell's screens, beside its menu rail.
 */
export function NavigationLoading({ tv }: { tv?: boolean }) {
  const t = useTranslations("common");
  if (!useNavigationLoading()) return null;
  return (
    <div
      role="status"
      aria-label={t("loading")}
      className={clsx(
        "fixed z-sticky grid animate-fade-in place-items-center bg-bg",
        // The TV shell: the screen's place beside the menu rail (64 and more, 6.3.1); the site: under the header.
        tv ? "inset-y-0 start-(--tv-rail) end-0" : "inset-x-0 top-(--header-h) bottom-0",
      )}
    >
      <BrandLoader size={tv ? "lg" : "md"} />
    </div>
  );
}
