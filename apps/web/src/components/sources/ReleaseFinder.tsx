"use client";

import { ChevronDown, Info, Play, RefreshCw, Search, TriangleAlert, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useId, useRef, useState } from "react";
import { type FinderProps, PAGE, SITE_SORTS, useTorrentFinder } from "@/components/player/finder";
import { CardMark, PickItem, PickPill, WatchCard } from "@/components/title/WatchCard";
import { StatusBadge, Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import { SearchInput } from "@/components/ui/Input";
import { Menu, MenuCheckboxItem, MenuSeparator } from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTitleAvailability } from "@/hooks/useAvailability";
import { useReleasePrefs } from "@/hooks/useTorrentLookup";
import { formatDate } from "@/lib/format";
import { type Edition, editionOf } from "@/lib/media/editions";
import { isDubbing, type RankedRelease, releaseDomId, voiceWish, wishNameTrack } from "@/lib/media/releases";
import { type TsSearchResult, trackersOf } from "@/lib/media/torrserver";
import { ReleaseDetails } from "./Details";
import { useMediaErrorText } from "./media-error";
import { formatSize, isPack, packWords, QUALITY_MODES, ReleaseLine, studioShown, useReleaseText, VersionLine } from "./release-text";

const CARD = "finder-card-h";

/**
 * The sources screen's TorrServer search (design-system 7.15 «Экран источников», S26): "Where to watch" unfolded. The
 * same card says what will be watched — the release the pills pick, the white "Watch" when nothing else on the screen
 * starts first — and the same pills choose: the audio, the cut of the film, the quality. Here they narrow a list: under
 * the card, the other releases they leave, in the chosen order; folded under it, what can't be picked (other titles of
 * the query, cinema recordings, no seeders, other seasons). A row opens the release's details; its "Watch" adds it to
 * the TorrServer and starts it. The query and the server are a button at the end of the pills; every state (a server
 * that doesn't search by itself, searching, no answer, nothing found) is the card. Nothing explains itself on screen:
 * how the search works is for a screen reader.
 */
