"use client";

import {
  Bookmark,
  BookmarkCheck,
  CircleAlert,
  CircleCheck,
  Clapperboard,
  Ellipsis,
  EyeOff,
  Heart,
  ListPlus,
  Magnet,
  Play,
  RefreshCw,
  Search,
  Server,
  Smartphone,
  Star,
  Tv,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import type { TitleLibraryState } from "@lumovio/contracts";
import { useEditableLists, usePersonalActions } from "@/components/media/usePersonalActions";
import { useSession } from "@/components/providers/Providers";
import { type TitleCore, resumable, sourcesHref, startEpisode, watchHref } from "@/components/title/core";
import { heroPlan, type Summary, type TorrentState } from "@/components/title/hero-plan";
import { serviceOf } from "@/components/title/services";
import type { ProbeResult } from "@/components/title/TorrentProbe";
import { cn } from "@/components/ui/cn";
import { TvButton, tvButtonClass } from "@/components/ui/tv/TvButton";
import { useTitleAvailability } from "@/hooks/useAvailability";
import { useSetLibraryState } from "@/hooks/useLibraryState";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { orderedSources } from "@/lib/media/source-order";
import { titleHref } from "@/lib/slug";
import { useAction } from "@/lib/use-action";
import { titleCopies } from "@/lib/watch-state";
import { randomId } from "@/lib/random-id";
import { TvLayer } from "../nav/TvLayer";
import { TvScroll } from "../nav/TvScroll";
import { useTvNav } from "../nav/TvNav";
import { ContinueOnPhone } from "../shell/ContinueOnPhone";

const TorrentProbe = dynamic(() => import("@/components/title/TorrentProbe").then((m) => m.TorrentProbe), {
  ssr: false,
});

/*
 * A title's actions on a TV (design-system 8.1, 8.2, 10.3; TV document §4 "Страница тайтла", "Источники"): one zone in
 * a row — the main button by the site's table (Continue, Watch from the profile's copy or the recommended TorrServer
 * release, Find a source, the trailer), "Sources" (every copy and release, a new search: the sources screen), the
 * trailer when it isn't the main one, "Watchlist", "Rate" and "More" (Favourites, Watched, Not interested, Add to list,
 * Open on a phone) — the last two as layers. Under them one line of where it plays from.
 */
export function TitleActions({ title: d }: { title: TitleCore }) {
  const t = useTranslations("titlePage");
  const tt = useTranslations("title");
  const tc = useTranslations("card");
  const tr = useTranslations("rows");
  const tm = useTranslations("common");
  const tv = useTranslations("tvui");
  const { me } = useSession();
  const kids = Boolean(me?.activeProfile?.isKids);
  const actions = usePersonalActions(d);
  const avail = useTitleAvailability(d.id);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [layer, setLayer] = useState<"rate" | "more" | "lists" | "phone" | "trailer" | null>(null);
  const onProbe = useCallback((r: ProbeResult) => setProbe(r), []);

  // The same decision as the site's hero (components/title/TitleActions): what plays, from where, and the line under it.
  const sources = avail.data?.sources ?? [];
  const auto = !kids
    ? sources.find(
        (s) =>
          s.kind === "torrserver" &&
          s.autoSearch &&
          s.status !== "unreachable" &&
          s.status !== "unauthorized",
      )
    : undefined;
  const manual = !kids
    ? sources.find(
        (s) => s.kind === "torrserver" && s.status !== "unreachable" && s.status !== "unauthorized",
      )
    : undefined;
  const out = !d.releaseDate || d.releaseDate <= new Date().toISOString().slice(0, 10);
  const probing = Boolean(auto && out && avail.state.kind !== "playable" && avail.state.kind !== "loading");
  const torrent: TorrentState = probing
    ? (probe?.state ?? { state: "searching", name: auto!.name })
    : manual && out && avail.state.kind !== "playable"
      ? { state: "manual", name: manual.name }
      : { state: "none" };
  const first = avail.data ? orderedSources(titleCopies(avail.data), undefined, me?.activeProfile?.audioLanguages)[0]?.server : undefined;
  const offers = (d.watchProviders?.providers ?? []).filter(
    (p) => p.kind === "flatrate" || p.kind === "free" || p.kind === "ads",
  );
  const offerNames = [
    ...new Set(
      (offers.length ? offers : (d.watchProviders?.providers ?? [])).map((p) => serviceOf(p.name).name),
    ),
  ].slice(0, 3);
  const p = actions.state?.progress;
  const plan = heroPlan({
    signedIn: true,
    kids,
    watch: avail.state,
    resume: resumable(p),
    copy:
      first && avail.state.kind === "playable"
        ? {
            server: first.connectionName,
            resolution: first.quality?.resolution ?? null,
            others: avail.state.copies - 1,
          }
        : null,
    torrent,
    trailer: Boolean(d.trailer),
    offers: offerNames,
  });
  const playHref = watchHref(d, p);
  const left = p?.durationSec ? Math.max(0, p.durationSec - p.positionSec) : null;
  const leftText =
    left === null
      ? null
      : left < 60
        ? tc("leftUnderMinute")
        : tr("timeLeft", { time: tm("minutes", { count: Math.round(left / 60) }) });
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
    if (!(await probe.play())) setPlaying(false);
  };

  const primary = plan.primary;
  const main = cn(tvButtonClass(), "min-w-56");
  const on = actions.inWatchlist;
  const rating = actions.state?.rating ?? null;
  // The sources screen: every copy, release and a new search, also when a source is already chosen (TV document §4).
  const showSources =
    !kids && primary?.kind !== "sources" && (avail.state.kind === "playable" || Boolean(manual));

  return (
    <div className="flex flex-col gap-4">
      <div data-zone="actions" data-zone-axis="x" className="flex flex-wrap items-center gap-4">
        {primary?.kind === "loading" && (
          <span className={cn(main, "pointer-events-none opacity-80")} role="status">
            <RefreshCw aria-hidden className="animate-spin" />
            {tt("checkingAvailability")}
          </span>
        )}
        {(primary?.kind === "resume" || primary?.kind === "watch") && (
          <Link prefetch={false} href={playHref} data-tv-initial className={main}>
            <Play aria-hidden className="fill-current" />
            {primary.kind === "resume" ? t("resume") : tt("play")}
          </Link>
        )}
        {primary?.kind === "watchRelease" && (
          <TvButton
            data-tv-initial
            icon={Play}
            loading={playing}
            onClick={() => void playRelease()}
            className="min-w-56 [&_svg]:fill-current"
          >
            {tt("play")}
          </TvButton>
        )}
        {primary?.kind === "sources" && (
          <Link prefetch={false} href={sourcesHref(playHref)} data-tv-initial className={main}>
            {primary.label === "watch" ? (
              <Play aria-hidden className="fill-current" />
            ) : (
              <Search aria-hidden />
            )}
            {primary.label === "watch" ? tt("play") : t("findSource")}
          </Link>
        )}
        {primary?.kind === "trailer" && (
          <TvButton
            data-tv-initial
            icon={Clapperboard}
            onClick={() => setLayer("trailer")}
            className="min-w-56"
          >
            {t("trailer")}
          </TvButton>
        )}
        {showSources && (
          <Link prefetch={false} href={sourcesHref(playHref)} className={tvButtonClass()}>
            <Server aria-hidden />
            {tv("sources")}
          </Link>
        )}
        {d.trailer && primary?.kind !== "trailer" && (
          <TvButton icon={Clapperboard} onClick={() => setLayer("trailer")}>
            {t("trailer")}
          </TvButton>
        )}
        <TvButton
          icon={on ? BookmarkCheck : Bookmark}
          aria-pressed={on}
          data-tv-initial={primary === null || undefined}
          disabled={actions.busy === "wl"}
          onClick={() => void actions.setWatchlist(!on)}
        >
          {t("watchlist")}
        </TvButton>
        <TvButton
          icon={Star}
          aria-haspopup="dialog"
          onClick={() => setLayer("rate")}
          className={cn(rating && "[&_svg]:fill-current")}
        >
          {rating ? t("ratedLabel", { value: rating }) : t("rate")}
        </TvButton>
        <TvButton
          look="round"
          icon={Ellipsis}
          label={t("more")}
          aria-haspopup="dialog"
          onClick={() => setLayer("more")}
        />
      </div>
      {sub && <p className="text-body-l text-text-2 tabular-nums">{sub}</p>}
      {plan.summary && <Availability summary={plan.summary} kids={kids} />}
      {probing && auto && <TorrentProbe title={d} source={auto} onChange={onProbe} />}

      {layer === "rate" && <RateLayer title={d} onClose={() => setLayer(null)} />}
      {layer === "more" && (
        <MoreLayer
          title={d}
          onClose={() => setLayer(null)}
          onLists={() => setLayer("lists")}
          onPhone={() => setLayer("phone")}
        />
      )}
      {layer === "lists" && <ListsLayer title={d} onClose={() => setLayer(null)} />}
      {layer === "phone" && (
        <TvLayer look="dialog" className="max-w-240" label={tv("openOnPhone")} onClose={() => setLayer(null)}>
          {() => (
            <ContinueOnPhone
              path={titleHref(d.kind, d.tmdbId, d.title)}
              title={tv("openOnPhone")}
              text={tv("openOnPhoneText")}
            />
          )}
        </TvLayer>
      )}
      {layer === "trailer" && d.trailer && (
        <TrailerLayer video={d.trailer} title={d.title} onClose={() => setLayer(null)} />
      )}
    </div>
  );
}

