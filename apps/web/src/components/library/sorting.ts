"use client";

import { useTranslations } from "next-intl";
import { cardRating } from "./url-state";

/** The sort's options as the catalog names them (CAT-08), with "Recently added" for a person's own collection. */
export function useTitleSorts() {
  const t = useTranslations("library");
  const tb = useTranslations("browse");
  return (first: { value: "added" | "list"; label?: string }) => [
    { value: first.value, label: first.label ?? t("sortAdded") },
    { value: "title" as const, label: tb("sortTitle") },
    { value: "year" as const, label: tb("sortNewest") },
    { value: "rating" as const, label: tb("sortRating") },
  ];
}

/** Sorts a copy of a collection's items; "added"/"list" keep the order the API gives. */
export function sortItems<T extends { title: { title: string; year: number | null } & Parameters<typeof cardRating>[0] }>(items: T[], sort: string, locale: string): T[] {
  if (sort === "title") return [...items].sort((a, b) => a.title.title.localeCompare(b.title.title, locale));
  if (sort === "year") return [...items].sort((a, b) => (b.title.year ?? 0) - (a.title.year ?? 0));
  if (sort === "rating") return [...items].sort((a, b) => cardRating(b.title) - cardRating(a.title));
  return items;
}
