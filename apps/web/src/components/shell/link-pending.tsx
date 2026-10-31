"use client";

import { useLinkStatus } from "next/link";
import { useEffect } from "react";

// The pages (paths without the language) of links whose navigation is under way: Next reports each one as pending until
// the history moves (useLinkStatus). Read by NavigationLoading.
const pages: string[] = [];
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export const pendingPages = {
  list: (): readonly string[] => pages,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** Inside every Link of the site (i18n/navigation), with the page it opens: says while its navigation is pending. */
export function LinkPending({ to }: { to: string }) {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    pages.push(to);
    emit();
    return () => {
      pages.splice(pages.indexOf(to), 1);
      emit();
    };
  }, [pending, to]);
  return null;
}