/** Where it plays from, in one line (7.14 item 7) — on a TV without links: the actions above are the next step. */
function Availability({ summary: s, kids }: { summary: NonNullable<Summary>; kids: boolean }) {
  const t = useTranslations("titlePage");
  const tt = useTranslations("title");
  const tv = useTranslations("tvui");
  let Icon = Server;
  let text: string;
  switch (s.kind) {
    case "copy":
      text = [
        t("onServer", { server: s.server }),
        s.resolution,
        s.others > 0 ? tt("moreCopies", { count: s.others }) : null,
      ]
        .filter(Boolean)
        .join(" · ");
      break;
    case "release":
      Icon = Magnet;
      text = t("viaRelease", { name: s.name, summary: s.summary });
      break;
    case "searching":
      Icon = Magnet;
      text = t("searching", { name: s.name });
      break;
    case "manual":
      Icon = Magnet;
      text = t("manualSearch", { name: s.name });
      break;
    case "nothingFound":
      Icon = s.offers.length ? Tv : CircleAlert;
      text = s.offers.length
        ? `${t("nothingFound")} · ${t("offers", { services: s.offers.join(", ") })}`
        : t("nothingFound");
      break;
    case "offers":
      Icon = Tv;
      text = t("offers", { services: s.offers.join(", ") });
      break;
    case "noServers":
      Icon = Smartphone;
      text = kids ? t("noServers") : `${t("noServers")} ${tv("serversOnPhone")}`;
      break;
    case "notOnServers":
      text = t("notOnServers");
      break;
    case "indexing":
      text = tt("statusIndexing", { names: s.names.join(", ") });
      break;
    case "unreachable":
      Icon = CircleAlert;
      text = tt("statusUnreachable", { names: s.names.join(", ") });
      break;
    case "error":
      Icon = CircleAlert;
      text = tt("statusError");
      break;
    default:
      return null;
  }
  return (
    <p className="flex max-w-200 items-start gap-3 text-body-l text-text-2" aria-live="polite">
      <Icon
        aria-hidden
        className={cn(
          "mt-1 size-6 shrink-0",
          (s.kind === "unreachable" || s.kind === "error") && "text-warning",
        )}
      />
      <span>{text}</span>
    </p>
  );
}

