"use client";

import { Bookmark, BookmarkCheck, CircleAlert, Clapperboard, Ellipsis, Info, Magnet, Play, RefreshCw, Search, Server, Star, Tv } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { usePersonalActions } from "@/components/media/usePersonalActions";
import { useSession } from "@/components/providers/Providers";
import { GuestGate, takeGuestIntent } from "@/components/shell/GuestGate";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { IconButton } from "@/components/ui/IconButton";
import { Link as ActionLink } from "@/components/ui/Link";
import { lazyControl, useLazySwap, useStandIn } from "@/components/ui/lazy-swap";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { useTitleAvailability } from "@/hooks/useAvailability";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { orderedSources } from "@/lib/media/source-order";
import { titleCopies } from "@/lib/watch-state";
import { isOngoing, resumable, sourcesHref, startEpisode, type TitleCore, watchHref } from "./core";
import { HeroAction } from "./HeroAction";
import { heroPlan, type Primary, type Summary, type TorrentState } from "./hero-plan";
import { serviceOf } from "./services";
import { scrollToTabs, useOpenTab } from "./tab-link";
import type { ProbeResult } from "./TorrentProbe";
import { TrailerDialog } from "./TrailerDialog";

// The rarely opened parts load when they are approached (ui/lazy-swap); the search for a release only where it runs.
const rateModule = lazyControl(() => import("./TitleRate"));
const moreModule = lazyControl(() => import("./TitleMore"));
const TorrentProbe = dynamic(() => import("./TorrentProbe").then((m) => m.TorrentProbe), { ssr: false });

/**
 * The title hero's actions (design-system 7.14 items 6–7, 8.1, 8.2): one main button by the table of 8.2 —
 * "Continue", "Watch" (own copy, or the recommended TorrServer release), the trailer, or none (then "Watchlist" is the
 * main one); the labelled "Watchlist" and "Rate"; "More" with the rest (Favourites, Watched, Not interested, Add to
 * list…, new-episode alerts, Share). A label says what the button does and stays the same when it is on; "on" is
 * one look: the filled icon. Under them one line of where it plays from, with the way to "Where to watch".
 * On a phone: the main button across, then "Watchlist", "Rate" and "More" in a row of three with captions (10.1).
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
  const avail = useTitleAvailability(d.id);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const tabs = useOpenTab();

  const rateLight = useRef<HTMLButtonElement>(null);
  const rate = useLazySwap(rateModule, rateLight);
  const rateIn = useStandIn(rate);
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
    if (action === "rate") rate.activate(true);
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

  const first = avail.data ? orderedSources(titleCopies(avail.data), undefined, me?.activeProfile?.audioLanguages)[0]?.server : undefined;
  const offers = (d.watchProviders?.providers ?? []).filter((p) => p.kind === "flatrate" || p.kind === "free" || p.kind === "ads");
  // A service once, its plan with ads folded in ("Netflix", not "Netflix, Netflix Standard with Ads"; TTL-26).
  const offerNames = [...new Set((offers.length ? offers : (d.watchProviders?.providers ?? [])).map((p) => serviceOf(p.name).name))].slice(0, 3);
  const p = state?.progress;
  const plan = heroPlan({
    signedIn,
    kids,
    watch: avail.state,
    resume: resumable(p),
    copy: first && avail.state.kind === "playable" ? { server: first.connectionName, resolution: first.quality?.resolution ?? null, others: avail.state.copies - 1 } : null,
    torrent,
    trailer: Boolean(d.trailer),
    offers: offerNames,
  });

  const playHref = watchHref(d, p);
  // Under "Continue": the episode and the time left; under a series' "Watch": the episode it starts.
  const left = p?.durationSec ? Math.max(0, p.durationSec - p.positionSec) : null;
  const leftText = left === null ? null : left < 60 ? tc("leftUnderMinute") : tr("timeLeft", { time: tm("minutes", { count: Math.round(left / 60) }) });
  const ep = d.kind === "tv" ? startEpisode(d, p) : null;
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
  const watchlistIcon = inWatchlist ? <BookmarkCheck aria-hidden className="fill-current [&>path:last-child]:text-bg" /> : <Bookmark aria-hidden />;
  const watchlist = watchlistMain ? (
    <Button size="lg" aria-pressed={signedIn ? inWatchlist : undefined} disabled={actions.busy === "wl"} onClick={() => void actions.setWatchlist(!inWatchlist)} className="max-md:w-full md:min-w-48">
      {watchlistIcon}
      {t("watchlist")}
    </Button>
  ) : (
    <HeroAction aria-pressed={signedIn ? inWatchlist : undefined} disabled={actions.busy === "wl"} onClick={() => void actions.setWatchlist(!inWatchlist)}>
      {watchlistIcon}
      {t("watchlist")}
    </HeroAction>
  );

  const rating = state?.rating ?? null;
  const rateLabel = rating ? t("ratedLabel", { value: rating }) : t("rate");
  const rateStandIn = (
    <HeroAction ref={rateLight} aria-label={rateLabel} aria-haspopup="dialog" aria-expanded={false} {...rateIn.handlers}>
      <Star aria-hidden className={cn(rating && "fill-current")} />
      {rating ?? t("rate")}
    </HeroAction>
  );
  const moreLabel = t("more");
  const moreStandIn = (
    <>
      <HeroAction aria-haspopup="menu" aria-expanded={false} className="md:hidden" {...moreIn.handlers}>
        <Ellipsis aria-hidden />
        {moreLabel}
      </HeroAction>
      <IconButton ref={moreLight} icon={Ellipsis} variant="secondary" size="lg" label={moreLabel} aria-haspopup="menu" aria-expanded={false} className="max-md:hidden" {...moreIn.handlers} />
    </>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start gap-3 max-md:flex-col max-md:items-stretch">
        {plan.primary && (
          <div className="flex flex-col gap-1.5 max-md:w-full">
            <PrimaryButton primary={plan.primary} href={playHref} busy={playing} onTrailer={() => setTrailerOpen(true)} onRelease={() => void playRelease()} />
            {sub && <p className="text-body-s text-text-2 tabular-nums max-md:text-center">{sub}</p>}
          </div>
        )}
        {watchlistMain && watchlist}
        <div className="flex items-start gap-3 max-md:w-full max-md:justify-between max-md:gap-2">
          {!watchlistMain && watchlist}
          {!signedIn ? (
            // A guest gets the sign-in sheet for it, and the picker after signing in (8.6).
            <HeroAction onClick={() => actions.requireAuth("rate", "rate")}>
              <Star aria-hidden />
              {t("rate")}
            </HeroAction>
          ) : rateIn.full ? (
            <rateIn.full.TitleRate title={d} actions={actions} initialOpen={rate.start.open} focusTrigger={rate.start.focus} label={rateLabel} />
          ) : (
            rateStandIn
          )}
          {moreIn.full ? (
            <moreIn.full.TitleMore title={d} initialOpen={more.start.open} focusTrigger={more.start.focus} label={moreLabel} />
          ) : (
            moreStandIn
          )}
        </div>
      </div>
      {/* While availability loads, the line it brings is held (7.11), so the hero doesn't grow when it arrives. */}
      {plan.primary?.kind === "loading" && (
        <div aria-hidden className="mt-4 flex h-8 items-center max-sm:h-11">
          <Skeleton shape="xs" className="h-4 w-72 max-w-full" />
        </div>
      )}
      {plan.summary && (
        <AvailabilityLine summary={plan.summary} kids={kids} whereHref={tabs.href("watch")} onRetry={() => void avail.refetch()} retrying={avail.isFetching} onSignIn={() => actions.requireAuth("watch")} />
      )}
      {probing && auto && <TorrentProbe title={d} source={auto} onChange={onProbe} />}
      <GuestGate {...actions.gate} />
      {d.trailer && <TrailerDialog video={trailerOpen ? d.trailer : null} title={d.title} onClose={() => setTrailerOpen(false)} />}
    </div>
  );
}