export function ReleaseFinder(props: FinderProps) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const mediaError = useMediaErrorText();
  // The cut chosen on the title page comes in the address ("&edition=extended"), as its audio and picture do.
  const params = useSearchParams();
  const start = props.start ?? { voice: null, picture: null, quality: null };
  const f = useTorrentFinder({ ...props, start: { ...start, edition: start.edition ?? params.get("edition") } }, { modeInSort: false });
  const { details: d, season, episode, connections } = props;
  const { found, status, choice, listed, server } = f;
  const avail = useTitleAvailability(d.id);
  // The white "Watch" only for the screen's first way to watch: not under a copy on the profile's servers.
  const copiesHere = (avail.data?.servers ?? []).some((s) => s.kind !== "torrserver" || s.season === null || (s.season === season && s.episode === episode));
  const lead = props.lead ?? !copiesHere;
  const [restOpen, setRestOpen] = useState(false);
  const [restShown, setRestShown] = useState(PAGE);
  const list = useRef<HTMLDivElement>(null);
  const tv = d.kind === "tv";
  const searching = status.kind === "searching";
  const via = tp("viaTorrServer", { name: server });

  const editQuery = () => {
    f.setEditing(true);
    requestAnimationFrame(() => {
      const field = document.getElementById("ts-query") as HTMLInputElement | null;
      field?.focus();
      field?.select();
    });
  };
  const form = <QueryForm f={f} connections={connections} lead={lead && !found} onCancel={found ? () => f.setEditing(false) : undefined} />;
  const mark = <CardMark kind="torrserver" />;
  const about = <p className="sr-only">{`${t("finderNote", { server })} ${f.where} ${t("finderRules")}`}</p>;

  let card: ReactNode;
  if (!found && searching) {
    card = (
      <WatchCard
        id={CARD}
        mark={mark}
        heading={
          <>
            <span className="sr-only" aria-live="polite">
              {tt("tsSearching", { name: server })}
            </span>
            <Skeleton className="h-5 w-3/5 max-w-80" />
          </>
        }
        quality={<Skeleton className="h-4 w-2/5 max-w-56" />}
        where={<span className="text-text-3">{tt("tsSearching", { name: server })}</span>}
        actions={
          <Button variant="secondary" size="lg" icon={X} onClick={f.cancel}>
            {tc("cancel")}
          </Button>
        }
      />
    );
  } else if (!found && status.kind === "error") {
    card = (
      <WatchCard
        id={CARD}
        mark={mark}
        heading={<span aria-live="polite">{tt("tsFailed", { name: server })}</span>}
        where={mediaError(status.error)}
        actions={
          <>
            <Button variant="secondary" size="lg" icon={RefreshCw} onClick={() => void f.search()}>
              {tc("retry")}
            </Button>
            {!f.editing && (
              <Button variant="tertiary" size="lg" onClick={editQuery}>
                {t("editQuery")}
              </Button>
            )}
          </>
        }
      >
        {f.editing ? form : undefined}
      </WatchCard>
    );
  } else if (!found) {
    // A server that leaves the search to the person (its "search automatically" is off), or a search stopped: the query to send.
    card = (
      <WatchCard id={CARD} mark={mark} heading={status.kind === "cancelled" ? t("searchStopped") : server} where={status.kind === "cancelled" ? via : "TorrServer"}>
        {form}
      </WatchCard>
    );
  } else if (!choice?.chosen) {
    card = (
      <WatchCard
        id={CARD}
        mark={mark}
        heading={<span aria-live="polite">{tt("tsNothing")}</span>}
        where={`«${found.query}» · ${via}`}
        note={found.skipped > 0 ? <span className="sr-only">{t("searchSkipped", { count: found.skipped })}</span> : undefined}
        actions={
          !f.editing && (
            <Button variant="secondary" size="lg" icon={Search} onClick={editQuery}>
              {t("editQuery")}
            </Button>
          )
        }
      >
        {f.editing ? form : undefined}
      </WatchCard>
    );
  } else {
    card = <PickCard f={f} lead={lead} tv={tv} form={form} editQuery={editQuery} />;
  }

  const rest = listed.rest;
  const rows = listed.rows;
  const nothingPicked = Boolean(found) && !choice?.chosen;
  return (
    <section aria-labelledby="finder-h" className="flex flex-col gap-8">
      <h2 id="finder-h" className="sr-only">
        {via}
      </h2>
      {about}
      {card}
      {rows.length > 0 && (
        <section aria-labelledby="releases-h" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 id="releases-h" className="text-body-s font-semibold text-text-2">
              {t("otherReleases", { count: rows.length })}
            </h3>
            <SortPill value={f.sort} onChange={(s) => f.setSort(s)} />
          </div>
          <div ref={list}>
            <ReleaseList rows={rows.slice(0, f.shown).map((x) => ({ r: x.result, x }))} f={f} tv={tv} season={season} locale={locale} />
          </div>
          {rows.length > f.shown && (
            <Button className="self-center" variant="secondary" onClick={() => f.setShown((n) => n + PAGE)}>
              {t("moreResults", { count: rows.length - f.shown })}
            </Button>
          )}
        </section>
      )}
      {rest.length > 0 && (
        <section aria-labelledby="rest-h" className="flex flex-col gap-2">
          {nothingPicked ? (
            <h3 id="rest-h" className="text-body-s font-semibold text-text-2">
              {t("restResults", { count: rest.length })}
            </h3>
          ) : (
            <h3 id="rest-h">
              <Button variant="tertiary" size="sm" aria-expanded={restOpen} aria-controls="rest-list" onClick={() => setRestOpen((o) => !o)} className="-ms-3">
                {t("restResults", { count: rest.length })}
                <ChevronDown aria-hidden className={`transition-transform duration-fast ease-fast ${restOpen ? "rotate-180" : ""}`} />
              </Button>
            </h3>
          )}
          {(restOpen || nothingPicked) && (
            <div id="rest-list" className="flex flex-col gap-2">
              <ReleaseList rows={rest.slice(0, restShown).map((r) => ({ r, x: f.view?.byLink.get(r.link) }))} f={f} tv={tv} season={season} locale={locale} />
              {rest.length > restShown && (
                <Button className="self-center" variant="secondary" onClick={() => setRestShown((n) => n + PAGE)}>
                  {t("moreResults", { count: rest.length - restShown })}
                </Button>
              )}
            </div>
          )}
        </section>
      )}
      <ReleaseDetails
        result={f.detailed}
        release={f.detailed ? f.view?.byLink.get(f.detailed.link) : undefined}
        note={f.detailed && f.isLinked(f.detailed) ? t("playsFrom", { server }) : t("addsTo", { server })}
        tv={tv}
        onClose={() => f.setDetailed(null)}
        onWatch={() => {
          const r = f.detailed;
          f.setDetailed(null);
          if (r) f.pick(r, document.querySelector(`[data-link="${releaseDomId(r.link)}"]`));
        }}
      />
    </section>
  );
}

