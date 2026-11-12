"use client";

import { Bookmark, BookmarkCheck, Check, ChevronDown, CircleAlert, Clapperboard, Ellipsis, Info, Magnet, Play, Plus, RefreshCw, Search, Server, Tv } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { usePersonalActions } from "@/components/media/usePersonalActions";
import { useSession } from "@/components/providers/Providers";
import { GuestGate, takeGuestIntent } from "@/components/shell/GuestGate";
import { copyMarks, QualityBadges, QualityLine, resolutionBesideMarks, SLOT, Slotted } from "@/components/sources/QualityBadges";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { IconButton } from "@/components/ui/IconButton";
import { Link as ActionLink, linkClass } from "@/components/ui/Link";
import { lazyControl, useLazySwap, useStandIn } from "@/components/ui/lazy-swap";
import { CastButton } from "@/components/tv/CastButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { useTitleAvailability } from "@/hooks/useAvailability";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { orderedSources } from "@/lib/media/source-order";
import { seasonCopies } from "@/lib/media/packs";
import { titleCopies } from "@/lib/watch-state";
import { useChosenSeason } from "./chosen-season";
import { isOngoing, resumable, sourcesHref, startEpisode, type TitleCore, watchHref } from "./core";
import { heroPlan, type Primary, type Summary, type TorrentState } from "./hero-plan";
import { setRateOpen } from "./rate-open";
import { scrollToSection } from "./section-link";
import { serviceOf } from "./services";
import type { CopyFace } from "./CopyProbe";
import type { ProbeResult } from "./TorrentProbe";
import { TrailerDialog } from "./TrailerDialog";

// The rarely opened parts load when they are approached (ui/lazy-swap) or opened; the search for a release only where
// it runs.
const moreModule = lazyControl(() => import("./TitleMore"));
const TorrentProbe = dynamic(() => import("./TorrentProbe").then((m) => m.TorrentProbe), { ssr: false });
const CopyProbe = dynamic(() => import("./CopyProbe").then((m) => m.CopyProbe), { ssr: false });

/**
 * The title hero's actions (design-system 7.14 items 6–7, 8.2; redesign-2026-11.md 2): one main button by the table of
 * 8.2 — "Continue", "Watch" (own copy, or the recommended TorrServer release), the trailer, or none (then "Watchlist" is
 * the main one); beside it two circles: "Watchlist" (+, ✓ when on) and "More" with the rest (Favourites, Watched,
 * Not interested, Add to list…, new-episode alerts, Share, the picture). Under them one line of where it plays from,
 * with the way down to "Where to watch". The same row on a phone, the main button taking the width the circles leave.
 * The rating isn't here: it stands with the ratings (./YourRating).
 */
