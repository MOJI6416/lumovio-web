"use client";

import type { Availability as Copy, SourceState, WatchProvider } from "@lumovio/contracts";
import { CalendarClock, ExternalLink, Play, Search, Server, Tv, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { GuestGate } from "@/components/shell/GuestGate";
import { CopyDetails } from "@/components/sources/CopyDetails";
import { CopyPill } from "@/components/sources/CopyPill";
import { useCopyText } from "@/components/sources/copy-text";
import { QualityLine } from "@/components/sources/QualityBadges";
import { formatSize, packWords, YourVoiceTag } from "@/components/sources/release-text";
import { providerSearch } from "@/components/sources/provider-links";
import { CastButton } from "@/components/tv/CastButton";
import { Button, buttonClass } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { Link as ActionLink } from "@/components/ui/Link";
import { useTitleAvailability } from "@/hooks/useAvailability";
import { useLibraryState } from "@/hooks/useLibraryState";
import { autoSearchSource } from "@/hooks/useTorrentLookup";
import { Link } from "@/i18n/navigation";
import { regionName } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import { copyAudio } from "@/lib/media/copy-audio";
import { orderedSources } from "@/lib/media/source-order";
import { seasonCopies } from "@/lib/media/packs";
import { titleCopies } from "@/lib/watch-state";
import { AddToCalendar } from "./AddToCalendar";
import { CopyActions, CopyRemovalDialog, FIND_SOURCE_ID, type RemovalTarget } from "./CopyActions";
import { useChosenSeason } from "./chosen-season";
import { notOutYet, sourcesHref, startEpisode, type TitleCore, utcToday, watchHref } from "./core";
import { useHydrated } from "./hydrated";
import { serviceOffers } from "./services";
import { TorrentLookupPanel } from "./TorrentLookupPanel";
import { useUpcomingCopy } from "./upcoming-copy";
import { CardMark, ServerMarks, WatchCard, WatchCardLoading } from "./WatchCard";

const OFFER_LABEL = { flatrate: "offerFlatrate", free: "offerFree", ads: "offerAds", rent: "offerRent", buy: "offerBuy" } as const;
/** Streaming by what it costs, as JustWatch groups it: in a subscription, free, for money. */
const OFFER_GROUPS: { key: "offerFlatrate" | "offerFree" | "offersPaid"; kinds: WatchProvider["kind"][] }[] = [
  { key: "offerFlatrate", kinds: ["flatrate"] },
  { key: "offerFree", kinds: ["free", "ads"] },
  { key: "offersPaid", kinds: ["rent", "buy"] },
];
const reachable = (s: SourceState) => s.status !== "unreachable" && s.status !== "unauthorized";
const copyKey = (s: Copy) => `${s.connectionId}:${s.externalId}`;

/**
 * "Where to watch": the one
 * way to start now in a card — the copy the main button starts, else the release the profile's TorrServer finds, with
 * the choices that lead to another — then the other copies, and beside them (under them on a phone) the legal
 * streaming of the region by what it costs. Every state of the way is the same card: loading, an error, a server out of
 * reach or still indexing, nothing on the servers, a TorrServer without its own search, the guest's sign-in, a profile
 * without servers. No sentence explains it: the card's heading says the state, its one button the way on.
 */
export function Availability({ title: d }: { title: TitleCore }) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tpl = useTranslations("player");
  const locale = useLocale();
  const { me } = useSession();
  const { data: lib } = useLibraryState(d.id);
  // The season picked in "Episodes", else the one the profile is in: a whole torrent of other seasons only is no copy of
  // it, and the search below looks for it (./chosen-season).
  const chosen = useChosenSeason(d.id);
  const ep = d.kind === "tv" ? startEpisode(d, lib?.progress, chosen) : null;
  const holds = seasonCopies(ep?.season);
  const avail = useTitleAvailability(d.id, holds);
  // What the hero already fetched waits for the end of hydration, so the first render is the server's (./hydrated).
  const hydrated = useHydrated();
  const { state } = avail;
  const raw = hydrated ? avail.data : undefined;
  const data = raw ? titleCopies(raw, holds) : undefined;
  const [removal, setRemoval] = useState<RemovalTarget | null>(null);
  const [details, setDetails] = useState<Copy | null>(null);
  // The copy in the card when the servers hold several ("Copy"), by its key; none — the first.
  const [picked, setPicked] = useState<string | null>(null);
  // "Another release": the search's card in the copy's place, back by × and Escape.
  const [other, setOther] = useState(false);
  const otherButton = useRef<HTMLButtonElement>(null);
  const otherClose = useRef<HTMLButtonElement>(null);
  const closeOther = () => {
    setOther(false);
    requestAnimationFrame(() => otherButton.current?.focus());
  };
  useEffect(() => {
    if (other) otherClose.current?.focus();
  }, [other]);
  // The search card's states (searching, found, nothing) each draw their own ×: one that comes while focus fell off the
  // one that went takes it, so Escape still reaches the card.
  const otherCloseRef = (el: HTMLButtonElement | null) => {
    otherClose.current = el;
    if (el && (!document.activeElement || document.activeElement === document.body)) el.focus();
  };
  const signedIn = Boolean(me?.activeProfile);
  const kids = Boolean(me?.activeProfile?.isKids);
  // Copies in the order the player tries them: the first one is what "Watch" starts.
  const copies = data ? orderedSources(data, undefined, me?.activeProfile?.audioLanguages, me?.activeProfile?.voiceStudios, copyAudio).map((x) => x.server) : [];
  const manage = signedIn && !kids;
  const torrServers = manage ? (raw?.sources ?? []).filter((s) => s.kind === "torrserver") : [];
  // The TorrServer this device searches by itself; else one that answers but leaves the search to the person.
  const search = manage ? autoSearchSource(raw?.sources, kids) : null;
  const manual = search ? undefined : torrServers.find(reachable);
  const resume = watchHref(d, lib?.progress, chosen);
  const playOf = (s: Copy) => `${resume}${resume.includes("?") ? "&" : "?"}source=${s.connectionId}:${encodeURIComponent(s.externalId)}`;
  // What the copy is, in words: the server's quality data, or what its release's name says — never the raw name, which
  // goes to the details; the same words as the sources screen (sources/copy-text).
  const copyText = useCopyText();
  const all = raw?.servers ?? [];
  // Servers out of reach or still indexing: said once, quietly when another way is shown, as the card when none is.
  const down = state.kind === "unreachable" ? t("serversDown", { names: state.names.join(", ") }) : state.kind === "indexing" ? t("serversIndexing", { names: state.names.join(", ") }) : null;

  /** A copy as it is heard, its marks with the size, and where it is; for the "Copy" menu, its line with the server. */
  const copyFace = (s: Copy) => {
    const q = copyText.quality(s, all, d.originalLanguage);
    const heard = copyText.sound(s, all, d.originalLanguage);
    const size = formatSize(s.quality?.sizeBytes ?? null, locale);
    // Two copies of one version differ in their sound and size: the audio format, when the server read it, says which.
    const codec = copies.length > 1 ? (s.quality?.audioCodecs?.find((c) => c !== "atmos")?.toUpperCase() ?? null) : null;
    // The marks and what they don't say; without marks, the version in words unless the heading already says it.
    // A series' copy names its pack as a found release does ("Season 1 · Episodes 1–12 of 12").
    const info = s.kind === "torrserver" ? copyText.info(s, all, d.originalLanguage) : null;
    const pack = info ? packWords(tpl, info.pack) || null : null;
    const words = q.marks.length ? [q.words[0], pack, codec, size] : [q.words[0] !== heard ? q.words[0] : null, pack, codec, size];
    const servers = new Set(copies.map((c) => c.connectionId)).size > 1;
    const lineWords = [...words, servers ? s.connectionName : null];
    return {
      heard: heard ?? q.words[0] ?? s.connectionName,
      quality: <QualityLine marks={q.marks} words={words} />,
      line: <QualityLine marks={q.marks} words={lineWords} />,
      // Two copies are told apart by their words, not by a mark one name happens to carry ("CC").
      detail: lineWords.filter(Boolean).join(" · "),
      // A TorrServer copy says it is already there, not "On «torr» · TorrServer" beside a found release's "Through".
      where: s.kind === "torrserver" ? tp("onTorrServer", { server: s.connectionName }) : [tp("onServer", { server: s.connectionName }), copyText.kindLabel(s)].join(" · "),
      match: copyText.audioMatch(s, all, d.originalLanguage),
    };
  };
  // "Watch on TV" beside a copy's "Watch": that copy, from where the profile is.
  const tcard = useTranslations("card");
  const cast = (s: Copy, size: "md" | "lg") => (
    <CastButton
      titleId={d.id}
      size={size}
      target={() => ({ kind: d.kind, tmdbId: d.tmdbId, season: ep?.season ?? null, episode: ep?.episode ?? null, source: `${s.connectionId}:${s.externalId}`, title: d.title, subtitle: ep ? tcard("episode", ep) : d.year ? String(d.year) : null })}
    />
  );
  const more = (s: Copy, size: "md" | "lg") => (
    <CopyActions copy={s} manage={manage && s.kind === "torrserver"} onRemove={setRemoval} onDetails={() => setDetails(s)} size={size} />
  );

  // Not out yet (and no copy somehow there already): when it comes out is the card, for a guest and a kids profile too.
  const today = utcToday();
  const upcomingCopy = useUpcomingCopy();
  const coming = notOutYet(d, today) && d.upcoming && copies.length === 0 ? { ...upcomingCopy(d.upcoming, today), dated: Boolean(d.upcoming.date) } : null;

  let main: ReactNode = null;
  if (coming) {
    main = (
      <WatchCard
        id="upcoming-h"
        mark={<CardMark>{<CalendarClock />}</CardMark>}
        heading={coming.text}
        where={coming.until ?? undefined}
        actions={coming.dated ? <AddToCalendar title={d} variant="secondary" size="lg" /> : undefined}
      />
    );
  } else if (!signedIn) {
    main = (
      <WatchCard
        id="servers-h"
        mark={<ServerMarks />}
        heading={tp("guest")}
        actions={
          // The one sign-in sheet, back to this tab afterwards.
          <GuestGate
            reason="watch"
            trigger={
              <Button variant="secondary" size="lg">
                {t("signInToWatch")}
              </Button>
            }
          />
        }
      />
    );
  } else if (!hydrated || avail.isPending) {
    main = <WatchCardLoading id="servers-h" />;
  } else if (state.kind === "error") {
    main = (
      <section aria-label={t("yourServers")} className="rounded-lg bg-surface-1 p-4 sm:p-6">
        <ErrorState variant="inline" error={avail.error} title={t("statusError")} onRetry={() => void avail.refetch()} retrying={avail.isFetching} />
      </section>
    );
  } else if (copies.length > 0 && other && search) {
    // "Another release": the search's card in the copy's place, × and Escape back to the copy.
    main = (
      <TorrentLookupPanel
        title={d}
        source={search}
        dismiss={{ button: <IconButton ref={otherCloseRef} icon={X} label={tp("backToCopy")} variant="ghost" size="md" onClick={closeOther} />, onEscape: closeOther }}
      />
    );
  } else if (copies.length > 0) {
    // The copy in the card: the one picked in "Copy", else the first — the one the hero starts.
    const current = copies.find((s) => copyKey(s) === picked) ?? copies[0]!;
    const f = copyFace(current);
    const faces = copies.map((s) => ({ s, f: s === current ? f : copyFace(s) }));
    // The row under the line, only when there is a choice: the other copies, another release.
    const row =
      copies.length > 1 || torrServers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {copies.length > 1 && (
            <div className="flex">
              <CopyPill
                items={faces.map(({ s, f }) => ({ key: copyKey(s), heard: f.heard, line: f.line, detail: f.detail, name: copyText.releaseName(s, all) ?? s.label }))}
                current={copyKey(current)}
                onPick={setPicked}
              />
            </div>
          )}
          {search ? (
            <Button ref={otherButton} id={FIND_SOURCE_ID} variant="tertiary" size="sm" icon={Search} onClick={() => setOther(true)} className="ms-auto">
              {tp("otherRelease")}
            </Button>
          ) : (
            torrServers.length > 0 && (
              <ActionLink id={FIND_SOURCE_ID} variant="action" arrow href={sourcesHref(resume)} className="ms-auto">
                {tp("otherRelease")}
              </ActionLink>
            )
          )}
        </div>
      ) : undefined;
    main = (
      <WatchCard
        id="servers-h"
        mark={<CardMark kind={current.kind} />}
        tag={f.match?.kind === "studio" ? <YourVoiceTag studio={f.match.studio} /> : undefined}
        heading={f.heard}
        quality={f.quality}
        where={f.where}
        actions={
          <>
            <Link href={playOf(current)} className={buttonClass("primary", "lg")}>
              <Play aria-hidden className="fill-current" />
              {t("tsWatch")}
            </Link>
            {cast(current, "lg")}
            {more(current, "lg")}
          </>
        }
      >
        {row}
      </WatchCard>
    );
  } else if (search) {
    // No copy yet: the profile's TorrServer is searched from this device.
    main = <TorrentLookupPanel title={d} source={search} />;
  } else if (manual) {
    main = (
      <WatchCard
        id="torrserver-h"
        mark={<CardMark kind="torrserver" />}
        heading={manual.name}
        where="TorrServer"
        actions={
          <Link id={FIND_SOURCE_ID} href={sourcesHref(resume)} className={buttonClass("secondary", "lg")}>
            {tp("findSource")}
          </Link>
        }
      />
    );
  } else if (down) {
    main = <WatchCard id="servers-h" mark={<CardMark>{<Server />}</CardMark>} heading={down} />;
  } else if ((data?.connections ?? 0) > 0) {
    main = <WatchCard id="servers-h" mark={<CardMark>{<Server />}</CardMark>} heading={tp("notOnServers")} />;
  } else if (!kids) {
    main = (
      <WatchCard
        id="servers-h"
        mark={<ServerMarks />}
        heading={tp("noServers")}
        actions={
          <Link href="/settings/connections" className={buttonClass("secondary", "lg")}>
            {t("connectServer")}
          </Link>
        }
      />
    );
  }
  // A server out of reach, said under the way that is shown (and only once: not when it is the card itself).
  const quiet = main && !coming && down && (copies.length > 0 || search || manual) ? <p className="text-body-s text-text-3">{down}</p> : null;

  return (
    <div data-where className={main ? "grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : "max-w-3xl"}>
      {main && (
        <div className="flex min-w-0 flex-col gap-4">
          {main}
          {quiet}
        </div>
      )}
      <Streaming title={d} locale={locale} />
      {removal && <CopyRemovalDialog target={removal} onClose={() => setRemoval(null)} />}
      <CopyDetails copy={details} all={all} originalLanguage={d.originalLanguage} onClose={() => setDetails(null)} />
    </div>
  );
}

