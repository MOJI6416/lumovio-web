"use client";

import type { Availability as Copy, WatchProvider } from "@lumovio/contracts";
import { ExternalLink, Play, Server, Tv } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { ServerMark } from "@/components/connections/ServerMark";
import { useSession } from "@/components/providers/Providers";
import { GuestGate } from "@/components/shell/GuestGate";
import { CopyDetails } from "@/components/sources/CopyDetails";
import { useCopyText } from "@/components/sources/copy-text";
import { useReleaseText } from "@/components/sources/release-text";
import { InfoTip } from "@/components/sources/InfoTip";
import { providerSearch } from "@/components/sources/provider-links";
import { SourceRow, SourceSection } from "@/components/sources/SourceRow";
import { Tag } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Link as ActionLink, linkClass } from "@/components/ui/Link";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTitleAvailability } from "@/hooks/useAvailability";
import { useLibraryState } from "@/hooks/useLibraryState";
import { Link } from "@/i18n/navigation";
import { regionName } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import { orderedSources } from "@/lib/media/source-order";
import { titleCopies } from "@/lib/watch-state";
import { CopyActions, CopyRemovalDialog, FIND_SOURCE_ID, type RemovalTarget } from "./CopyActions";
import { sourcesHref, type TitleCore, watchHref } from "./core";
import { useHydrated } from "./hydrated";
import { serviceOffers } from "./services";
import { TorrentLookupPanel } from "./TorrentLookupPanel";

const OFFER_KINDS: WatchProvider["kind"][] = ["flatrate", "free", "ads", "rent", "buy"];
const OFFER_LABEL = { flatrate: "offerFlatrate", free: "offerFree", ads: "offerAds", rent: "offerRent", buy: "offerBuy" } as const;

/**
 * "Where to watch" (design-system 7.15, S06, C14; SRC-01, SRC-09, SRC-14, TTL-12, TTL-14): every way to start it in
 * rows of one kind (SourceRow) and one word for the button, "Watch" — the profile's copies on its servers (the first is
 * the one the main button starts), the TorrServer's recommended release when there is no copy, and the legal streaming
 * services of the region with their names, each opening the service itself. Sources of data and legal notes are in the
 * sections' "i". A guest is invited to sign in rather than told to connect a server to an account they don't have.
 */
export function Availability({ title: d }: { title: TitleCore }) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const locale = useLocale();
  const { me } = useSession();
  const avail = useTitleAvailability(d.id);
  // What the hero already fetched waits for the end of hydration, so the first render is the server's (./hydrated).
  const hydrated = useHydrated();
  const { state } = avail;
  const raw = hydrated ? avail.data : undefined;
  const data = raw ? titleCopies(raw) : undefined;
  const { data: lib } = useLibraryState(d.id);
  const [removal, setRemoval] = useState<RemovalTarget | null>(null);
  const [details, setDetails] = useState<Copy | null>(null);
  const signedIn = Boolean(me?.activeProfile);
  const kids = Boolean(me?.activeProfile?.isKids);
  // Copies in the order the player tries them: the first one is what "Watch" starts.
  const copies = data ? orderedSources(data, undefined, me?.activeProfile?.audioLanguages).map((x) => x.server) : [];
  const torrServers = (raw?.sources ?? []).filter((s) => s.kind === "torrserver");
  const manage = signedIn && !kids;
  // A torrent's files bound to episodes of this series (they are not copies of their own).
  const hashOf = (s: { externalId: string }) => s.externalId.split(":")[0]!.toLowerCase();
  const episodeFilesOf = (copy: Copy) =>
    (raw?.servers ?? []).filter((x) => x.kind === "torrserver" && x.season !== null && x.episode !== null && x.connectionId === copy.connectionId && hashOf(x) === hashOf(copy));
  const resume = watchHref(d, lib?.progress);
  const playOf = (s: Copy) => `${resume}${resume.includes("?") ? "&" : "?"}source=${s.connectionId}:${encodeURIComponent(s.externalId)}`;

  // What the copy is, in words: the server's quality data, or what its release's name says — never the raw name, which
  // goes to the details (SRC-16); the same words as the sources screen (sources/copy-text).
  const copyText = useCopyText();
  const releaseText = useReleaseText();

  let servers: ReactNode;
  if (!signedIn) {
    servers = (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body text-text-2">
        {tp("guestServers")}
        {/* The one sign-in sheet (8.6), back to this tab afterwards. */}
        <GuestGate
          reason="watch"
          trigger={
            <Button variant="secondary" size="sm">
              {t("signInToWatch")}
            </Button>
          }
        />
      </p>
    );
  } else if (!hydrated || avail.isPending) {
    servers = <Skeleton className="h-20 w-full" />;
  } else if (state.kind === "error") {
    servers = <ErrorState error={avail.error} title={t("statusError")} onRetry={() => void avail.refetch()} retrying={avail.isFetching} />;
  } else if (copies.length > 0) {
    servers = copies.map((s, i) => {
      // What its audio has to do with the profile: the same label a release's row has (7.4; Jellyfin's tracks too).
      const match = copyText.audioMatch(s, raw?.servers ?? [], d.originalLanguage);
      const first = i === 0 && copies.length > 1;
      return (
          <SourceRow
            key={`${s.connectionId}-${s.externalId}`}
            selected={i === 0}
            icon={<ServerMark kind={s.kind} />}
            badges={
              first || match ? (
                <>
                  {first && <Tag>{t("startsFirst")}</Tag>}
                  {match && <Tag>{match.kind === "studio" ? t("tsYourVoice", { studio: match.studio }) : t("tsYourLanguage", { language: releaseText.cap(releaseText.language(match.language)) })}</Tag>}
                </>
              ) : undefined
            }
            title={copyText.version(s, raw?.servers ?? [], d.originalLanguage)}
            meta={copyText.meta(s, d.title)}
            action={
              <Link href={playOf(s)} className={buttonClass("secondary", "md")}>
                <Play aria-hidden className="fill-current" />
                {t("tsWatch")}
              </Link>
            }
            more={<CopyActions title={d} copy={s} episodes={episodeFilesOf(s)} manage={manage && s.kind === "torrserver"} onRemove={setRemoval} onDetails={() => setDetails(s)} />}
          />
      );
    });
  } else if (state.kind === "unreachable" || state.kind === "indexing") {
    servers = (
      <p className="text-body text-text-2">
        {state.kind === "unreachable" ? t("statusUnreachable", { names: state.names.join(", ") }) : t("statusIndexing", { names: state.names.join(", ") })}
      </p>
    );
  } else if ((data?.connections ?? 0) > 0) {
    servers = <p className="text-body text-text-2">{tp("notOnServers")}</p>;
  } else if (!kids) {
    servers = (
      <EmptyState
        icon={Server}
        title={tp("noServersTitle")}
        text={t("noServers")}
        action={
          <Link href="/settings/connections" className={buttonClass("secondary")}>
            {t("connectServer")}
          </Link>
        }
        className="items-start px-0 py-2 text-start"
      />
    );
  }

  const auto = torrServers.find((s) => s.autoSearch);
  const manual = !auto ? torrServers[0] : undefined;
  return (
    <div className="flex max-w-5xl flex-col gap-10">
      {servers && (
        <SourceSection
          id="servers-h"
          title={t("yourServers")}
          footer={
            manage &&
            torrServers.length > 0 &&
            copies.length > 0 && (
              <ActionLink id={FIND_SOURCE_ID} variant="action" arrow href={sourcesHref(resume)} className="self-start">
                {tp("allSources")}
              </ActionLink>
            )
          }
        >
          {servers}
        </SourceSection>
      )}
      {/* No copy yet: the profile's TorrServer, when it may, is searched from this device. */}
      {manage && copies.length === 0 && auto && raw && <TorrentLookupPanel title={d} sources={raw.sources} />}
      {manage && copies.length === 0 && manual && (
        <SourceSection id="torrserver-h" title={tp("viaTorrServer", { name: manual.name })}>
          <p className="text-body text-text-2">{tp("manualText", { name: manual.name })}</p>
          <ActionLink id={FIND_SOURCE_ID} variant="action" arrow href={sourcesHref(resume)} className="self-start">
            {tp("findSource")}
          </ActionLink>
        </SourceSection>
      )}
      <Streaming title={d} locale={locale} />
      {removal && <CopyRemovalDialog target={removal} onClose={() => setRemoval(null)} />}
      <CopyDetails copy={details} all={raw?.servers ?? []} originalLanguage={d.originalLanguage} onClose={() => setDetails(null)} />
    </div>
  );
}

