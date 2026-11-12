"use client";

import {
  ArrowDownUp,
  AudioLines,
  ChevronDown,
  CircleAlert,
  Film,
  Info,
  Magnet,
  MonitorPlay,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  SearchX,
  Server,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FocusEvent, useEffect, useRef, useState } from "react";
import { type FinderProps, PAGE, SORTS, type Sort, useTorrentFinder } from "@/components/player/finder";
import { useMediaErrorText } from "@/components/sources/media-error";
import { formatSize, isPack, packWords, QUALITY_MODES, ReleaseLine, ReleaseTag, useReleaseFacts, useReleaseText } from "@/components/sources/release-text";
import { AccentBadge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { TvButton } from "@/components/ui/tv/TvButton";
import { useReleasePrefs } from "@/hooks/useTorrentLookup";
import { formatDate } from "@/lib/format";
import type { Edition } from "@/lib/media/release-pick";
import { type RankedRelease, releaseDomId } from "@/lib/media/releases";
import { type TsSearchResult, trackersOf } from "@/lib/media/torrserver";
import { TvLayer } from "../nav/TvLayer";
import { useTvNav } from "../nav/TvNav";
import { ChoiceLayer } from "../shell/ChoiceLayer";
import { TvKeyboard } from "../shell/TvKeyboard";
import { TvState } from "../shell/TvState";

/*
 * "Through TorrServer" on the TV's sources screen: the same
 * search and the same choices as the site's (components/player/finder) in the TV's composition — a line of the server,
 * the query and Refresh / Cancel; Audio, Cut and Quality as buttons that say their value, each opening a card, each
 * narrowing the next; the recommended release first, then the chosen audio's other releases, as rows, one stop each
 * (OK is "Watch"), "i" beside for the details; what can't be picked folded under them. The next part of the list
 * appears as the focus nears its end; nothing reorders under the focus (the answer changes on Refresh only).
 */

type Picking = "server" | "query" | "voice" | "edition" | "quality" | "sort" | null;

/** `first`: the screen has no copy above, so its focus starts here — on the recommended release once there is one. */
export function TvFinder({ first, ...props }: FinderProps & { first: boolean }) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tc = useTranslations("common");
  const mediaError = useMediaErrorText();
  const text = useReleaseText();
  const f = useTorrentFinder(props);
  const { details: d, season, connections } = props;
  const prefs = useReleasePrefs();
  const locale = useLocale();
  const [picking, setPicking] = useState<Picking>(null);
  const [draft, setDraft] = useState(f.query);
  const [restOpen, setRestOpen] = useState(false);
  const [restShown, setRestShown] = useState(PAGE);
  const list = useRef<HTMLUListElement>(null);
  const nav = useTvNav();

  const found = f.found;
  const searching = f.status.kind === "searching";
  // The site's choice: the recommendation of the chosen audio, cut and picture, its other releases, what can't be picked.
  const c = f.choice;
  const chosen = c?.chosen ?? null;
  const option = c?.option ?? null;
  const rows = f.listed.rows.slice(0, f.shown);
  const nothingPicked = Boolean(found) && !chosen;
  const rest = restOpen || nothingPicked ? f.listed.rest.slice(0, restShown) : [];
  const editionName = (e: string) => tt(`edition_${e as Edition}`);
  const voiceValue = option ? [text.option(option), option.language && option.language !== prefs.languages[0] ? text.language(option.language) : null].filter(Boolean).join(", ") : t("anyVoice");
  const editionValue = f.edition ? editionName(f.edition) : t("anyEdition");
  const versionName = c?.version ? text.version(c.version.resolution, c.version.range) : "";
  const qualityValue = f.picture ? versionName : [tt(`tsQuality_${f.mode}`), versionName].filter(Boolean).join(" · ");
  // Where the focus starts when the screen has no copy: the recommended release, else the first one shown.
  const initialLink = chosen?.result.link ?? rows[0]?.result.link ?? rest[0]?.link;

  // The next part of a list arrives before the focus gets to its end.
  const onListFocus = (e: FocusEvent<HTMLUListElement>) => {
    const i = Number((e.target as HTMLElement).dataset.index);
    if (Number.isFinite(i) && i >= f.shown - 5 && f.listed.rows.length > f.shown) f.setShown((n) => n + PAGE);
  };
  const onRestFocus = (e: FocusEvent<HTMLUListElement>) => {
    const i = Number((e.target as HTMLElement).dataset.index);
    if (Number.isFinite(i) && i >= restShown - 5 && f.listed.rest.length > restShown) setRestShown((n) => n + PAGE);
  };
  const row = (r: TsSearchResult, x: RankedRelease | undefined, i: number, recommended = false) => (
    <TvReleaseRow
      key={r.link}
      r={r}
      x={x}
      heard={f.heard}
      index={i}
      initial={first && r.link === initialLink}
      recommended={recommended}
      linked={f.isLinked(r)}
      series={d.kind === "tv"}
      season={season}
      onWatch={() => watch(r)}
      onDetails={() => f.setDetailed(r)}
    />
  );
  // The first answer (results, nothing found, a failure) takes the focus to where this section starts — the release it
  // recommends, Retry, Edit query — as long as the remote hasn't moved since the screen opened.
  const section = useRef<HTMLElement>(null);
  const answered = useRef(Boolean(f.found));
  const moved = useRef(false);
  useEffect(() => {
    const onKey = () => {
      moved.current = true;
    };
    window.addEventListener("keydown", onKey, { capture: true, once: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);
  useEffect(() => {
    if (answered.current || (f.status.kind !== "done" && f.status.kind !== "error")) return;
    answered.current = true;
    if (!first || moved.current) return;
    requestAnimationFrame(() => {
      const start = section.current?.querySelector<HTMLElement>("ul [data-tv-initial], [data-zone='state'] [data-tv-initial]");
      if (start) nav.focus(start);
    });
  }, [f.status.kind, first, nav]);
  const watch = (r: TsSearchResult) =>
    f.pick(r, list.current?.querySelector(`[data-link="${releaseDomId(r.link)}"]`) ?? null);

  return (
    <section ref={section} aria-labelledby="finder-h" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="finder-h" className="text-h2 text-text-1">
          {tp("viaTorrServer", { name: f.server })}
        </h2>
        {/* What "Watch" does here, before the first one is pressed: for the screen reader, as on the site. */}
        <p className="sr-only">
          {t("finderNote", { server: f.server })} {f.where}
        </p>
      </div>

      <div data-zone="finder-bar" data-zone-axis="x" data-zone-entry="first" className="flex flex-wrap gap-4">
        {connections.length > 1 && (
          <TvButton icon={Server} aria-haspopup="dialog" aria-label={`${t("serverLabel")}: ${f.server}`} onClick={() => setPicking("server")}>
            {f.server}
          </TvButton>
        )}
        <TvButton
          icon={Search}
          aria-haspopup="dialog"
          aria-label={`${tc("searchQuery")}: ${f.query}`}
          className="max-w-150"
          onClick={() => {
            setDraft(f.query);
            setPicking("query");
          }}
        >
          <span className="truncate">{f.query}</span>
        </TvButton>
        {searching ? (
          <TvButton icon={X} data-key="cancel" data-tv-initial={first || undefined} onClick={f.cancel}>
            {tc("cancel")}
          </TvButton>
        ) : (
          <TvButton icon={found ? RefreshCw : Search} data-key="search" data-tv-initial={(first && !found) || undefined} onClick={() => void f.search()}>
            {found ? t("refresh") : tc("search")}
          </TvButton>
        )}
      </div>

      <p className="text-body-l text-text-2" aria-live="polite">
        {searching ? (
          <span role="status">{found ? t("refreshing") : t("searching")}</span>
        ) : found ? (
          t("searchAge", { minutes: f.minutes, query: found.query })
        ) : f.status.kind === "cancelled" ? (
          t("searchCancelled")
        ) : null}
      </p>

      {f.status.kind === "idle" && !found && <TvState icon={Search} title={t("searchIdleTitle", { server: f.server })} text={t("searchIdleText")} />}
      {searching && !found && (
        <div className="flex flex-col gap-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-22 w-full animate-pulse rounded-sm bg-surface-2" />
          ))}
        </div>
      )}
      {f.status.kind === "error" &&
        (found ? (
          // A failed refresh keeps the answer shown, said with its age; Refresh above tries again.
          <p role="alert" className="flex items-start gap-3 text-body-l text-text-1">
            <CircleAlert aria-hidden className="mt-1 size-6 shrink-0 text-warning" />
            <span>
              {t("searchFailed")}. {mediaError(f.status.error)} {t("searchKept", { minutes: f.minutes })}
            </span>
          </p>
        ) : (
          <TvState icon={CircleAlert} title={t("searchFailedTitle", { server: f.server })} text={mediaError(f.status.error)}>
            <TvButton icon={RefreshCw} data-tv-initial onClick={() => void f.search()}>
              {tc("retry")}
            </TvButton>
          </TvState>
        ))}
      {found && found.results.length === 0 && !searching && (
        <TvState
          icon={SearchX}
          title={t("searchEmpty", { query: found.query })}
          text={`${t("searchEmptyHint")}${found.skipped > 0 ? ` ${t("searchSkipped", { count: found.skipped })}` : ""}`}
        >
          <TvButton
            icon={Search}
            data-tv-initial
            onClick={() => {
              setDraft(f.query);
              setPicking("query");
            }}
          >
            {t("editQuery")}
          </TvButton>
        </TvState>
      )}
      {found?.emptyAt && (
        <p role="status" className="flex items-start gap-3 text-body-l text-text-1">
          <CircleAlert aria-hidden className="mt-1 size-6 shrink-0 text-warning" />
          {t("refreshEmpty", { minutes: Math.max(0, Math.round((Date.now() - found.emptyAt) / 60_000)) })}
        </p>
      )}

      {found && f.view && c && found.results.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            <fieldset data-zone="filters" data-zone-axis="x" data-zone-entry="first" className="flex min-w-0 flex-wrap gap-4">
              <legend className="sr-only">{t("filters")}</legend>
              {c.options.length > 1 && (
                <TvButton icon={AudioLines} aria-haspopup="dialog" className="max-w-150" onClick={() => setPicking("voice")}>
                  <span className="truncate">{`${tp("voiceChoice")} · ${voiceValue}`}</span>
                </TvButton>
              )}
              {c.editions.length > 1 && (
                <TvButton icon={Film} aria-haspopup="dialog" onClick={() => setPicking("edition")}>
                  {`${tt("pickEdition")} · ${editionValue}`}
                </TvButton>
              )}
              {c.pool.length > 1 && (
                <TvButton icon={MonitorPlay} aria-haspopup="dialog" onClick={() => setPicking("quality")}>
                  {`${tt("pickQuality")} · ${qualityValue}`}
                </TvButton>
              )}
              <TvButton icon={ArrowDownUp} aria-haspopup="dialog" aria-label={`${t("sortBy")}: ${t(`sort_${f.sort}`)}`} onClick={() => setPicking("sort")}>
                {t(`sort_${f.sort}`)}
              </TvButton>
              {(option || f.edition || f.picture) && (
                <TvButton icon={RotateCcw} onClick={f.reset}>
                  {tc("resetFilters")}
                </TvButton>
              )}
            </fieldset>
            {/* The chosen audio's releases, the recommendation among them; what can't be picked is counted apart. */}
            {chosen && <p className="text-body-l text-text-2 tabular-nums">{t("shownCount", { shown: 1 + f.listed.rows.length, total: f.view.ranked.length })}</p>}
          </div>

          {chosen ? (
            <ul ref={list} data-zone="releases" data-zone-axis="grid" onFocus={onListFocus} className="flex flex-col gap-5">
              {row(chosen.result, chosen, -1, true)}
              {rows.map((x, i) => row(x.result, x, i))}
            </ul>
          ) : (
            <TvState icon={SearchX} title={tt("tsNothing")}>
              <TvButton
                icon={Search}
                onClick={() => {
                  setDraft(f.query);
                  setPicking("query");
                }}
              >
                {t("editQuery")}
              </TvButton>
            </TvState>
          )}

          {f.listed.rest.length > 0 && (
            <div className="flex flex-col gap-5">
              {nothingPicked ? (
                <p className="text-body-l font-semibold text-text-2">{t("restResults", { count: f.listed.rest.length })}</p>
              ) : (
                <div data-zone="rest-toggle">
                  <TvButton aria-expanded={restOpen} onClick={() => setRestOpen((o) => !o)}>
                    {t("restResults", { count: f.listed.rest.length })}
                    <ChevronDown aria-hidden className={cn("transition-transform duration-fast ease-fast", restOpen && "rotate-180")} />
                  </TvButton>
                </div>
              )}
              {rest.length > 0 && (
                <ul data-zone="rest" data-zone-axis="grid" onFocus={onRestFocus} className="flex flex-col gap-5">
                  {rest.map((r, i) => row(r, f.view?.byLink.get(r.link), i))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {picking === "server" && (
        <ChoiceLayer
          title={t("serverLabel")}
          options={connections.map((c) => ({ value: c.id, label: c.name }))}
          value={f.connId}
          onPick={f.setConnId}
          onClose={() => setPicking(null)}
        />
      )}
      {picking === "voice" && c && (
        <ChoiceLayer
          title={tp("voiceChoice")}
          options={[{ value: "all", label: t("anyVoice") }, ...c.options.map((o) => ({ value: o.key, label: f.optionLabel(o) }))]}
          value={option?.key ?? "all"}
          onPick={(v) => f.choose({ voice: v === "all" ? null : v })}
          onClose={() => setPicking(null)}
        />
      )}
      {picking === "edition" && c && (
        <ChoiceLayer
          title={tt("pickEdition")}
          options={[{ value: "all", label: t("anyEdition") }, ...c.editions.map((e) => ({ value: e.key, label: `${editionName(e.key)} · ${text.resolutions(e.resolutions)}` }))]}
          value={f.edition ?? "all"}
          onPick={(v) => f.choose({ edition: v === "all" ? null : v })}
          onClose={() => setPicking(null)}
        />
      )}
      {picking === "quality" && c && (
        <ChoiceLayer
          title={tt("pickQuality")}
          // The mode picks the version for this screen (Auto), the best one or the smallest file; a version by hand narrows the list.
          options={[
            ...QUALITY_MODES.map((m) => ({ value: `mode:${m}`, label: tt(`tsQuality_${m}`) })),
            ...(c.versions.length > 1
              ? [...c.versions]
                  .sort((a, b) => (b.resolution ?? -1) - (a.resolution ?? -1))
                  .map((v) => ({ value: `picture:${v.key}`, label: [text.version(v.resolution, v.range), formatSize(v.best.result.size, locale)].filter(Boolean).join(" · ") }))
              : []),
          ]}
          value={f.picture ? `picture:${f.picture}` : `mode:${f.mode}`}
          onPick={(v) => (v.startsWith("mode:") ? f.choose({ mode: v.slice(5) as (typeof QUALITY_MODES)[number] }) : f.choose({ picture: v.slice(8) }))}
          onClose={() => setPicking(null)}
        />
      )}
      {picking === "sort" && (
        <ChoiceLayer
          title={t("sortBy")}
          options={SORTS.map((o) => ({ value: o, label: t(`sort_${o}`) }))}
          value={f.sort}
          onPick={(v) => f.setSort(v as Sort)}
          onClose={() => setPicking(null)}
        />
      )}
      {picking === "query" && (
        <QueryLayer
          draft={draft}
          onDraft={setDraft}
          onClose={(submit) => {
            setPicking(null);
            if (!submit) return;
            f.setQuery(draft);
            void f.search(draft);
          }}
        />
      )}
      {f.detailed && (
        <DetailsLayer
          r={f.detailed}
          x={f.view?.byLink.get(f.detailed.link)}
          linked={f.isLinked(f.detailed)}
          server={f.server}
          series={d.kind === "tv"}
          onClose={(watchIt) => {
            const r = f.detailed;
            f.setDetailed(null);
            if (watchIt && r) watch(r);
          }}
        />
      )}
    </section>
  );
}

/** One release: its labels, what it is in words, where and how much — one stop, OK is "Watch"; "i" beside. */
function TvReleaseRow({
  r,
  x,
  heard,
  index,
  initial,
  recommended,
  linked,
  series,
  season,
  onWatch,
  onDetails,
}: {
  r: TsSearchResult;
  x: RankedRelease | undefined;
  /** What OK plays, in words (`Finder.heard`): the profile's studio, not every track the name lists. */
  heard: (x: RankedRelease) => string;
  index: number;
  initial: boolean;
  recommended: boolean;
  linked: boolean;
  series: boolean;
  season: number | null;
  onWatch: () => void;
  onDetails: () => void;
}) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const tp = useTranslations("titlePage");
  const locale = useLocale();
  const text = useReleaseText();
  const size = formatSize(r.size, locale);
  const where = [
    x && series ? packWords(t, x.info.pack) || null : null,
    size ? (x && series && isPack(x.info.pack) ? t("packWhole", { size }) : size) : null,
    r.seeders !== null ? tt("tsSeeders", { count: r.seeders }) : t("seedersUnknownShort"),
    trackersOf(r).filter(Boolean).join(", ") || null,
    formatDate(r.published, locale),
  ];
  // As the web's rows: what is heard is the title; its quality marks, then where and how much.
  const meta = x ? <ReleaseLine info={x.info} rest={where} /> : where.filter(Boolean).join(" · ");
  const other = x ? text.otherLanguages(x) : null;
  return (
    // The focused row grows with its ring (1.5 % of a wide row is ~12 px a side at 1920): room for it before "i".
    <li className="flex items-center gap-8">
      <TvButton
        look="row"
        data-key={releaseDomId(r.link)}
        data-link={releaseDomId(r.link)}
        data-index={index}
        data-tv-initial={initial || undefined}
        className="min-h-22 flex-1 py-3"
        onClick={onWatch}
      >
        <Magnet aria-hidden className="self-start" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {(recommended || x) && (
            <span className="flex flex-wrap items-center gap-2 empty:hidden">
              {recommended && <AccentBadge>{tt("tsRecommended")}</AccentBadge>}
              {x && <ReleaseTag x={x} linked={linked} season={season} />}
            </span>
          )}
          <span className="break-words text-body-l">{x ? heard(x) || text.option({ studio: null, voice: null, language: null }) : r.title}</span>
          <span className="font-normal opacity-75">
            {meta}
            {other && <span className="block">{other}</span>}
            {!x && <span className="block">{t("detailOtherTitle")}</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 opacity-75">
          <Play aria-hidden className="fill-current" />
          {tt("tsWatch")}
        </span>
      </TvButton>
      <TvButton look="round" icon={Info} label={tp("releaseDetails")} data-key={`${releaseDomId(r.link)}#i`} onClick={onDetails} />
    </li>
  );
}

/**
 * A release's details on a TV: the same as the site's dialog — the marks and the audio under the heading,
 * every fact the name and the indexer give, "Watch" — in a wide card in the middle: "Watch" beside the heading, the
 * short facts two to a row and the long ones (the audio, this device, the name) across, so all of it is read without a
 * stop of its own. What "Watch" does is said to a screen reader, as on the site.
 */
function DetailsLayer({
  r,
  x,
  linked,
  server,
  series,
  onClose,
}: {
  r: TsSearchResult;
  x: RankedRelease | undefined;
  linked: boolean;
  server: string;
  series: boolean;
  onClose: (watch: boolean) => void;
}) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const tp = useTranslations("titlePage");
  const text = useReleaseText();
  const facts = useReleaseFacts();
  // Started once the layer's history entry is gone (a change of the address before that would land in it).
  const watchIt = useRef(false);
  const wide = (v: string) => v.length > 28 || v.includes("\n");
  const rows = facts(r, x, series);
  return (
    <TvLayer label={tp("releaseDetails")} onClose={() => onClose(watchIt.current)} className="max-w-240">
      {(close) => (
        <>
          <div className="flex items-start gap-8">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2 className="text-h2 text-text-1">{tp("releaseDetails")}</h2>
              <p className="text-body-l text-text-2">{x ? <ReleaseLine info={x.info} rest={[text.audio(x)]} /> : t("detailOtherTitle")}</p>
            </div>
            <div data-zone="release-watch" className="shrink-0">
              <TvButton
                icon={Play}
                data-tv-initial
                onClick={() => {
                  watchIt.current = true;
                  close();
                }}
              >
                {tt("tsWatch")}
              </TvButton>
              <p className="sr-only">{linked ? t("playsFrom", { server }) : t("addsTo", { server })}</p>
            </div>
          </div>
          <dl className="grid min-h-0 grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] content-start gap-x-6 gap-y-3 overflow-hidden text-body">
            {[...rows.filter(([, v]) => !wide(v)), ...rows.filter(([, v]) => wide(v))].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className={cn("text-text-2", wide(v) && "col-start-1")}>{k}</dt>
                <dd className={cn("line-clamp-3 whitespace-pre-line break-words text-text-1", wide(v) && "col-span-3")}>{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </TvLayer>
  );
}

/** The query in a card: the TV's keyboard (and the phone remote's text), "Search" — Back leaves it as it was. */
function QueryLayer({ draft, onDraft, onClose }: { draft: string; onDraft: (v: string) => void; onClose: (submit: boolean) => void }) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const submit = useRef(false);
  return (
    <TvLayer label={t("editQuery")} onClose={() => onClose(submit.current)}>
      {(close) => {
        const go = () => {
          submit.current = true;
          close();
        };
        return (
          <>
            <h2 className="text-h2 text-text-1">{t("editQuery")}</h2>
            <div className="flex w-120 flex-col gap-6">
              <TvKeyboard value={draft} onChange={onDraft} label={tc("searchQuery")} onSubmit={go} />
              <div data-zone="query-go" data-zone-up="keys">
                <TvButton icon={Search} onClick={go}>
                  {tc("search")}
                </TvButton>
              </div>
            </div>
          </>
        );
      }}
    </TvLayer>
  );
}
