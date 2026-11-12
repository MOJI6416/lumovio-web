"use client";

import type { Availability } from "@lumovio/contracts";
import { Play, Server } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { GuestGate } from "@/components/shell/GuestGate";
import { CardMark, ServerMarks, WatchCard } from "@/components/title/WatchCard";
import { StatusBadge, Tag } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Link } from "@/i18n/navigation";
import type { WatchState } from "@/lib/watch-state";
import { useCopyText } from "./copy-text";
import { CopyPill } from "./CopyPill";
import { QualityLine } from "./QualityBadges";
import { formatSize, packWords, YourVoiceTag } from "./release-text";

/** A copy of the viewing on one of the profile's servers, as the sources screen lists it. */
export interface ChoiceCopy {
  key: string;
  server: Availability;
  /** The one the player shows now (the screen was opened over it). */
  playing: boolean;
  /** It failed to start in this viewing. */
  failed: boolean;
}

/**
 * The profile's copies on the sources screen, as "Where to watch" says them:
 * the first — the one playing, else the one "Watch" starts — in the card (what is heard, the marks, where; the white
 * "Watch" or "Continue watching" and "•••"), the others in its "Copy" choice. With no copy, the card says why
 * in its heading and its one button leads on: the guest's sign-in, a profile without servers, servers out of reach;
 * with a TorrServer to search, nothing — the search below is the way (a server out of reach is said quietly).
 */