/**
 * Legal streaming for the profile's region: each service by name, opening its own search for the title (TTL-12, TTL-14).
 * Nothing in the region is said in words, with the way to change the region (not "Streaming: —").
 */
function Streaming({ title: d, locale }: { title: TitleCore; locale: string }) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const { me } = useSession();
  const wp = d.watchProviders;
  const region = regionName(wp?.region ?? me?.activeProfile?.region ?? null, locale);
  // One row per service — its plan with ads folded in (TTL-26) — with its kinds of offer on one line ("Rent · Buy").
  const rows = serviceOffers(wp?.providers ?? [], OFFER_KINDS).slice(0, 10);
  const title = region ? tp("streamingIn", { region }) : tp("streaming");
  // The region is the profile's to change; a kids profile's is set by an adult (8.10).
  const canChange = Boolean(me?.activeProfile && !me.activeProfile.isKids);
  return (
    <SourceSection
      id="streaming-h"
      title={title}
      info={<InfoTip title={title} note={t("offersExternal")} rules={t("streamingAttribution")} />}
      footer={
        wp?.link &&
        rows.length > 0 && (
          <a href={wp.link} target="_blank" rel="noreferrer noopener" className={linkClass("action", "self-start")}>
            {tp("allOffersTmdb")}
            <ExternalLink aria-hidden className="size-4" />
          </a>
        )
      }
    >
      {rows.length === 0 ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-text-2">
          {region ? tp("noStreaming", { region }) : tp("noStreamingHere")}
          {canChange && (
            <ActionLink variant="action" arrow href="/settings/profile">
              {tp("changeRegion")}
            </ActionLink>
          )}
        </p>
      ) : (
        rows.map(({ provider: p, name, kinds, withAds, ids }) => {
          const query = (id: number) => (d.originalTitle && id !== 117 ? d.originalTitle : d.title);
          const href = ids.map((id) => providerSearch(id, query(id))).find(Boolean) ?? null;
          // "With ads" in TMDB's own kinds is a free offer; a paid plan with ads is said as such.
          const meta = [...kinds.map((k) => t(OFFER_LABEL[k])), withAds && !kinds.includes("ads") ? tp("planWithAds") : null].filter(Boolean).join(" · ");
          return (
            <SourceRow
              key={p.id}
              icon={p.logoPath ? <img src={tmdbImage(p.logoPath, "w92") ?? undefined} alt="" className="size-full object-cover" loading="lazy" /> : <Tv />}
              title={name}
              meta={meta}
              action={
                href ? (
                  <a href={href} target="_blank" rel="noreferrer noopener" aria-label={tp("watchOn", { service: name })} className={buttonClass("secondary", "md")}>
                    <ExternalLink aria-hidden />
                    {t("tsWatch")}
                  </a>
                ) : undefined
              }
            />
          );
        })
      )}
    </SourceSection>
  );
}
