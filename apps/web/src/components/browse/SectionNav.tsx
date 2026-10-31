"use client";

import type { Genre } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { WatchNowToggle } from "@/components/media/WatchNowToggle";
import { Combobox } from "@/components/ui/Combobox";
import { Link } from "@/components/ui/Link";
import { useRouter } from "@/i18n/navigation";

/**
 * A section's heading row, over the top of its billboard's art (owner, 2026-10-25): the name (on a phone the section
 * switch above names it; the h1 stays for screen readers), the genre picker — a Combobox, so ↑/↓ move through the list
 * and only Enter opens a genre (CAT-01) — "All films" as an action link (CAT-10), and the "Watch now" switch. Compact:
 * one line; on a phone the controls scroll sideways in it rather than wrap down over the art.
 */
export function SectionNav({
  title,
  base,
  genres,
  allLabel,
  watchNow,
}: {
  title: string;
  base: string;
  genres: Genre[];
  allLabel: string;
  watchNow?: { on: boolean; label: string };
}) {
  const t = useTranslations("browse");
  const locale = useLocale();
  const router = useRouter();
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <h1 className="text-h1 text-text-1 max-md:sr-only">{title}</h1>
      {/* The padding keeps the focus rings inside the phone's scrolling line; the margin gives it back. */}
      <div className="scroll-row flex items-center gap-x-4 *:shrink-0 max-md:-m-2 max-md:min-w-0 max-md:flex-1 max-md:overflow-x-auto max-md:p-2 md:flex-wrap md:gap-y-3">
        <Combobox
          value={null}
          onValueChange={(id) => router.push(`${base}?genres=${id}`)}
          options={genres.map((g) => ({ value: String(g.id), label: cap(g.name) }))}
          placeholder={t("genres")}
          aria-label={t("genres")}
          className="w-44 max-md:w-40"
        />
        <Link variant="action" arrow href={`${base}?view=all`}>
          {allLabel}
        </Link>
        {watchNow && <WatchNowToggle on={watchNow.on} href={watchNow.on ? base : `${base}?watch=now`} label={watchNow.label} />}
      </div>
    </div>
  );
}