function RateLayer({ title: d, onClose }: { title: TitleCore; onClose: () => void }) {
  const t = useTranslations("titlePage");
  const tv = useTranslations("tvui");
  const actions = usePersonalActions(d);
  const rating = actions.state?.rating ?? null;
  const set = (value: number | null, close: () => void) => {
    void actions.mutate({
      key: "rate",
      run: () => api("/api/library/rating", { method: "PUT", json: { titleId: d.id, value } }),
      optimistic: { rating: value },
    });
    close();
  };
  return (
    <TvLayer label={t("rateTitle", { title: d.title })} onClose={onClose}>
      {(close) => (
        <>
          <h2 className="text-h2 text-text-1">{t("rateTitle", { title: d.title })}</h2>
          <div
            data-zone="rate"
            data-zone-axis="grid"
            role="radiogroup"
            aria-label={t("rateTitle", { title: d.title })}
            className="grid grid-cols-5 gap-4"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
              <TvButton
                key={v}
                role="radio"
                aria-checked={rating === v}
                data-tv-initial={(rating ?? 7) === v || undefined}
                className={cn("h-14 text-h3 tabular-nums", rating === v && "bg-selected-bg text-selected-fg")}
                onClick={() => set(v, close)}
              >
                {v}
              </TvButton>
            ))}
          </div>
          <p className="text-body-l text-text-2">
            {rating ? t("ratedNote", { value: rating }) : t("rateNote")}
          </p>
          {rating && (
            <div data-zone="rate-clear" data-zone-axis="x">
              <TvButton onClick={() => set(null, close)}>{tv("removeRating")}</TvButton>
            </div>
          )}
        </>
      )}
    </TvLayer>
  );
}