export function TitleActions({ title: d }: { title: TitleCore }) {
  const t = useTranslations("titlePage");
  const tc = useTranslations("card");
  const tr = useTranslations("rows");
  const tm = useTranslations("common");
  const { me } = useSession();
  const kids = Boolean(me?.activeProfile?.isKids);
  const actions = usePersonalActions(d);
  const { state, signedIn } = actions;
  // The season picked in "Episodes", else the one the profile is in: its copies count and "Watch" starts it (./chosen-season).
  const chosen = useChosenSeason(d.id);
  const ep = d.kind === "tv" ? startEpisode(d, state?.progress, chosen) : null;
  const holds = seasonCopies(ep?.season);
  const avail = useTitleAvailability(d.id, holds);
  // A TorrServer copy's marks and audio by its release name, from its own chunk (./CopyProbe).
  const [copyFace, setCopyFace] = useState<CopyFace | null>(null);
  const onCopyFace = useCallback((f: CopyFace) => setCopyFace(f), []);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [playing, setPlaying] = useState(false);

  const moreLight = useRef<HTMLButtonElement>(null);
  const more = useLazySwap(moreModule, moreLight);
  const moreIn = useStandIn(more);

  // What a guest pressed before signing in is done once they are back (GuestGate), with the usual toast and Undo.
  const tg = useTranslations("shell.gate");
  const replayed = useRef(false);
  useEffect(() => {
    if (!signedIn || state === undefined || replayed.current) return;
    replayed.current = true;
    const action = takeGuestIntent(d.id);
    if (!action || actions.replay(action)) return;
    if (action === "rate") setRateOpen(d.id);
    else if (action === "follow" && isOngoing(d)) {
      void api("/api/follow", { method: "POST", json: { titleId: d.id, on: true } }).then(
        () => toast.success(tg("doneFollow")),
        () => toast.error(t("followFailed")),
      );
    }
  });

  // The profile's TorrServer: searched by this device when it may (./TorrentProbe), else found on the sources screen.
  const sources = avail.data?.sources ?? [];
  const auto = !kids && signedIn ? sources.find((s) => s.kind === "torrserver" && s.autoSearch && s.status !== "unreachable" && s.status !== "unauthorized") : undefined;
  const manual = !kids && signedIn ? sources.find((s) => s.kind === "torrserver" && s.status !== "unreachable" && s.status !== "unauthorized") : undefined;
  const out = !d.releaseDate || d.releaseDate <= new Date().toISOString().slice(0, 10);
  const probing = Boolean(auto && out && avail.state.kind !== "playable" && avail.state.kind !== "loading");
  const torrent: TorrentState = probing
    ? (probe?.state ?? { state: "searching", name: auto!.name })
    : manual && out && avail.state.kind !== "playable"
      ? { state: "manual", name: manual.name }
      : { state: "none" };
  const onProbe = useCallback((r: ProbeResult) => setProbe(r), []);

  const first = avail.data ? orderedSources(titleCopies(avail.data, holds), undefined, me?.activeProfile?.audioLanguages)[0]?.server : undefined;
  const offers = (d.watchProviders?.providers ?? []).filter((p) => p.kind === "flatrate" || p.kind === "free" || p.kind === "ads");
  // A service once, its plan with ads folded in ("Netflix", not "Netflix, Netflix Standard with Ads"; TTL-26).
  const offerNames = [...new Set((offers.length ? offers : (d.watchProviders?.providers ?? [])).map((p) => serviceOf(p.name).name))].slice(0, 3);
  const p = state?.progress;
  const plan = heroPlan({
    signedIn,
    kids,
    watch: avail.state,
    // "Continue" only for the season the profile is in: another one picked starts from its first episode.
    resume: resumable(p) && (!ep || p?.season === ep.season),
    copy:
      first && avail.state.kind === "playable"
        ? first.kind === "torrserver"
          ? {
              // A TorrServer copy as a found release is said: its release name's marks and what is heard (16).
              server: first.connectionName,
              resolution: null,
              marks: copyFace?.marks ?? [],
              heard: copyFace?.heard ?? null,
              torrServer: true,
              others: avail.state.copies - 1,
            }
          : {
              server: first.connectionName,
              resolution: first.quality?.resolution ?? null,
              // Its marks by its server's data.
              marks: first.quality ? copyMarks(first.quality) : [],
              others: avail.state.copies - 1,
            }
        : null,
    torrent,
    trailer: Boolean(d.trailer),
    offers: offerNames,
  });

  const playHref = watchHref(d, p, chosen);
  // Under "Continue": the episode and the time left; under a series' "Watch": the episode it starts.
  const left = p?.durationSec ? Math.max(0, p.durationSec - p.positionSec) : null;
  const leftText = left === null ? null : left < 60 ? tc("leftUnderMinute") : tr("timeLeft", { time: tm("minutes", { count: Math.round(left / 60) }) });
  const sub =
    plan.primary?.kind === "resume"
      ? [ep ? tc("episode", ep) : null, leftText].filter(Boolean).join(" · ")
      : (plan.primary?.kind === "watch" || plan.primary?.kind === "watchRelease") && ep
        ? tc("episode", ep)
        : null;

  const playRelease = async () => {
    if (!probe?.play) return;
    setPlaying(true);
    // On success the player opens; a failure is said in a toast and the button is back (./TorrentProbe).
    if (!(await probe.play())) setPlaying(false);
  };

  const inWatchlist = actions.inWatchlist;
  // No main button: "Watchlist" is the main one (8.2).
  const watchlistMain = plan.primary === null;
  const toggleWatchlist = () => void actions.setWatchlist(!inWatchlist);
  const watchlist = watchlistMain ? (
    <Button size="lg" aria-pressed={signedIn ? inWatchlist : undefined} disabled={actions.busy === "wl"} onClick={toggleWatchlist} className="max-md:flex-1 md:min-w-48">
      {inWatchlist ? <BookmarkCheck aria-hidden className="fill-current [&>path:last-child]:text-bg" /> : <Bookmark aria-hidden />}
      {t("watchlist")}
    </Button>
  ) : (
    // The label stays "Watchlist"; on is the check (aria-pressed), off the plus.
    <IconButton
      icon={inWatchlist ? Check : Plus}
      variant="secondary"
      size="lg"
      label={t("watchlist")}
      aria-pressed={signedIn ? inWatchlist : undefined}
      disabled={actions.busy === "wl"}
      onClick={toggleWatchlist}
    />
  );

  const moreLabel = t("more");

  return (
    <div>
      <div className="flex items-start gap-3">
        {plan.primary && (
          <div className="flex min-w-0 flex-col gap-1.5 max-md:flex-1">
            <PrimaryButton primary={plan.primary} href={playHref} busy={playing} onTrailer={() => setTrailerOpen(true)} onRelease={() => void playRelease()} />
            {sub && <p className="text-body-s text-text-2 tabular-nums max-md:text-center">{sub}</p>}
          </div>
        )}
        {/* "Watch on TV" (8.18): what "Continue" / "Watch" would start, on a TV of the account with Lumovio open. */}
        {(plan.primary?.kind === "resume" || plan.primary?.kind === "watch") && (
          <CastButton
            titleId={d.id}
            resume
            target={() => ({ kind: d.kind, tmdbId: d.tmdbId, season: ep?.season ?? null, episode: ep?.episode ?? null, title: d.title, subtitle: ep ? tc("episode", ep) : d.year ? String(d.year) : null })}
          />
        )}
        {watchlist}
        {moreIn.full ? (
          <moreIn.full.TitleMore title={d} initialOpen={more.start.open} focusTrigger={more.start.focus} label={moreLabel} />
        ) : (
          <IconButton ref={moreLight} icon={Ellipsis} variant="secondary" size="lg" label={moreLabel} aria-haspopup="menu" aria-expanded={false} {...moreIn.handlers} />
        )}
      </div>
      {/* While availability loads, the line it brings is held (7.11), so the hero doesn't grow when it arrives. */}
      {plan.primary?.kind === "loading" && (
        <div aria-hidden className="mt-4 flex h-8 items-center max-sm:h-11">
          <Skeleton shape="xs" className="h-4 w-72 max-w-full" />
        </div>
      )}
      {plan.summary && (
        <AvailabilityLine summary={plan.summary} kids={kids} onRetry={() => void avail.refetch()} retrying={avail.isFetching} onSignIn={() => actions.requireAuth("watch")} />
      )}
      {probing && auto && <TorrentProbe title={d} source={auto} onChange={onProbe} />}
      {first?.kind === "torrserver" && avail.state.kind === "playable" && <CopyProbe copy={first} all={avail.data?.servers ?? []} originalLanguage={d.originalLanguage} onChange={onCopyFace} />}
      <GuestGate {...actions.gate} />
      {d.trailer && <TrailerDialog video={trailerOpen ? d.trailer : null} title={d.title} onClose={() => setTrailerOpen(false)} />}
    </div>
  );
}

