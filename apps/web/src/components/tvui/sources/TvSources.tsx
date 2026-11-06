"use client";

import type { Availability } from "@lumovio/contracts";
import { ArrowLeft, CircleAlert, Ellipsis, FileVideo, Info, type LucideIcon, Play, RefreshCw, Server, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ServerMark } from "@/components/connections/ServerMark";
import type { FinderProps } from "@/components/player/finder";
import { useCopyFacts } from "@/components/sources/CopyDetails";
import { AccentBadge, StatusBadge, Tag } from "@/components/ui/Badge";
import { type Step, Steps } from "@/components/ui/Progress";
import { TvButton } from "@/components/ui/tv/TvButton";
import { tmdbImage } from "@/lib/images";
import { TvLayer } from "../nav/TvLayer";
import { useTvBack, useTvNav } from "../nav/TvNav";
import { TvScroll } from "../nav/TvScroll";
import { ContinueOnPhone } from "../shell/ContinueOnPhone";
import { TvState } from "../shell/TvState";
import { TvFinder } from "./TvFinder";

/*
 * The sources screen on a TV (design-system 10.3 «Экран источников», S57, TS1–TS8 in the TV's composition): the same
 * viewing (components/player/WatchView) drawn for the remote — a stage with no menu and no blurred art, the header
 * (←, a small poster, the title, "Sources · S2 E3"), then one vertical slide of zones: the copies on the profile's
 * servers, the stages of starting one or its failure with the ways out, a file to pick, and the TorrServer search.
 * Unlinking and removing copies (TS7, TS8) continue on a phone: "More" on a copy offers its details and the QR.
 */

export interface TvCopyRow {
  key: string;
  kind: string;
  /** Its quality marks and words (QualityLine); `meta`: the server and what the release says. */
  title: ReactNode;
  meta: string;
  badge: "playing" | "failed" | "first" | null;
  server: Availability;
  /** OK goes back to the player at the same position (the copy playing now). */
  playing: boolean;
  onWatch: (anchor: HTMLElement) => void;
}

export interface TvAction {
  label: string;
  icon?: LucideIcon;
  run: () => void;
  loading?: boolean;
}

export interface TvFileRow {
  key: string;
  name: string;
  meta: string;
  /** "Matches", "Probably season 2": why it is offered first. */
  badge: string | null;
  onPick: (anchor: HTMLElement) => void;
}

export interface TvSourcesProps {
  title: string;
  posterPath: string | null;
  /** "Sources · Season 2, episode 3". */
  subtitle: string;
  back: { label: string; run: () => void };
  /** The screen was opened from the player: Back on the remote returns to it. */
  toPlayer: (() => void) | null;
  loading: boolean;
  preparing: { label: string; steps: Step[]; cancel: () => void } | null;
  error: { label: string; steps: Step[]; title: string; message: string; actions: TvAction[] } | null;
  files: { title: string; hint: string; groups: { key: string; /** The torrent: its quality marks and words, and its server. */ label: ReactNode; files: TvFileRow[] }[]; noFiles: string; other: TvAction } | null;
  /** The other app's screen (ExternalPlayerPanel), as it is. */
  external: ReactNode;
  /** The copies and what stands instead of them; null while preparing or picking a file. */
  list: {
    heading: string;
    copies: TvCopyRow[];
    all: Availability[];
    /** Where unlinking and removing are done: the title's "Where to watch" on a phone. */
    managePath: string | null;
    empty:
      | null
      | { kind: "line"; text: string }
      | { kind: "error"; title: string; retry: () => void; retrying: boolean }
      | { kind: "none"; title: string; text: string; action: { label: string; href: string } | null };
  } | null;
  finder: (FinderProps & { hidden: boolean }) | null;
}

