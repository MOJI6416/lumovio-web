"use client";

import { Ellipsis, Info, Magnet, Pencil, Play, RefreshCw, Search, SearchX, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { InfoTip } from "@/components/sources/InfoTip";
import { useMediaErrorText } from "@/components/sources/media-error";
import { formatSize, isPack, packWords, ReleaseTag, useReleaseFacts, useReleaseText } from "@/components/sources/release-text";
import { SourceRow, SourceSection } from "@/components/sources/SourceRow";
import { AccentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { SidePanel } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input } from "@/components/ui/Input";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import type { RankedRelease } from "@/lib/media/releases";
import { type TsSearchResult, trackersOf } from "@/lib/media/torrserver";
import { type FinderProps, PAGE, SORTS, useTorrentFinder } from "./finder";

export type { FinderPick, FinderStart } from "./finder";

/**
 * "Through TorrServer" on the sources screen (design-system 7.15, S26, TS4; SRC-07…SRC-13): the profile's own indexers
 * searched through its own TorrServer, straight from this device (Lumovio's servers never search, store or relay
 * torrents). Only servers this profile may use are offered, labelled, the last used first (SRC-11). One row of
 * filters — audio by language, picture version, tracker, order (SRC-08, SRC-10) — over SourceRows with one "Watch"
 * (SRC-07); the recommended one has its AccentBadge, a cinema recording its Tag (SRC-12); details in a side panel
 * (a sheet on a phone). That "Watch" adds the release to the TorrServer is in the section's "i". Nothing changes until
 * a release is picked; the title page's search of the same title shows at once, with its age.
 */
export function TorrentFinder(props: FinderProps) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const mediaError = useMediaErrorText();
  const f = useTorrentFinder(props);
  const { details: d, season, connections } = props;
  const { connId, setConnId, query, setQuery, editing, setEditing, found, status, search, cancel, sort, setSort, voice, picture, tracker, filter, filtered, reset, shown, setShown, detailed, setDetailed, view, options, versions, trackers, visible, recommended, isLinked, pick, minutes, optionLabel, where, server } = f;
  const text = useReleaseText();
  const list = useRef<HTMLUListElement>(null);
  // "Edit search": the field shows (folded on a phone) and takes the focus.
  const editQuery = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      const field = document.getElementById("ts-query") as HTMLInputElement | null;
      field?.focus();
      field?.select();
    });
  };

  const searchForm = (
    <form
      className="flex min-w-0 flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void search();
      }}
    >
      {connections.length > 1 && (
        <div className="flex min-w-0 flex-col gap-1 max-sm:w-full">
          <span id="ts-server-label" className="text-body-s font-semibold text-text-2">
            {t("serverLabel")}
          </span>
          <Select value={connId} onValueChange={setConnId} options={connections.map((c) => ({ value: c.id, label: c.name }))} aria-describedby="ts-server-label" aria-label={t("serverLabel")} className="min-w-40" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
        <label htmlFor="ts-query" className="text-body-s font-semibold text-text-2">
          {tc("searchQuery")}
        </label>
        <Input id="ts-query" value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
      </div>
      {status.kind === "searching" ? (
        <Button type="button" variant="secondary" icon={X} onClick={cancel}>
          {tc("cancel")}
        </Button>
      ) : (
        <Button type="submit" variant="secondary" icon={Search}>
          {tc("search")}
        </Button>
      )}
    </form>
  );

  return (
    <SourceSection
      id="finder-h"
      title={tp("viaTorrServer", { name: server })}
      info={<InfoTip title={tp("viaTorrServer", { name: server })} note={`${t("finderNote", { server })} ${where}`} rules={t("finderRules")} />}
    >
      {/* The query, on a phone folded into one line until it is to be changed (SRC-10: the filters and the first results fit the first screen). */}
      <div className={editing || !found ? undefined : "max-md:hidden"}>{searchForm}</div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-s text-text-2" aria-live="polite">
        {status.kind === "searching" ? (
          <span role="status">{found ? t("refreshing") : t("searching")}</span>
        ) : found ? (
          <span>{t("searchAge", { minutes, query: found.query })}</span>
        ) : status.kind === "cancelled" ? (
          <span>{t("searchCancelled")}</span>
        ) : null}
        {found && status.kind !== "searching" && (
          <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={() => void search()}>
            {t("refresh")}
          </Button>
        )}
        {!editing && found && (
          <Button variant="tertiary" size="sm" icon={Pencil} onClick={editQuery} className="md:hidden">
            {t("editQuery")}
          </Button>
        )}
        {status.kind === "searching" && (
          <Button variant="tertiary" size="sm" icon={X} onClick={cancel} className="md:hidden">
            {tc("cancel")}
          </Button>
        )}
      </div>

      {status.kind === "idle" && !found && (
        <EmptyState icon={Search} title={t("searchIdleTitle", { server })} text={t("searchIdleText")} className="items-start px-0 py-2 text-start" />
      )}
      {status.kind === "searching" && !found && (
        <div className="flex flex-col gap-3" aria-hidden>
          <Skeleton shape="md" className="h-22 w-full" />
          <Skeleton shape="md" className="h-22 w-full" />
          <Skeleton shape="md" className="h-22 w-full" />
        </div>
      )}
      {status.kind === "error" &&
        (found ? (
          <InlineAlert
            tone="danger"
            title={t("searchFailed")}
            action={
              <Button variant="tertiary" size="sm" onClick={() => void search()}>
                {tc("retry")}
              </Button>
            }
          >
            {mediaError(status.error)} {t("searchKept", { minutes })}
          </InlineAlert>
        ) : (
          <ErrorState error={status.error} title={t("searchFailedTitle", { server })} text={mediaError(status.error)} onRetry={() => void search()} details={null} />
        ))}
      {found && found.results.length === 0 && status.kind !== "searching" && (
        <EmptyState
          icon={SearchX}
          title={t("searchEmpty", { query: found.query })}
          text={`${t("searchEmptyHint")}${found.skipped > 0 ? ` ${t("searchSkipped", { count: found.skipped })}` : ""}`}
          action={
            <Button variant="secondary" icon={Pencil} onClick={editQuery}>
              {t("editQuery")}
            </Button>
          }
          className="items-start px-0 py-2 text-start"
        />
      )}
      {found?.emptyAt && <InlineAlert tone="warning">{t("refreshEmpty", { minutes: Math.max(0, Math.round((Date.now() - found.emptyAt) / 60_000)) })}</InlineAlert>}

      {found && view && found.results.length > 0 && (
        <>
          {/* One row of filters (SRC-08, SRC-10): it scrolls sideways on a phone instead of stacking. */}
          <fieldset className="-mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            <legend className="sr-only">{t("filters")}</legend>
            {options.length > 1 && (
              // Past ten voice-overs the list gets a search (7.6): a Combobox of the same small size.
              <ListChoice
                many={options.length + 1 > 10}
                value={voice ?? "all"}
                onValueChange={(v) => filter("voice", v === "all" ? null : v)}
                options={[{ value: "all", label: t("allVoices") }, ...options.map((o) => ({ value: o.key, label: optionLabel(o) }))]}
                aria-label={tt("tsVoices")}
                className="w-auto max-w-72 shrink-0"
              />
            )}
            {versions.length > 1 && (
              <Select
                size="sm"
                value={picture ?? "all"}
                onValueChange={(v) => filter("picture", v === "all" ? null : v)}
                options={[{ value: "all", label: t("allPictures") }, ...versions.map((v) => ({ value: v.key, label: `${text.version(v.resolution, v.range)} · ${v.count}` }))]}
                aria-label={t("pictureVersions")}
                className="w-auto shrink-0"
              />
            )}
            {trackers.length > 1 && (
              <Select
                size="sm"
                value={tracker ?? "all"}
                onValueChange={(v) => filter("tracker", v === "all" ? null : v)}
                options={[{ value: "all", label: t("allTrackersCount", { count: found.results.length }) }, ...trackers.map(([name, n]) => ({ value: name, label: `${name === "?" ? t("trackerUnknown") : name} · ${n}` }))]}
                aria-label={t("trackers")}
                className="w-auto shrink-0"
              />
            )}
            <Select size="sm" value={sort} onValueChange={setSort} options={SORTS.map((o) => ({ value: o, label: t(`sort_${o}`) }))} aria-label={t("sortBy")} className="w-auto shrink-0" />
            {filtered && (
              <Button variant="tertiary" size="sm" onClick={reset} className="shrink-0">
                {tc("resetFilters")}
              </Button>
            )}
            {/* The title's releases, as the title page counts them ("All releases · 10"); other results of the query apart (TS5, SRC-09). */}
            <span className="shrink-0 text-body-s text-text-2 tabular-nums">
              {t("shownCount", { shown: visible.filter((r) => view.byLink.has(r.link)).length, total: view.ranked.length })}
              {view.rest.length > 0 && voice === null && picture === null ? ` · ${t("otherResults", { count: visible.length - visible.filter((r) => view.byLink.has(r.link)).length })}` : ""}
            </span>
          </fieldset>

          {visible.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t("filteredEmpty")}
              text={t("filteredEmptyText")}
              action={
                <Button variant="secondary" onClick={reset}>
                  {tc("resetFilters")}
                </Button>
              }
              className="items-start px-0 py-2 text-start"
            />
          ) : (
            <ul ref={list} className="flex flex-col gap-2">
              {visible.slice(0, shown).map((r) => (
                <li key={r.link}>
                  <ReleaseRow
                    r={r}
                    x={view.byLink.get(r.link)}
                    recommended={view.byLink.get(r.link) === recommended}
                    linked={isLinked(r)}
                    tv={d.kind === "tv"}
                    season={season}
                    locale={locale}
                    onWatch={(anchor) => pick(r, anchor)}
                    onDetails={() => setDetailed(r)}
                  />
                </li>
              ))}
            </ul>
          )}
          {visible.length > shown && (
            <Button className="self-center" variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
              {t("moreResults", { count: visible.length - shown })}
            </Button>
          )}
        </>
      )}
      <ReleaseDetails
        r={detailed}
        x={detailed ? view?.byLink.get(detailed.link) : undefined}
        linked={detailed ? isLinked(detailed) : false}
        server={server}
        tv={d.kind === "tv"}
        onClose={() => setDetailed(null)}
        onWatch={() => {
          const r = detailed;
          setDetailed(null);
          if (r) pick(r, list.current?.querySelector(`[data-link="${CSS.escape(r.link)}"]`) ?? null);
        }}
      />
    </SourceSection>
  );
}