/** The main button by 8.2: a link where it goes somewhere, a button where it acts. */
function PrimaryButton({ primary, href, busy, onTrailer, onRelease }: { primary: NonNullable<Primary>; href: string; busy: boolean; onTrailer: () => void; onRelease: () => void }) {
  const t = useTranslations("titlePage");
  const tt = useTranslations("title");
  const cls = buttonClass("primary", "lg", "max-md:w-full md:min-w-44");
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
      <Button size="lg" loading={busy} onClick={onRelease} className="max-md:w-full md:min-w-44">
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
    <Button size="lg" icon={Clapperboard} onClick={onTrailer} className="max-md:w-full md:min-w-44">
      {t("trailer")}
    </Button>
  );
}

/** One line of availability under the actions (7.14 item 7, TTL-06, TTL-13, TTL-14): a fact and the next step. */
function AvailabilityLine({
  summary: s,
  kids,
  whereHref,
  onRetry,
  retrying,
  onSignIn,
}: {
  summary: NonNullable<Summary>;
  kids: boolean;
  whereHref: string;
  onRetry: () => void;
  retrying: boolean;
  onSignIn: () => void;
}) {
  const t = useTranslations("titlePage");
  const tt = useTranslations("title");
  const tm = useTranslations("common");
  const where = (
    <ActionLink variant="action" arrow href={whereHref} replace scroll={false} onClick={scrollToTabs}>
      {tt("availability")}
    </ActionLink>
  );
  let icon: ReactNode = <Info aria-hidden className="size-4 shrink-0" />;
  let text: string;
  let next: ReactNode = where;
  switch (s.kind) {
    case "copy":
      icon = <Server aria-hidden className="size-4 shrink-0" />;
      text = [t("onServer", { server: s.server }), s.resolution, s.others > 0 ? tt("moreCopies", { count: s.others }) : null].filter(Boolean).join(" · ");
      break;
    case "release":
      icon = <Magnet aria-hidden className="size-4 shrink-0" />;
      text = t("viaRelease", { name: s.name, summary: s.summary });
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