/**
 * Legal streaming for the profile's region: each service by its logo and name, opening its own search
 * for the title, grouped by what it costs — in a subscription, free, rent or buy (JustWatch's groups); a service in two
 * groups is in both. Nothing in the region is said in words, with the way to change the region.
 */
function Streaming({ title: d, locale }: { title: TitleCore; locale: string }) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const { me } = useSession();
  const wp = d.watchProviders;
  const region = regionName(wp?.region ?? me?.activeProfile?.region ?? null, locale);
  const title = region ? tp("streamingIn", { region }) : tp("streaming");
  // The region is the profile's to change; a kids profile's is set by an adult.
  const canChange = Boolean(me?.activeProfile && !me.activeProfile.isKids);
  // One row per service in a group — its plan with ads folded in — with its kinds of offer there ("Rent · Buy").
  const groups = OFFER_GROUPS.map((g) => ({ ...g, rows: serviceOffers(wp?.providers ?? [], g.kinds).slice(0, 8) })).filter((g) => g.rows.length > 0);
  return (
    <section aria-labelledby="streaming-h" className="flex min-w-0 flex-col gap-4">
      <h3 id="streaming-h" className="text-h3 text-text-1">
        {title}
      </h3>
      {groups.length === 0 ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-text-2">
          {region ? tp("noStreaming", { region }) : tp("noStreamingHere")}
          {canChange && (
            <ActionLink variant="action" arrow href="/settings/profile">
              {tp("changeRegion")}
            </ActionLink>
          )}
        </p>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`streaming-${g.key}`}>
              <h4 id={`streaming-${g.key}`} className="mb-2 text-body-s font-semibold text-text-2">
                {t(g.key)}
              </h4>
              {/* Tiles, as Apple TV's channels: a row that scrolls sideways on a phone, wrapped beside the card on a PC. */}
              <ul className="scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:gap-y-3 sm:overflow-x-visible">
                {g.rows.map(({ provider: p, name, kinds, withAds, ids }) => {
                  const query = (id: number) => (d.originalTitle && id !== 117 ? d.originalTitle : d.title);
                  const href = ids.map((id) => providerSearch(id, query(id))).find(Boolean) ?? null;
                  // In its group a tile says only what the group doesn't: "Rent · Buy", a plan with ads.
                  const meta = (
                    g.key === "offersPaid"
                      ? kinds.map((k) => t(OFFER_LABEL[k]))
                      : [kinds.includes("ads") || (g.key === "offerFlatrate" && withAds) ? (g.key === "offerFree" ? t("offerAdsShort") : tp("planWithAds")) : null]
                  )
                    .filter(Boolean)
                    .join(" · ");
                  const face = (
                    <>
                      <span aria-hidden className="grid size-14 place-items-center overflow-hidden rounded-md bg-surface-2 text-text-2 transition-[scale] duration-fast ease-fast group-hover/svc:scale-105 [&>svg]:size-6">
                        {p.logoPath ? <img src={tmdbImage(p.logoPath, "w92") ?? undefined} alt="" className="size-full object-cover" loading="lazy" /> : <Tv />}
                      </span>
                      <span className="mt-2 line-clamp-2 text-center text-body-s font-semibold text-text-1">{name}</span>
                      {meta && <span className="mt-0.5 line-clamp-2 text-center text-caption text-text-2">{meta}</span>}
                    </>
                  );
                  return (
                    <li key={p.id} className="w-24 shrink-0 snap-start">
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer noopener" aria-label={tp("watchOn", { service: name })} className="group/svc flex flex-col items-center rounded-md py-1">
                          {face}
                        </a>
                      ) : (
                        <div className="flex flex-col items-center py-1">{face}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {/* The data's source in a quiet line, and TMDB's page of every offer. */}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-3">
            {t("streamingAttribution")}
            {wp?.link && (
              <a href={wp.link} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-6 items-center gap-1 underline underline-offset-3 hover:text-text-1 max-sm:min-h-11">
                {tp("allOffersTmdb")}
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            )}
          </p>
        </>
      )}
    </section>
  );
}