/** One release (7.15): what it is in words, where and how much, at most two labels, one "Watch" and "More". */
function ReleaseRow({
  r,
  x,
  recommended,
  linked,
  tv,
  season,
  locale,
  onWatch,
  onDetails,
}: {
  r: TsSearchResult;
  x: RankedRelease | undefined;
  recommended: boolean;
  linked: boolean;
  tv: boolean;
  season: number | null;
  locale: string;
  onWatch: (anchor: Element) => void;
  onDetails: () => void;
}) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const tp = useTranslations("titlePage");
  const text = useReleaseText();
  const pack = x && tv ? packWords(t, x.info.pack) : "";
  const size = formatSize(r.size, locale);
  const trackersText = trackersOf(r).filter(Boolean).join(", ");
  const tag = x ? <ReleaseTag x={x} linked={linked} season={season} /> : null;
  const other = x ? text.otherLanguages(x) : null;
  return (
    <SourceRow
      selected={recommended}
      icon={<Magnet />}
      badges={
        recommended || tag ? (
          <>
            {recommended && <AccentBadge>{tt("tsRecommended")}</AccentBadge>}
            {tag}
          </>
        ) : undefined
      }
      title={x ? [text.picture(x.info), text.audio(x)].filter(Boolean).join(" · ") : <span className="line-clamp-2">{r.title}</span>}
      meta={
        <>
          {[
            pack || null,
            size ? (x && tv && isPack(x.info.pack) ? t("packWhole", { size }) : size) : null,
            r.seeders !== null ? tt("tsSeeders", { count: r.seeders }) : t("seedersUnknownShort"),
            trackersText || null,
            formatDate(r.published, locale),
          ]
            .filter(Boolean)
            .join(" · ")}
          {other && <span className="mt-0.5 block">{other}</span>}
          {!x && <span className="mt-0.5 block">{t("detailOtherTitle")}</span>}
        </>
      }
      action={
        <Button variant="secondary" data-link={r.link} onClick={(e) => onWatch(e.currentTarget)}>
          <Play aria-hidden className="fill-current" />
          {tt("tsWatch")}
        </Button>
      }
      more={
        <Menu trigger={<IconButton icon={Ellipsis} variant="secondary" label={tp("releaseMore")} />} label={tp("releaseMore")}>
          <MenuItem icon={Info} onSelect={onDetails}>
            {tp("releaseDetails")}
          </MenuItem>
        </Menu>
      }
    />
  );
}