type Finder = ReturnType<typeof useTorrentFinder>;

/**
 * The release the pills pick, in the card of "Where to watch": what is heard, the marks and what they don't say, where
 * from; "Watch" and "i"; under a line the pills — the same ones, with "Any" first where they narrow the list — and the
 * query at the row's end.
 */
function PickCard({ f, lead, tv, form, editQuery }: { f: Finder; lead: boolean; tv: boolean; form: ReactNode; editQuery: () => void }) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const text = useReleaseText();
  const prefs = useReleasePrefs();
  const c = f.choice!;
  const chosen = c.chosen!;
  const option = c.option;
  const found = f.found!;
  const editionName = (e: Edition) => tt(`edition_${e}`);
  const resolutions = text.resolutions;
  // "Any" audio: what "Watch" plays of the release (the profile's studio), not every track it lists.
  const heard =
    (option ? text.audio({ info: chosen.info, language: option.language ?? chosen.language }, option.studio ?? wishNameTrack(chosen.info, voiceWish(option.key), prefs.studios)) : f.heard(chosen)) ||
    text.option({ studio: null, voice: null, language: null });
  const size = formatSize(chosen.result.size, locale);
  const pack = tv ? packWords(t, chosen.info.pack) : "";
  // The cut in words, unless its pill names it.
  const cutWords = c.edition && !(c.editions.length > 1 && f.edition) ? editionName(c.edition) : null;
  const linked = f.isLinked(chosen.result);
  const studioMatch = chosen.studio && (!option || option.studio === chosen.studio || (isDubbing(chosen.studio) && option.voice === "dub"));
  const kept = found.emptyAt ? tt("tsKept", { minutes: f.minutes }) : null;
  const failed = f.status.kind === "error" ? `${t("searchFailed")}. ${t("searchKept", { minutes: f.minutes })}` : null;
  const versionName = c.version ? text.version(c.version.resolution, c.version.range) : "";
  const qualityValue = f.picture ? versionName : [tt(`tsQuality_${f.mode}`), versionName].filter(Boolean).join(" · ");
  const voiceValue = option ? [text.option(option), option.language && option.language !== prefs.languages[0] ? text.language(option.language) : null].filter(Boolean).join(", ") : t("anyVoice");
  const editionValue = f.edition ? editionName(f.edition as Edition) : t("anyEdition");
  const busy = f.status.kind === "searching";

  return (
    <WatchCard
      id={CARD}
      mark={<CardMark kind="torrserver" />}
      tag={linked ? <Tag>{t("alreadyAdded")}</Tag> : studioMatch ? <Tag>{tt("tsYourVoice", { studio: studioShown(tt, chosen.studio!) })}</Tag> : undefined}
      heading={heard}
      quality={<ReleaseLine info={chosen.info} rest={[cutWords, pack || null, size ? (tv && isPack(chosen.info.pack) ? t("packWhole", { size }) : size) : null]} />}
      where={[tp("viaTorrServer", { name: f.server }), chosen.result.seeders !== null ? tt("tsSeeders", { count: chosen.result.seeders }) : null, trackersOf(chosen.result).filter(Boolean).join(", ") || null].filter(Boolean).join(" · ")}
      note={
        (chosen.fit !== "ok" || kept || failed) && (
          <>
            {chosen.fit !== "ok" && (
              <p className="flex items-start gap-1.5">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                {chosen.fit === "poor" ? tt(chosen.info.codec === "hevc" ? "tsFitHevc" : "tsFitDv") : tt("tsFitUnknown")}
              </p>
            )}
            {failed ? (
              <p className="flex flex-wrap items-center gap-x-3 text-text-2">
                {failed}
                <Button variant="tertiary" size="sm" onClick={() => void f.search()}>
                  {tc("retry")}
                </Button>
              </p>
            ) : (
              kept && <p className="text-text-2">{kept}</p>
            )}
          </>
        )
      }
      actions={
        <>
          <Button variant={lead ? "primary" : "secondary"} size="lg" data-link={releaseDomId(chosen.result.link)} onClick={(e) => f.pick(chosen.result, e.currentTarget)}>
            <Play aria-hidden className="fill-current" />
            {tt("tsWatch")}
          </Button>
          <IconButton icon={Info} variant="secondary" size="lg" label={tp("releaseDetails")} aria-haspopup="dialog" onClick={() => f.setDetailed(chosen.result)} />
        </>
      }
    >
      {f.editing ? (
        form
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          {/* The pills of "Where to watch": one row that scrolls sideways on a phone (to the card's edges), wrapped on wider screens. */}
          <div className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 empty:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {c.options.length > 1 && (
              <Menu label={tp("voiceChoice")} align="start" trigger={<PickPill name={tp("voiceChoice")} value={voiceValue} aria-label={tt("pickValue", { name: tp("voiceChoice"), value: voiceValue })} />}>
                <MenuCheckboxItem checked={!option} onCheckedChange={() => f.choose({ voice: null })}>
                  {t("anyVoice")}
                </MenuCheckboxItem>
                <MenuSeparator />
                {c.options.map((o) => (
                  <MenuCheckboxItem key={o.key} checked={o === option} onCheckedChange={() => f.choose({ voice: o.key })}>
                    <PickItem
                      name={text.option(o)}
                      sub={[o.language && text.option(o) !== text.cap(text.language(o.language)) ? text.cap(text.language(o.language)) : null, resolutions(o.versions.map((v) => v.resolution))].filter(Boolean).join(" · ")}
                    />
                  </MenuCheckboxItem>
                ))}
              </Menu>
            )}
            {c.editions.length > 1 && (
              <Menu label={tt("pickEdition")} align="start" trigger={<PickPill name={tt("pickEdition")} value={editionValue} aria-label={tt("pickValue", { name: tt("pickEdition"), value: editionValue })} />}>
                <MenuCheckboxItem checked={!f.edition} onCheckedChange={() => f.choose({ edition: null })}>
                  {t("anyEdition")}
                </MenuCheckboxItem>
                <MenuSeparator />
                {c.editions.map((e) => (
                  <MenuCheckboxItem key={e.key} checked={e.key === f.edition} onCheckedChange={() => f.choose({ edition: e.key })}>
                    <PickItem name={editionName(e.key)} sub={resolutions(e.resolutions)} />
                  </MenuCheckboxItem>
                ))}
              </Menu>
            )}
            {c.pool.length > 1 && (
              <Menu label={tt("pickQuality")} align="start" trigger={<PickPill name={tt("pickQuality")} value={qualityValue} aria-label={tt("pickValue", { name: tt("pickQuality"), value: qualityValue })} />}>
                {/* The mode picks the version for this screen (Auto), the best one or the smallest file, and orders the list so; a version by hand narrows it. */}
                {QUALITY_MODES.map((m) => (
                  <MenuCheckboxItem key={m} checked={!f.picture && f.mode === m} onCheckedChange={() => f.choose({ mode: m })}>
                    {tt(`tsQuality_${m}`)}
                  </MenuCheckboxItem>
                ))}
                {c.versions.length > 1 && (
                  <>
                    <MenuSeparator />
                    {[...c.versions]
                      .sort((a, b) => (b.resolution ?? -1) - (a.resolution ?? -1))
                      .map((v) => (
                        <MenuCheckboxItem key={v.key} checked={f.picture === v.key} onCheckedChange={() => f.choose({ picture: v.key })}>
                          <PickItem name={<VersionLine resolution={v.resolution} range={v.range} />} sub={formatSize(v.best.result.size, locale)} />
                        </MenuCheckboxItem>
                      ))}
                  </>
                )}
              </Menu>
            )}
          </div>
          {/* Where "Where to watch" has "All releases ›": the query, to search otherwise; a refresh says so here. */}
          {busy ? (
            <span role="status" className="inline-flex min-h-10 items-center gap-2 self-start text-body-s text-text-2 sm:ms-auto sm:self-auto">
              {t("refreshing")}
              <Button variant="tertiary" size="sm" onClick={f.cancel}>
                {tc("cancel")}
              </Button>
            </span>
          ) : (
            <Button variant="tertiary" size="sm" icon={Search} onClick={editQuery} aria-label={tt("pickValue", { name: t("editQuery"), value: found.query })} className="max-w-full self-start sm:ms-auto sm:self-auto">
              <span className="truncate">{found.query}</span>
            </Button>
          )}
        </div>
      )}
    </WatchCard>
  );
}