function MoreLayer({
  title: d,
  onClose,
  onLists,
  onPhone,
}: {
  title: TitleCore;
  onClose: () => void;
  onLists: () => void;
  onPhone: () => void;
}) {
  const t = useTranslations("titlePage");
  const tc = useTranslations("card");
  const tv = useTranslations("tvui");
  const a = usePersonalActions(d);
  const setState = useSetLibraryState();
  const movie = d.kind === "movie";
  // A whole series at once, taken back exactly with "Undo" (TTL-25), as the site's "More" does.
  const markShow = useAction({
    run: async (undoKey: string) => {
      const s = await api<TitleLibraryState>("/api/history/mark", {
        method: "POST",
        json: { titleId: d.id, scope: "show", watched: true, undoKey },
      });
      setState(s);
      return s;
    },
    success: () => t("showMarked"),
    undo: async (_s, undoKey) =>
      setState(await api<TitleLibraryState>("/api/history/mark/undo", { method: "POST", json: { undoKey } })),
  });
  const mark = (on: boolean, Icon: typeof Heart) =>
    on ? <Icon aria-hidden className="fill-current" /> : <Icon aria-hidden />;
  return (
    <TvLayer look="panel" label={d.title} onClose={onClose}>
      {(close) => (
        <>
          <h2 className="text-h2 text-text-1">{d.title}</h2>
          <div data-zone="more" data-zone-axis="y" className="flex flex-col gap-3">
            <TvButton
              look="row"
              aria-pressed={a.isFavorite}
              data-tv-initial
              onClick={() => void a.setFavorite(!a.isFavorite)}
            >
              {mark(a.isFavorite, Heart)}
              {tc("favorite")}
            </TvButton>
            {movie ? (
              <TvButton look="row" aria-pressed={a.watched} onClick={() => void a.setWatched(!a.watched)}>
                {mark(a.watched, CircleCheck)}
                {tc("watched")}
              </TvButton>
            ) : (
              <TvButton
                look="row"
                loading={markShow.pending}
                onClick={() => void markShow.run(randomId())}
              >
                <CircleCheck aria-hidden />
                {t("markShow")}
              </TvButton>
            )}
            <TvButton look="row" aria-pressed={a.hidden} onClick={() => void a.setHidden(!a.hidden)}>
              <EyeOff aria-hidden />
              {tc("notInterested")}
            </TvButton>
            <TvButton
              look="row"
              onClick={() => {
                close();
                onLists();
              }}
            >
              <ListPlus aria-hidden />
              {tc("addToList")}
            </TvButton>
            <TvButton
              look="row"
              onClick={() => {
                close();
                onPhone();
              }}
            >
              <Smartphone aria-hidden />
              {tv("openOnPhone")}
            </TvButton>
          </div>
        </>
      )}
    </TvLayer>
  );
}

function ListsLayer({ title: d, onClose }: { title: TitleCore; onClose: () => void }) {
  const tc = useTranslations("card");
  const a = usePersonalActions(d);
  const lists = useEditableLists(true);
  const inLists = new Set(a.state?.listIds ?? []);
  return (
    <TvLayer look="panel" label={tc("addToList")} onClose={onClose}>
      {() => (
        <>
          <h2 className="text-h2 text-text-1">{tc("addToList")}</h2>
          {lists.data && lists.data.length === 0 ? (
            <p className="text-body-l text-text-2">{tc("noLists")}</p>
          ) : (
            <TvScroll contentClassName="p-2">
              <div data-zone="lists" data-zone-axis="y" className="flex flex-col gap-3">
                {(lists.data ?? []).map((l) => (
                  <TvButton
                    key={l.id}
                    look="row"
                    data-key={l.id}
                    aria-pressed={inLists.has(l.id)}
                    onClick={() => void a.toggleList(l.id)}
                  >
                    {inLists.has(l.id) ? (
                      <CircleCheck aria-hidden className="fill-current" />
                    ) : (
                      <ListPlus aria-hidden />
                    )}
                    {l.name}
                  </TvButton>
                ))}
              </div>
            </TvScroll>
          )}
        </>
      )}
    </TvLayer>
  );
}

/**
 * The trailer over the whole screen: the video can't take the remote's focus (it would keep Back to itself), so the
 * focus stays on "Close" and Back closes it, as every layer.
 */
function TrailerLayer({
  video,
  title,
  onClose,
}: {
  video: NonNullable<TitleCore["trailer"]>;
  title: string;
  onClose: () => void;
}) {
  const t = useTranslations("titlePage");
  const tc = useTranslations("common");
  const src =
    video.site === "YouTube"
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}?autoplay=1&rel=0&modestbranding=1&controls=0&disablekb=1&fs=0&playsinline=1`
      : `https://player.vimeo.com/video/${encodeURIComponent(video.key)}?autoplay=1&dnt=1&controls=0&keyboard=0`;
  const { focus } = useTvNav();
  return (
    <TvLayer
      look="screen"
      label={`${t("trailer")} · ${title}`}
      onClose={onClose}
      className="stage relative bg-stage"
    >
      {(close) => (
        <>
          <iframe
            src={src}
            title={`${t("trailer")} · ${title}`}
            tabIndex={-1}
            allow="autoplay; encrypted-media"
            className="pointer-events-none absolute inset-0 size-full border-0"
            onLoad={() =>
              focus(document.querySelector<HTMLElement>("[data-tv-trailer-close]"), { reveal: false })
            }
          />
          <div data-zone="trailer" className="absolute end-(--gutter) top-10">
            <TvButton data-tv-initial data-tv-trailer-close onClick={close}>
              {tc("close")}
            </TvButton>
          </div>
        </>
      )}
    </TvLayer>
  );
}