/** The main button by 8.2: a link where it goes somewhere, a button where it acts. */
function PrimaryButton({ primary, href, busy, onTrailer, onRelease }: { primary: NonNullable<Primary>; href: string; busy: boolean; onTrailer: () => void; onRelease: () => void }) {
  const t = useTranslations("titlePage");
  const tt = useTranslations("title");
  const cls = buttonClass("primary", "lg", "w-full md:min-w-44");
  if (primary.kind === "loading")
    return (
      <span className={cn(cls, "pointer-events-none opacity-80")} role="status">
        <RefreshCw aria-hidden className="animate-spin" />
        {tt("checkingAvailability")}
      </span>
    );
  if (primary.kind === "resume" || primary.kind === "watch")
    return (
      <Link href={href} className={cls}>
        <Play aria-hidden className="fill-current" />
        {primary.kind === "resume" ? t("resume") : tt("play")}
      </Link>
    );
  if (primary.kind === "watchRelease")
    return (
      <Button size="lg" loading={busy} onClick={onRelease} className="w-full md:min-w-44">
        <Play aria-hidden className="fill-current" />
        {tt("play")}
      </Button>
    );
  if (primary.kind === "sources")
    return (
      <Link href={sourcesHref(href)} className={cls}>
        {primary.label === "watch" ? <Play aria-hidden className="fill-current" /> : <Search aria-hidden />}
        {primary.label === "watch" ? tt("play") : t("findSource")}
      </Link>
    );
  return (
    <Button size="lg" icon={Clapperboard} onClick={onTrailer} className="w-full md:min-w-44">
      {t("trailer")}
    </Button>
  );
}

/**
 * One line of availability under the actions (7.14 item 7, TTL-06, TTL-13, TTL-14): a fact and the next step — most
 * often "Where to watch ⌄", which brings that section of this page up (a jump, not a step in the history).
 */