/** The query and, with more than one, the TorrServer to ask: a field and "Search" (white when it is the screen's way on), in the card. */
function QueryForm({ f, connections, lead, onCancel }: { f: Finder; connections: FinderProps["connections"]; lead: boolean; onCancel?: () => void }) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  return (
    <form
      className="flex min-w-0 flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void f.search();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onCancel) {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      {connections.length > 1 && (
        <Select value={f.connId} onValueChange={f.setConnId} options={connections.map((c) => ({ value: c.id, label: c.name }))} aria-label={t("serverLabel")} className="w-auto min-w-32 max-sm:w-full" />
      )}
      <SearchInput id="ts-query" value={f.query} onChange={(e) => f.setQuery(e.target.value)} enterKeyHint="search" aria-label={tc("searchQuery")} className="min-w-0 flex-1 basis-56" />
      <Button type="submit" variant={lead ? "primary" : "secondary"} icon={Search}>
        {tc("search")}
      </Button>
      {onCancel && (
        <Button type="button" variant="tertiary" onClick={onCancel}>
          {tc("cancel")}
        </Button>
      )}
      {f.found && <p className="w-full text-caption text-text-3">{t("searchAge", { minutes: f.minutes, query: f.found.query })}</p>}
    </form>
  );
}

// A menu's button, not a switch: no aria-pressed (as PickPill and the catalog's pills).
const NOT_TOGGLE = { "aria-pressed": undefined };

