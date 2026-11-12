"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";
import { getPathname, useRouter } from "@/i18n/navigation";

type Nav = { currentEntry?: { index: number } | null; entries?: () => { url: string | null }[] };

const decode = (path: string) => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

/**
 * "← Parent" and "← To the title": back through the history when the page before this one is that
 * very page (the place and the scroll come back), else that page in this one's place — never a new entry. A new entry
 * would put this page behind its parent, and the app's own Back or the browser's would come back to it: the
 * title and its sources screen sent each other round in a loop.
 */
export function useGoUp() {
  const router = useRouter();
  const locale = useLocale();
  return useCallback(
    (href: string) => {
      const nav = (window as Window & { navigation?: Nav }).navigation;
      const index = nav?.currentEntry?.index ?? -1;
      const before = index > 0 ? nav?.entries?.()[index - 1]?.url : null;
      const target = getPathname({ href, locale }).split("?")[0] ?? "";
      if (before && decode(new URL(before).pathname) === decode(target)) window.history.back();
      else router.replace(href);
    },
    [router, locale],
  );
}
