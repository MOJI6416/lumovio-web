"use client";

import type { Genre } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { LinkChip } from "@/components/ui/Chip";
import { FilterPill } from "./FilterPill";

/**
 * A section's heading row, over the top of its billboard (design-system 7.14, section mode; 2026-11-08): the name (on a
 * phone the section switch above names it; the h1 stays for screen readers), then two pills of the catalog grid's own
 * family (7.4) — "All films ›", a link to the section's whole grid, and "Genres ⌄", a menu of genres, each opening that
 * grid with the genre (↑/↓ move through the menu and only Enter opens one, CAT-01). No form field and no lime link over
 * the art: they read as a form laid on the picture. One line; on a phone the pills scroll sideways
 * in it rather than wrap down over the art.
 */
export function SectionNav({ title, base, genres, allLabel }: { title: string; base: string; genres: Genre[]; allLabel: string }) {
  const t = useTranslations("browse");
  const locale = useLocale();
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <h1 className="text-h1 text-text-1 max-md:sr-only">{title}</h1>
      {/* The padding keeps the focus rings inside the phone's scrolling line; the margin gives it back. */}
      <div className="scroll-row flex items-center gap-2 *:shrink-0 max-md:-m-2 max-md:min-w-0 max-md:flex-1 max-md:overflow-x-auto max-md:p-2">
        <LinkChip href={`${base}?view=all`}>{allLabel}</LinkChip>
        <FilterPill text={t("genres")} selected={false} popup="menu">
          {(m, trigger, { open, setOpen }) => (
            <m.Menu label={t("genres")} align="start" open={open} onOpenChange={setOpen} trigger={trigger}>
              {genres.map((g) => (
                <m.MenuItem key={g.id} href={`${base}?genres=${g.id}`}>
                  {cap(g.name)}
                </m.MenuItem>
              ))}
            </m.Menu>
          )}
        </FilterPill>
      </div>
    </div>
  );
}