/** The list's order (7.4 sort pill): its value, never "selected"; the quality mode is the "Quality" pill's. */
function SortPill({ value, onChange }: { value: Finder["sort"]; onChange: (s: Finder["sort"]) => void }) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const label = t(`sort_${value}`);
  return (
    <Menu
      label={t("sortBy")}
      trigger={
        <FilterChip selected={false} {...NOT_TOGGLE} aria-label={tt("pickValue", { name: t("sortBy"), value: label })}>
          {label}
          <ChevronDown aria-hidden className="-me-0.5 size-4 shrink-0 text-text-2" />
        </FilterChip>
      }
    >
      {SITE_SORTS.map((s) => (
        <MenuCheckboxItem key={s} checked={s === value} onCheckedChange={() => onChange(s)}>
          {t(`sort_${s}`)}
        </MenuCheckboxItem>
      ))}
    </Menu>
  );
}

/** Releases as one grouped list (as "Other copies" on the title page): each with "Watch" and "i" for its details. */
function ReleaseList({ rows, f, tv, season, locale }: { rows: { r: TsSearchResult; x: RankedRelease | undefined }[]; f: Finder; tv: boolean; season: number | null; locale: string }) {
  const cuts = f.edition ? "chosen" : (f.choice?.editions.length ?? 0) > 1 ? "several" : "named";
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface-1">
      {rows.map(({ r, x }) => (
        <ReleaseItem key={r.link} r={r} x={x} heard={x ? f.heard(x) : ""} cuts={cuts} linked={f.isLinked(r)} tv={tv} season={season} locale={locale} onWatch={(el) => f.pick(r, el)} onDetails={() => f.setDetailed(r)} />
      ))}
    </ul>
  );
}