function AvailabilityLine({
  summary: s,
  kids,
  onRetry,
  retrying,
  onSignIn,
}: {
  summary: NonNullable<Summary>;
  kids: boolean;
  onRetry: () => void;
  retrying: boolean;
  onSignIn: () => void;
}) {
  const t = useTranslations("titlePage");
  const tt = useTranslations("title");
  const tm = useTranslations("common");
  const where = (
    // biome-ignore lint/a11y/useValidAnchor: a link to the section (opened in a new tab, it lands there); a press scrolls to it smoothly, without a step in the history
    <a
      href="#watch"
      className={linkClass("action")}
      onClick={(e) => {
        e.preventDefault();
        scrollToSection("watch");
      }}
    >
      {tt("availability")}
      <ChevronDown aria-hidden className="size-4 shrink-0" />
    </a>
  );
  let icon: ReactNode = <Info aria-hidden className="size-4 shrink-0" />;
  let text: ReactNode;
  let next: ReactNode = where;
  switch (s.kind) {
    case "copy": {
      icon = <Server aria-hidden className="size-4 shrink-0" />;
      const others = s.others > 0 ? tt("moreCopies", { count: s.others }) : null;
      // A TorrServer copy: "Already on your TorrServer «torr» · [HD] Russian · multi-voice (LostFilm)" — as a found release.
      if (s.torrServer) {
        text = (
          <>
            {t("onTorrServer", { server: s.server })}
            {(s.marks?.length || s.heard) && " · "}
            <QualityLine marks={s.marks ?? []} words={[s.heard]} />
            {others && ` · ${others}`}
          </>
        );
        break;
      }
      // "On «Home» [4K] [Dolby Vision] · 2 more copies": the marks say the resolution, never the words too.
      text = s.marks?.length ? (
        <>
          {[t("onServer", { server: s.server }), resolutionBesideMarks(s.resolution)].filter(Boolean).join(" · ")}
          <QualityBadges className="ms-2 me-1.5" marks={s.marks} />
          {others && `· ${others}`}
        </>
      ) : (
        [t("onServer", { server: s.server }), s.resolution, others].filter(Boolean).join(" · ")
      );
      break;
    }
    case "release":
      icon = <Magnet aria-hidden className="size-4 shrink-0" />;
      // "Through TorrServer «torr» · [4K] [Dolby Vision] Ukrainian · dub": the marks where the summary goes.
      text = s.marks?.length ? <Slotted text={t("viaRelease", { name: s.name, summary: SLOT })} node={<QualityLine marks={s.marks} words={[s.summary]} />} /> : t("viaRelease", { name: s.name, summary: s.summary });
      break;
    case "searching":
      icon = <Magnet aria-hidden className="size-4 shrink-0" />;
      text = t("searching", { name: s.name });
      break;
    case "manual":
      icon = <Magnet aria-hidden className="size-4 shrink-0" />;
      text = t("manualSearch", { name: s.name });
      break;
    case "nothingFound":
      text = s.offers.length ? `${t("nothingFound")} · ${t("offers", { services: s.offers.join(", ") })}` : t("nothingFound");
      if (s.offers.length) icon = <Tv aria-hidden className="size-4 shrink-0" />;
      break;
    case "searchFailed":
      icon = <CircleAlert aria-hidden className="size-4 shrink-0 text-warning" />;
      text = s.offers.length ? `${tt("tsFailed", { name: s.name })} ${t("offers", { services: s.offers.join(", ") })}` : tt("tsFailed", { name: s.name });
      break;
    case "offers":
      icon = <Tv aria-hidden className="size-4 shrink-0" />;
      text = t("offers", { services: s.offers.join(", ") });
      break;
    case "noServers":
      text = t("noServers");
      next = (
        <ActionLink variant="action" arrow href="/settings/connections">
          {tt("connectServer")}
        </ActionLink>
      );
      break;
    case "notOnServers":
      text = t("notOnServers");
      break;
    case "indexing":
      text = tt("statusIndexing", { names: s.names.join(", ") });
      break;
    case "unreachable":
      icon = <CircleAlert aria-hidden className="size-4 shrink-0 text-warning" />;
      text = tt("statusUnreachable", { names: s.names.join(", ") });
      next = kids ? null : (
        <ActionLink variant="action" arrow href="/settings/connections">
          {tt("checkConnection")}
        </ActionLink>
      );
      break;
    case "error":
      icon = <CircleAlert aria-hidden className="size-4 shrink-0 text-warning" />;
      text = tt("statusError");
      next = (
        <Button variant="tertiary" size="sm" icon={RefreshCw} loading={retrying} onClick={onRetry}>
          {tm("retry")}
        </Button>
      );
      break;
    case "guest":
      text = t("guest");
      next = (
        <Button variant="tertiary" size="sm" onClick={onSignIn}>
          {tt("signInToWatch")}
        </Button>
      );
      break;
  }
  return (
    <div className="mt-4 flex max-w-160 flex-wrap items-center gap-x-3 gap-y-1 text-body-s text-text-2" aria-live="polite">
      <p className="flex items-start gap-2">
        <span className="mt-0.5">{icon}</span>
        <span>{text}</span>
      </p>
      {next}
    </div>
  );
}