/** A release's details (7.15): its facts (`useReleaseFacts`) and "Watch" in a side panel; a sheet on a phone. */
function ReleaseDetails({
  r,
  x,
  linked,
  server,
  tv,
  onClose,
  onWatch,
}: {
  r: TsSearchResult | null;
  x: RankedRelease | undefined;
  linked: boolean;
  server: string;
  tv: boolean;
  onClose: () => void;
  onWatch: () => void;
}) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const tp = useTranslations("titlePage");
  const text = useReleaseText();
  const facts = useReleaseFacts();
  const rows = r ? facts(r, x, tv) : [];
  return (
    <SidePanel open={r !== null} onOpenChange={(o) => !o && onClose()} title={tp("releaseDetails")} description={x ? [text.picture(x.info), text.audio(x)].filter(Boolean).join(" · ") : undefined}>
      {r && !x && <p className="mb-4 text-body-s text-text-2">{t("detailOtherTitle")}</p>}
      <dl className="flex flex-col gap-4">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-body-s text-text-2">{k}</dt>
            <dd className="mt-0.5 whitespace-pre-line break-words text-body text-text-1">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-col gap-2">
        <Button onClick={onWatch}>
          <Play aria-hidden className="fill-current" />
          {tt("tsWatch")}
        </Button>
        <p className="text-body-s text-text-2">{linked ? t("playsFrom", { server }) : t("addsTo", { server })}</p>
      </div>
    </SidePanel>
  );
}

/** A filter of the sources screen: a small Select, or a Combobox of the same size past ten options (7.6). */
function ListChoice({
  many,
  ...props
}: {
  many: boolean;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  "aria-label": string;
  className?: string;
}) {
  return many ? <Combobox size="sm" {...props} /> : <Select size="sm" {...props} />;
}