/**
 * One release (7.15): the card's anatomy at a row's size — what is heard, the marks with what they don't say and the
 * size, where from (seeders, tracker, date) — one label when something matters (a cinema recording, no seeders, another
 * season, a format this device may not play, already on the server, the profile's studio), "Watch" and "i".
 */
function ReleaseItem({
  r,
  x,
  heard,
  cuts,
  linked,
  tv,
  season,
  locale,
  onWatch,
  onDetails,
}: {
  r: TsSearchResult;
  x: RankedRelease | undefined;
  /** What "Watch" plays, in words (`Finder.heard`). */
  heard: string;
  cuts: "named" | "several" | "chosen";
  linked: boolean;
  tv: boolean;
  season: number | null;
  locale: string;
  onWatch: (el: Element) => void;
  onDetails: () => void;
}) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const tp = useTranslations("titlePage");
  const text = useReleaseText();
  const head = useId();
  const size = formatSize(r.size, locale);
  const pack = x && tv ? packWords(t, x.info.pack) : "";
  const sized = size ? (x && tv && isPack(x.info.pack) ? t("packWhole", { size }) : size) : null;
  const other = x ? text.otherLanguages(x) : null;
  const where = [r.seeders !== null ? tt("tsSeeders", { count: r.seeders }) : t("seedersUnknownShort"), trackersOf(r).filter(Boolean).join(", ") || null, formatDate(r.published, locale), other].filter(Boolean).join(" · ");
  const tag = x?.info.cam ? (
    <StatusBadge status="warning">{t("camTag")}</StatusBadge>
  ) : x?.holds === false ? (
    <Tag>{t("packOtherSeason", { season: season ?? 0 })}</Tag>
  ) : x?.dead ? (
    <Tag>{t("noSeeders")}</Tag>
  ) : x?.fit === "poor" ? (
    <StatusBadge status="warning">{tt(x.info.codec === "hevc" ? "tsFitHevcShort" : "tsFitDvShort")}</StatusBadge>
  ) : linked ? (
    <Tag>{t("alreadyAdded")}</Tag>
  ) : x?.studio ? (
    <Tag>{tt("tsYourVoice", { studio: studioShown(tt, x.studio) })}</Tag>
  ) : null;
  return (
    <li className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        {tag && <div className="mb-1.5 flex flex-wrap gap-1.5">{tag}</div>}
        <p id={head} className="text-title break-words text-text-1">
          {x ? heard || text.option({ studio: null, voice: null, language: null }) : <span className="line-clamp-2">{r.title}</span>}
        </p>
        <p className="mt-0.5 text-body break-words text-text-1">{x ? <ReleaseLine info={x.info} rest={[editionWord(tt, r.title, cuts), pack || null, sized]} /> : sized}</p>
        <p className="mt-0.5 text-body-s break-words text-text-2">{where}</p>
      </div>
      {/* As the card: "Watch", then "i" for the details (a circle "▶" on a phone, where the row is narrow). */}
      <Button variant="secondary" data-link={releaseDomId(r.link)} aria-describedby={head} onClick={(e) => onWatch(e.currentTarget)} className="shrink-0 max-sm:hidden">
        <Play aria-hidden className="fill-current" />
        {tt("tsWatch")}
      </Button>
      <IconButton icon={Play} variant="secondary" label={tt("tsWatch")} data-link={releaseDomId(r.link)} aria-describedby={head} onClick={(e) => onWatch(e.currentTarget)} className="shrink-0 sm:hidden [&_svg]:fill-current" />
      <IconButton icon={Info} variant="secondary" label={tp("releaseDetails")} aria-describedby={head} aria-haspopup="dialog" onClick={onDetails} className="shrink-0" />
    </li>
  );
}

/**
 * A row's cut in words, as the card says it: none while the "Version" pill names one (every row is that cut); else the
 * cut the name states, or "Theatrical" for a name without one when the title's releases come in several cuts.
 */
function editionWord(tt: ReturnType<typeof useTranslations>, name: string, cuts: "named" | "several" | "chosen"): string | null {
  if (cuts === "chosen") return null;
  const e = editionOf(name) ?? (cuts === "several" ? "theatrical" : null);
  return e ? tt(`edition_${e}`) : null;
}