export function TvSources({ title, posterPath, subtitle, back, toPlayer, loading, preparing, error, files, external, list, finder }: TvSourcesProps) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const tt = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tv = useTranslations("tvui");
  const nav = useTvNav();
  const [more, setMore] = useState<TvCopyRow | null>(null);
  const [manage, setManage] = useState(false);
  const [copyDetails, setCopyDetails] = useState<Availability | null>(null);
  // What "More" opens next — opened once its own layer has left the history, so Back from it comes back to the copy.
  const next = useRef<"details" | "manage" | null>(null);
  const screen = useRef<HTMLDivElement>(null);
  const poster = tmdbImage(posterPath, "w185");

  // Back on the remote (after any open layer): a preparation is cancelled; opened from the player, back to watching;
  // otherwise the shell goes back to the title.
  useTvBack(() => {
    if (preparing) {
      preparing.cancel();
      return true;
    }
    if (toPlayer) {
      toPlayer();
      return true;
    }
    return false;
  });

  // Something to stand on once the screen has its content: its start (the first copy, the recommended release, the
  // way out of a failure), unless the focus is already on the screen.
  const ready = loading ? "loading" : preparing ? "preparing" : error ? "error" : files ? "files" : "list";
  const was = useRef(ready);
  useEffect(() => {
    const after = was.current;
    was.current = ready;
    if (ready === "loading") return;
    // Decided at the frame: a row hidden by this change has lost the focus by then, and a way back to the row picked
    // before (WatchView's "Another source", Cancel) has taken it. "←" was the only thing to stand on while loading.
    const id = requestAnimationFrame(() => {
      const a = document.activeElement;
      const placed = a && a !== document.body && a.getClientRects().length > 0 && screen.current?.contains(a);
      if (placed && !(after === "loading" && a.closest('[data-zone="back"]'))) return;
      nav.focusStart();
    });
    return () => cancelAnimationFrame(id);
  }, [ready, nav]);

  const copies = list?.copies ?? [];
  return (
    <div ref={screen} className="stage absolute inset-0 bg-stage text-text-1">
      <TvScroll className="h-full" contentClassName="flex flex-col gap-10 ps-(--gutter) pe-(--gutter) pt-10 pb-24">
        <header data-zone-frame="top" className="flex items-center gap-6">
          <div data-zone="back">
            <TvButton look="round" icon={ArrowLeft} label={back.label} onClick={back.run} />
          </div>
          {poster && <img src={poster} alt="" className="h-24 w-16 shrink-0 rounded-sm object-cover" />}
          <div className="min-w-0">
            <h1 className="truncate text-h2 text-text-1">{title}</h1>
            <p className="truncate text-body-l text-text-2">{subtitle}</p>
          </div>
        </header>

        {loading && (
          <div className="flex flex-col gap-3" role="status" aria-label={t("loading")}>
            {[0, 1].map((i) => (
              <span key={i} className="h-22 w-full animate-pulse rounded-sm bg-surface-2" />
            ))}
          </div>
        )}

        {preparing && (
          <section aria-labelledby="prep-h" className="flex max-w-240 flex-col gap-6 rounded-md bg-surface-1 p-8">
            <div className="flex flex-col gap-1">
              <h2 id="prep-h" className="text-h2 text-text-1">
                {t("preparingTitle")}
              </h2>
              <p className="break-words text-body-l text-text-2">{preparing.label}</p>
            </div>
            <Steps steps={preparing.steps} label={t("preparingTitle")} className="text-body-l" />
            <div data-zone="prep">
              <TvButton data-tv-initial onClick={preparing.cancel}>
                {tc("cancel")}
              </TvButton>
            </div>
          </section>
        )}

        {error && (
          <section id="prep-error" aria-label={error.title} className="flex max-w-240 flex-col gap-6 rounded-md bg-surface-1 p-8">
            <p className="break-words text-body-l text-text-2">{error.label}</p>
            <Steps steps={error.steps} label={error.title} />
            <div role="alert" className="flex flex-col gap-3">
              <h2 className="flex items-center gap-3 text-h2 text-text-1">
                <CircleAlert aria-hidden className="size-8 shrink-0 text-danger" />
                {error.title}
              </h2>
              <p className="max-w-measure text-body-l text-text-2">{error.message}</p>
              {/* The ways out, one zone (11.1, SRC-19): the first is where the focus lands. */}
              <div data-zone="prep-actions" data-zone-axis="x" data-zone-entry="first" className="mt-2 flex flex-wrap gap-4">
                {error.actions.map((a, i) => (
                  <TvButton key={a.label} icon={a.icon} loading={a.loading} data-tv-initial={i === 0 || undefined} onClick={a.run}>
                    {a.label}
                  </TvButton>
                ))}
              </div>
            </div>
          </section>
        )}

        {files && (
          <section aria-labelledby="pick-file-h" className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h2 id="pick-file-h" className="text-h2 text-text-1">
                {files.title}
              </h2>
              <p className="max-w-measure text-body-l text-text-2">{files.hint}</p>
            </div>
            {files.groups.map((g, gi) => (
              <div key={g.key} className="flex flex-col gap-3">
                <p className="break-words text-body-l font-semibold text-text-2">{g.label}</p>
                {g.files.length === 0 ? (
                  <p className="text-body-l text-text-2">{files.noFiles}</p>
                ) : (
                  <div data-zone={`files:${gi}`} data-zone-axis="y" className="flex flex-col gap-5">
                    {g.files.map((f, fi) => (
                      <TvButton
                        key={f.key}
                        look="row"
                        data-key={f.key}
                        data-tv-initial={(gi === 0 && (f.badge !== null || fi === 0)) || undefined}
                        className="min-h-18 py-3"
                        onClick={(e) => f.onPick(e.currentTarget)}
                      >
                        <FileVideo aria-hidden className="self-start" />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          {f.badge && (
                            <span>
                              <AccentBadge>{f.badge}</AccentBadge>
                            </span>
                          )}
                          <span className="break-all text-body-l">{f.name}</span>
                          <span className="font-normal opacity-75">{f.meta}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 opacity-75">
                          <Play aria-hidden className="fill-current" />
                          {tt("tsWatch")}
                        </span>
                      </TvButton>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div data-zone="files-other">
              <TvButton icon={files.other.icon} onClick={files.other.run}>
                {files.other.label}
              </TvButton>
            </div>
          </section>
        )}

        {external}

        {list && (
          <div id="sources" className="flex flex-col gap-5">
            {copies.length > 0 && (
              <section aria-labelledby="copies-h" className="flex flex-col gap-5">
                <h2 id="copies-h" className="text-h2 text-text-1">
                  {list.heading}
                </h2>
                <ul data-zone="copies" data-zone-axis="grid" className="flex flex-col gap-5">
                  {copies.map((c, i) => (
                    <li key={c.key} className="flex items-center gap-8">
                      <TvButton
                        look="row"
                        data-key={c.key}
                        data-tv-initial={i === 0 || undefined}
                        className="min-h-22 flex-1 py-3"
                        onClick={(e) => c.onWatch(e.currentTarget)}
                      >
                        <ServerMark kind={c.kind} className="size-8 self-start" />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          {c.badge && (
                            <span>
                              {c.badge === "playing" ? (
                                <Tag>{t("nowPlaying")}</Tag>
                              ) : c.badge === "failed" ? (
                                <StatusBadge status="warning">{t("failedSource")}</StatusBadge>
                              ) : (
                                <Tag>{tt("startsFirst")}</Tag>
                              )}
                            </span>
                          )}
                          <span className="break-words text-body-l">{c.title}</span>
                          <span className="font-normal opacity-75">{c.meta}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 opacity-75">
                          <Play aria-hidden className="fill-current" />
                          {c.playing ? t("continueWatching") : tt("tsWatch")}
                        </span>
                      </TvButton>
                      <TvButton
                        look="round"
                        icon={Ellipsis}
                        label={tp("copyMore", { server: c.server.connectionName })}
                        data-key={`${c.key}#more`}
                        onClick={() => setMore(c)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {list.empty?.kind === "line" && <p className="text-body-l text-text-2">{list.empty.text}</p>}
            {list.empty?.kind === "error" && (
              <TvState icon={RefreshCw} title={list.empty.title}>
                <TvButton icon={RefreshCw} loading={list.empty.retrying} data-tv-initial onClick={list.empty.retry}>
                  {tc("retry")}
                </TvButton>
              </TvState>
            )}
            {list.empty?.kind === "none" && (
              <TvState icon={Server} title={list.empty.title} text={list.empty.text}>
                {list.empty.action && (
                  <TvButton data-tv-initial onClick={() => list.empty?.kind === "none" && list.empty.action && nav.navigate(list.empty.action.href)}>
                    {list.empty.action.label}
                  </TvButton>
                )}
                <TvButton icon={ArrowLeft} data-tv-initial={!list.empty.action || undefined} onClick={back.run}>
                  {back.label}
                </TvButton>
              </TvState>
            )}
          </div>
        )}

        {/* Kept (hidden) while a release picked here is prepared: its results, filters and row stay for a failure. */}
        {finder && (
          <div id="finder" hidden={finder.hidden}>
            <TvFinder {...finder} first={copies.length === 0} />
          </div>
        )}
      </TvScroll>

      {more && (
        <TvLayer
          look="panel"
          label={tp("copyMore", { server: more.server.connectionName })}
          onClose={() => {
            setMore(null);
            if (next.current === "details") setCopyDetails(more.server);
            if (next.current === "manage") setManage(true);
            next.current = null;
          }}
        >
          {(close) => (
            <>
              <div className="flex flex-col gap-2">
                <h2 className="text-h2 text-text-1">{more.title}</h2>
                <p className="text-body-l text-text-2">{more.meta}</p>
              </div>
              <div data-zone="copy-more" data-zone-axis="y" className="flex flex-col gap-3">
                <TvButton
                  look="row"
                  icon={Info}
                  data-tv-initial
                  onClick={() => {
                    next.current = "details";
                    close();
                  }}
                >
                  {tp("copyDetails")}
                </TvButton>
                {list?.managePath && (
                  <TvButton
                    look="row"
                    icon={Smartphone}
                    onClick={() => {
                      next.current = "manage";
                      close();
                    }}
                  >
                    {tv("manageOnPhone")}
                  </TvButton>
                )}
              </div>
            </>
          )}
        </TvLayer>
      )}
      {copyDetails && <CopyDetailsLayer copy={copyDetails} all={list?.all ?? []} onClose={() => setCopyDetails(null)} />}
      {manage && list?.managePath && (
        <TvLayer look="dialog" label={tv("manageOnPhone")} className="max-w-300" onClose={() => setManage(false)}>
          {(close) => (
            <>
              <ContinueOnPhone path={list.managePath ?? "/"} title={tv("manageOnPhone")} text={tv("manageCopyText")} />
              <div data-zone="manage">
                <TvButton icon={ArrowLeft} data-tv-initial onClick={close}>
                  {tc("back")}
                </TvButton>
              </div>
            </>
          )}
        </TvLayer>
      )}
    </div>
  );
}

/** A copy's details on a TV (7.15): the known facts, read in a side panel; Back closes it. */
function CopyDetailsLayer({ copy, all, onClose }: { copy: Availability; all: Availability[]; onClose: () => void }) {
  const tp = useTranslations("titlePage");
  const tc = useTranslations("common");
  const facts = useCopyFacts();
  return (
    <TvLayer look="panel" label={tp("copyDetails")} onClose={onClose}>
      {(close) => (
        <>
          <h2 className="text-h2 text-text-1">{tp("copyDetails")}</h2>
          <dl className="grid min-h-0 grid-cols-[auto_1fr] content-start gap-x-6 gap-y-3 overflow-hidden text-body">
            {facts(copy, all).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-text-2">{k}</dt>
                <dd className="line-clamp-4 break-words text-text-1">{v}</dd>
              </div>
            ))}
          </dl>
          <div data-zone="copy-details">
            <TvButton icon={ArrowLeft} data-tv-initial onClick={close}>
              {tc("back")}
            </TvButton>
          </div>
        </>
      )}
    </TvLayer>
  );
}
