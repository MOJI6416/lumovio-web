"use client";

import { BookmarkCheck, CircleCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import { CardRating } from "@/components/media/CardRating";
import { Poster } from "@/components/media/Poster";
import { useCardMark, useRatingText } from "@/components/media/PosterCard";
import { useSession } from "@/components/providers/Providers";
import { FilterChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadMore } from "@/components/ui/LoadMore";
import { Link } from "@/i18n/navigation";
import { latinLang } from "@/lib/format";
import { titleHref } from "@/lib/slug";
import { byYear, character, countGroups, GROUPS, type Group, groupsOf, jobsIn, type RowCredit } from "./credits";
import { jobKey } from "./jobs";
import { useJobText } from "./job-label";

const PAGE = 40;
/** A group's own job says nothing in its rows ("Director" under "Director"); the others do ("Screenplay", "Executive Producer"). */
const BASE: Partial<Record<Group, string>> = { directing: "Director", writing: "Writer", production: "Producer" };

const rank = (g: Group, main: Group | null) => (g === main ? 0 : g === "crew" ? 2 : g === "self" ? 3 : 1);

const CREW_WORK: Group[] = ["directing", "writing", "production", "crew"];
/** A group in the address: "Other" is `other`, since an older link's `crew` meant all the crew work. */
const param = (g: Group) => (g === "crew" ? "other" : g);

/** The group an address asks for; an older `?credits=crew` opens the crew work they are known for, else the first. */
function fromParam(v: string | null, present: Group[], main: Group | null): Group | null {
  if (v === "crew") return main && main !== "acting" && main !== "self" && present.includes(main) ? main : (CREW_WORK.find((g) => present.includes(g)) ?? null);
  return present.find((g) => param(g) === v) ?? null;
}

/**
 * A person's filmography: one profession at a time — "Actor · 94", "Director · 9",
 * "Writer", "Producer", "Other", "As themselves" (FilterChip, as Search's types; IMDb, Letterboxd and Kinopoisk split it the
 * same way) — opening on what they are known for, and under it the years, newest first (titles without a date last):
 * one row per title with the year, the poster, the name, the role there, then the rating, film or series and the
 * episodes they are in; "Watched" or "Watchlist" before the rating. A row is the title's link. The choice stays in the
 * address (`?credits=directing`), so Back and a shared link keep it; 40 rows, then "Show more".
 */
export function Filmography({ credits, main, gender }: { credits: RowCredit[]; main: Group | null; gender: "female" | "male" | null }) {
  const t = useTranslations("person");
  const tp = useTranslations("personPage");
  const params = useSearchParams();
  const { me } = useSession();
  const counts = useMemo(() => countGroups(credits), [credits]);
  // What they are known for first, then the most; "Other" and "As themselves" last (IMDb's order).
  const present = GROUPS.filter((g) => counts[g] > 0).sort((a, b) => rank(a, main) - rank(b, main) || counts[b] - counts[a]);
  const [group, setGroup] = useState<Group | null>(() => fromParam(params.get("credits"), present, main) ?? (main && present.includes(main) ? main : (present[0] ?? null)));
  const [shown, setShown] = useState(PAGE);
  const list = useMemo(() => (group ? credits.filter((c) => groupsOf(c).includes(group)).sort(byYear) : []), [credits, group]);
  const choose = (g: Group) => {
    setGroup(g);
    setShown(PAGE);
    const q = new URLSearchParams(window.location.search);
    if (g === main) q.delete("credits");
    else q.set("credits", param(g));
    q.delete("sort");
    const qs = q.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };
  const rows = list.slice(0, shown);
  return (
    <section aria-labelledby="filmography-h" className="page-x">
      <h2 id="filmography-h" className="text-h2 text-text-1">
        {tp("filmography")}
      </h2>
      {present.length > 1 && (
        // One row of choices that scrolls sideways on a phone, as Search's types.
        // biome-ignore lint/a11y/useSemanticElements: a row of filter chips, not a form's fieldset
        <div role="group" aria-label={tp("filterLabel")} className="scroll-row -mx-(--gutter) mt-3 flex gap-2 overflow-x-auto px-(--gutter) py-1 md:mt-4 md:flex-wrap">
          {present.map((g) => (
            <FilterChip key={g} selected={group === g} count={counts[g]} onClick={() => choose(g)} className="shrink-0">
              {t(`as_${g}`, { gender: gender ?? "other" })}
            </FilterChip>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        // A kids profile sees only the titles it may open: said so, rather than "nothing here".
        <EmptyState variant="inline" className="mt-4" title={me?.activeProfile?.isKids ? tp("noCreditsKids") : tp("noCredits")} />
      ) : (
        <>
          {/* Rows across the page's width, as History's and an artist's songs on Apple Music: one column
              on a phone and a tablet, two from xl, three from 2xl, a hairline under each. */}
          <ol className="mt-3 grid gap-x-8 md:mt-4 xl:grid-cols-2 2xl:grid-cols-3">
            {rows.map((c) => (
              <CreditRow key={c.id} credit={c} group={group!} />
            ))}
          </ol>
          <LoadMore onMore={() => setShown((n) => n + PAGE)} shown={rows.length} total={list.length} />
        </>
      )}
    </section>
  );
}

/** What the person was there: the characters (a voice role said so), or the jobs in this group in the interface language. */
function useRole(c: RowCredit, group: Group): { text: string; node: ReactNode } | null {
  const t = useTranslations("person");
  const job = useJobText();
  const locale = useLocale();
  if (group === "acting") {
    const roles = (c.characters?.length ? c.characters : c.as ? [] : c.role ? [c.role] : []).map(character).filter((r) => r.name);
    if (roles.length === 0) return null;
    const said = roles.map((r) => (r.voice ? t("voiceRole", { name: r.name }) : r.name));
    return {
      text: said.join(", "),
      node: roles.map((r, i) => (
        <Fragment key={r.name}>
          {i > 0 && ", "}
          {/* TMDB writes the characters in English: a Latin name on a ru/uk page is marked so. */}
          <span lang={latinLang(r.name, locale)}>{said[i]}</span>
        </Fragment>
      )),
    };
  }
  if (group === "self") return null;
  const jobs = jobsIn(c, group);
  if (jobs.length === 0 || (jobs.length === 1 && jobs[0] === BASE[group])) return null;
  return {
    text: jobs.map(job).join(", "),
    node: jobs.map((j, i) => (
      <Fragment key={j}>
        {i > 0 && ", "}
        {/* A job without a translation is as TMDB writes it, in English. */}
        <span lang={jobKey(j) ? undefined : "en"}>{job(j)}</span>
      </Fragment>
    )),
  };
}

function CreditRow({ credit: c, group }: { credit: RowCredit; group: Group }) {
  const tc = useTranslations("common");
  const tl = useTranslations("title");
  const locale = useLocale();
  const { mark } = useCardMark(c);
  const ratingText = useRatingText();
  const role = useRole(c, group);
  const kind = c.isAnime ? tc("anime") : c.kind === "movie" ? tc("movie") : tc("series");
  const facts = [kind, c.kind === "tv" && c.episodes ? tc("episodes", { count: c.episodes }) : null].filter(Boolean).join(" · ");
  const Mark = mark === "watched" ? CircleCheck : mark === "watchlist" ? BookmarkCheck : null;
  return (
    <li className="border-b border-line">
      <Link
        href={titleHref(c.kind, c.tmdbId, c.title)}
        aria-label={[
          `${c.title}${c.year ? ` (${c.year})` : ""}`,
          facts,
          role?.text,
          ratingText(c),
          mark === "watched" ? tl("watched") : mark === "watchlist" ? tl("watchlistRemove") : null,
        ]
          .filter(Boolean)
          .join(", ")}
        className="group/row -mx-2 my-1 grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)] items-center gap-x-3 rounded-sm px-2 py-2 hover:bg-surface-1 md:grid-cols-[3rem_2.5rem_minmax(0,1fr)]"
      >
        <span aria-hidden className="text-body-s font-semibold tabular-nums text-text-2">
          {c.year ?? "—"}
        </span>
        <span aria-hidden className="w-10 overflow-hidden rounded-xs">
          <Poster path={c.posterPath} title="" kind={c.kind} sizes="40px" />
        </span>
        {/* The name, the role there, then the rating, film or series and the episodes they are in. */}
        <span aria-hidden className="min-w-0">
          <span className="line-clamp-2 text-title text-text-1 group-hover/row:underline" lang={latinLang(c.title, locale)}>
            {c.title}
          </span>
          {role && <span className="mt-0.5 line-clamp-2 text-body-s text-text-2">{role.node}</span>}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-body-s text-text-2">
            {Mark && <Mark className="size-4 shrink-0 text-text-1" />}
            <CardRating title={c} className="text-text-1" />
            {facts}
          </span>
        </span>
      </Link>
    </li>
  );
}
