"use client";

import type { PersonDetails } from "@lumovio/contracts";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PosterCard } from "@/components/media/PosterCard";
import { TitleGrid } from "@/components/media/Row";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/Chip";
import { useSession } from "@/components/providers/Providers";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useJobText } from "./job-label";

type Credit = PersonDetails["credits"][number];
type Group = "acting" | "crew" | "self";
type Sort = "year" | "popularity";
const GROUPS: Group[] = ["acting", "crew", "self"];
const PAGE = 36;

/** The groups a credit belongs to (older API answers without `as` count as acting with a character, else crew). */
const groupsOf = (c: Credit): Group[] => c.as ?? [c.role ? "acting" : "crew"];

/**
 * A person's filmography (S08, PER-01, PER-02): PosterCards in a grid of the shelf's width, filtered by how they took
 * part — "Actor", "Crew", "Appearances" (talk shows, documentaries as themselves) — and sorted by year or by
 * popularity; the year and the role under each card, jobs in the interface language. The choice is kept in the
 * address (`?credits=…&sort=…`), so Back and a shared link keep it. "Show more" past 36.
 */
export function Filmography({ credits, main }: { credits: Credit[]; main: Group }) {
  const t = useTranslations("personPage");
  const tc = useTranslations("common");
  const job = useJobText();
  const params = useSearchParams();
  const { me } = useSession();
  const counts = Object.fromEntries(GROUPS.map((g) => [g, credits.filter((c) => groupsOf(c).includes(g)).length])) as Record<Group, number>;
  const present = GROUPS.filter((g) => counts[g] > 0);
  const asked = params.get("credits") as Group | null;
  const [group, setGroup] = useState<Group | null>(asked && present.includes(asked) ? asked : present.includes(main) && present.length > 1 ? main : null);
  const [sort, setSort] = useState<Sort>(params.get("sort") === "popularity" ? "popularity" : "year");
  const [shown, setShown] = useState(PAGE);
  const remember = (g: Group | null, s: Sort) => {
    const q = new URLSearchParams(window.location.search);
    if (g) q.set("credits", g);
    else q.delete("credits");
    if (s === "popularity") q.set("sort", s);
    else q.delete("sort");
    const qs = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };

  const list = credits
    .filter((c) => !group || groupsOf(c).includes(group))
    .sort((a, b) => (sort === "year" ? (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "") : (b.tmdbVotes ?? 0) - (a.tmdbVotes ?? 0)));
  const role = (c: Credit) => {
    const as = group ?? groupsOf(c)[0];
    if (as === "self") return t("asSelf");
    if (as === "crew") return (c.jobs ?? []).map(job).join(", ") || null;
    return (c.characters ?? []).join(", ") || (c.as ? null : c.role);
  };
  return (
    <section aria-labelledby="filmography-h" className="page-x">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <h2 id="filmography-h" className="text-h2 text-text-1">
          {t("filmography")}
        </h2>
        {present.length > 1 && (
          // biome-ignore lint/a11y/useSemanticElements: a row of filter chips, not a form's fieldset
          <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
            {present.map((g) => (
              <FilterChip
                key={g}
                selected={group === g}
                count={counts[g]}
                onClick={() => {
                  const next = group === g ? null : g;
                  setGroup(next);
                  setShown(PAGE);
                  remember(next, sort);
                }}
              >
                {t(`group_${g}`)}
              </FilterChip>
            ))}
          </div>
        )}
        {credits.length > 0 && (
        <SegmentedControl
          label={t("sortLabel")}
          value={sort}
          onValueChange={(s) => {
            setSort(s);
            remember(group, s);
          }}
          options={[
            { value: "year", label: t("sortYear") },
            { value: "popularity", label: t("sortPopularity") },
          ]}
          className="sm:ms-auto"
        />
        )}
      </div>
      {list.length === 0 ? (
        // A kids profile sees only the titles it may open (8.10): said so, rather than "nothing here".
        <EmptyState title={me?.activeProfile?.isKids && credits.length === 0 ? t("noCreditsKids") : t("noCredits")} />
      ) : (
        <>
          <TitleGrid>
            {list.slice(0, shown).map((c) => (
              <PosterCard key={c.id} title={c} subtitle={[c.year ?? "—", role(c)].filter(Boolean).join(" · ")} />
            ))}
          </TitleGrid>
          {list.length > shown && (
            <div className="mt-8 flex justify-center">
              <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
                {tc("showMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