export function CopyChoice({
  copies,
  all,
  originalLanguage,
  state,
  signedIn,
  kids,
  finder,
  next,
  onWatch,
  onContinue,
  more,
  error,
  onRetry,
  retrying,
}: {
  copies: ChoiceCopy[];
  /** Every copy of the title (a torrent's own entry names its bound files' release). */
  all: Availability[];
  originalLanguage: string | null;
  state: WatchState;
  signedIn: boolean;
  kids: boolean;
  /** The TorrServer search follows on the screen. */
  finder: boolean;
  /** Where the sign-in comes back to. */
  next: string;
  onWatch: (copy: ChoiceCopy, el: Element) => void;
  onContinue: () => void;
  /** A copy's "•••" (CopyActions: details, unlink, remove). */
  more?: (copy: Availability, size: "md" | "lg") => ReactNode;
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tl = useTranslations("player");
  const locale = useLocale();
  const copyText = useCopyText();
  // The copy in the card when there are several ("Copy"), by its key; none — the one playing, else the first.
  const [picked, setPicked] = useState<string | null>(null);
  const down = state.kind === "unreachable" ? t("serversDown", { names: state.names.join(", ") }) : state.kind === "indexing" ? t("serversIndexing", { names: state.names.join(", ") }) : null;

  const servers = new Set(copies.map((c) => c.server.connectionId)).size > 1;
  /** A copy in the words of the title's card: what is heard, the marks with the size, where it is; its line for "Copy". */
  const face = (s: Availability) => {
    const q = copyText.quality(s, all, originalLanguage);
    const heard = copyText.sound(s, all, originalLanguage);
    const size = formatSize(s.quality?.sizeBytes ?? null, locale);
    // Two copies of one version differ in their sound and size: the audio format, when the server read it, says which.
    const codec = copies.length > 1 ? (s.quality?.audioCodecs?.find((c) => c !== "atmos")?.toUpperCase() ?? null) : null;
    // A series' copy names its pack as a found release does ("Season 1 · Episodes 1–12 of 12").
    const info = s.kind === "torrserver" ? copyText.info(s, all, originalLanguage) : null;
    const pack = info ? packWords(tl, info.pack) || null : null;
    const words = q.marks.length ? [q.words[0], pack, codec, size] : [q.words[0] !== heard ? q.words[0] : null, pack, codec, size];
    const lineWords = [...words, servers ? s.connectionName : null];
    return {
      heard: heard ?? q.words[0] ?? s.connectionName,
      quality: <QualityLine marks={q.marks} words={words} />,
      line: <QualityLine marks={q.marks} words={lineWords} />,
      // Two copies are told apart by their words, not by a mark one name happens to carry ("CC").
      detail: lineWords.filter(Boolean).join(" · "),
      where: s.kind === "torrserver" ? tp("onTorrServer", { server: s.connectionName }) : [tp("onServer", { server: s.connectionName }), copyText.kindLabel(s)].join(" · "),
      match: copyText.audioMatch(s, all, originalLanguage),
    };
  };
  const label = (c: ChoiceCopy) => (c.playing ? <Tag>{tl("nowPlaying")}</Tag> : c.failed ? <StatusBadge status="warning">{tl("failedSource")}</StatusBadge> : null);

  if (!signedIn)
    return (
      <WatchCard
        id="copies-h"
        mark={<ServerMarks />}
        heading={tp("guest")}
        actions={
          <GuestGate
            reason="watch"
            next={next}
            trigger={
              <Button variant="primary" size="lg">
                {t("signInToWatch")}
              </Button>
            }
          />
        }
      />
    );
  if (state.kind === "error" && copies.length === 0)
    return (
      <section aria-label={t("yourServers")} className="rounded-lg bg-surface-1 p-4 sm:p-6">
        <ErrorState variant="inline" error={error} title={t("statusError")} onRetry={onRetry} retrying={retrying} />
      </section>
    );
  if (copies.length === 0) {
    if (finder) return down ? <p className="text-body-s text-text-3">{down}</p> : null;
    const heading = kids ? t("statusKidsNone") : down ? down : state.kind === "notInLibrary" ? tp("notOnServers") : tp("noServers");
    const action =
      kids || state.kind === "notInLibrary" || state.kind === "indexing" ? null : (
        <Link href="/settings/connections" className={buttonClass("secondary", "lg")}>
          {state.kind === "unreachable" ? t("checkConnection") : t("connectServer")}
        </Link>
      );
    return <WatchCard id="copies-h" mark={state.kind === "noServers" && !kids ? <ServerMarks /> : <CardMark>{<Server />}</CardMark>} heading={heading} actions={action} />;
  }

  // The one playing leads; else the one picked in "Copy", else the first — which the title's "Watch" starts.
  const first = copies.find((c) => c.key === picked) ?? copies.find((c) => c.playing) ?? copies[0]!;
  const f = face(first.server);
  const watch = (c: ChoiceCopy) =>
    c.playing ? (
      <Button variant="primary" size="lg" onClick={onContinue}>
        <Play aria-hidden className="fill-current" />
        {tl("continueWatching")}
      </Button>
    ) : (
      <Button variant="primary" size="lg" onClick={(e) => onWatch(c, e.currentTarget)}>
        <Play aria-hidden className="fill-current" />
        {t("tsWatch")}
      </Button>
    );
  return (
    <section aria-labelledby="servers-h" className="flex flex-col gap-4">
      {/* Under the screen's h1 (the title); the card's heading is an h3, as in "Where to watch". */}
      <h2 id="servers-h" className="sr-only">
        {t("yourServers")}
      </h2>
      <WatchCard
        id="copies-h"
        mark={<CardMark kind={first.server.kind} />}
        tag={label(first) ?? (f.match?.kind === "studio" ? <YourVoiceTag studio={f.match.studio} /> : undefined)}
        heading={f.heard}
        quality={f.quality}
        where={f.where}
        actions={
          <>
            {watch(first)}
            {more?.(first.server, "lg")}
          </>
        }
      >
        {/* The other copies: the same "Copy" choice as the title's card; the search follows below anyway. */}
        {copies.length > 1 && (
          <div className="flex">
            <CopyPill
              items={copies.map((c) => {
                const r = c === first ? f : face(c.server);
                return { key: c.key, heard: r.heard, line: r.line, detail: r.detail, name: copyText.releaseName(c.server, all) ?? c.server.label, tag: label(c) ?? undefined };
              })}
              current={first.key}
              onPick={setPicked}
            />
          </div>
        )}
      </WatchCard>
      {down && <p className="text-body-s text-text-3">{down}</p>}
    </section>
  );
}
