"use client";

import type { ReleaseQuality, SourceState } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Info, Play, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { endLaunch, startLaunch } from "@/components/player/launch";
import { ReleaseDetails } from "@/components/sources/Details";
import { useMediaErrorText } from "@/components/sources/media-error";
import { formatSize, packWords, QUALITY_MODES, ReleaseLine, useReleaseText, VersionLine, YourVoiceTag } from "@/components/sources/release-text";
import { Button, buttonClass } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Link as ActionLink } from "@/components/ui/Link";
import { Menu, MenuCheckboxItem, MenuSeparator } from "@/components/ui/Menu";
import { useLibraryState } from "@/hooks/useLibraryState";
import { isOut, useReleasePrefs, useTorrentLookup } from "@/hooks/useTorrentLookup";
import { Link, useRouter } from "@/i18n/navigation";
import { type Edition, NO_CHOICE, pickAlternatives, pickRelease, type ReleaseChoice } from "@/lib/media/release-pick";
import { isDubbing, pictureReasons, type RankedRelease, voiceWish, wishNameTrack } from "@/lib/media/releases";
import { background } from "@/lib/optional";
import { addFirstWorking, takeBack } from "@/lib/media/torrent-source";
import { useChosenSeason } from "./chosen-season";
import { sourcesHref, startEpisode, type TitleCore, watchHref } from "./core";
import { hasStudioMark, StudioMark, StudioSlot } from "@/components/sources/StudioMark";
import { CardMark, PickItem, PickPill, WatchCard, WatchCardLoading } from "./WatchCard";

const ID = "torrserver-h";

/**
 * "Where to watch" without a copy on the profile's servers: this device searches
 * the profile's own TorrServer and shows one release in the card — what is heard, the picture as marks, where from —
 * with the white "Watch" that adds it and starts the player. Under it, three pills lead to another release, each
 * narrowing the one before: the audio (the profile's languages first), the cut of the film (theatrical, extended, the
 * director's) and the quality (the mode — Auto, Best, Smaller file — or a picture version by hand); a pill shows only
 * when there is something to choose. Choosing changes the card and nothing else: nothing is added before "Watch".
 * The hero starts the same release (lib/media/release-pick, TorrentProbe).
 */
/** `lead`: the screen's first way to watch — its "Watch" is white; under a copy ("Another release") it is secondary. */
export function TorrentLookupPanel({ title: d, source, lead = true }: { title: TitleCore; source: SourceState; lead?: boolean }) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tpl = useTranslations("player");
  const tc = useTranslations("common");
  const locale = useLocale();
  const mediaError = useMediaErrorText();
  const router = useRouter();
  const qc = useQueryClient();
  const prefs = useReleasePrefs();
  const [mode, setMode] = useState<ReleaseQuality>(prefs.quality);
  const { data: state } = useLibraryState(d.id);
  // "Watch" opens the episode the title's Play would (resume, else the next): the release has to hold its season.
  // The season picked in "Episodes", else the one the profile is in (./chosen-season): the release has to hold it.
  const season = useChosenSeason(d.id);
  const start = d.kind === "tv" ? startEpisode(d, state?.progress, season) : null;
  const lookup = useTorrentLookup(d, source, true, mode, start?.season ?? null, start?.episode ?? null);
  const text = useReleaseText();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<RankedRelease | null>(null);
  const [choice, setChoice] = useState<ReleaseChoice>(NO_CHOICE);
  useEffect(() => setMode(prefs.quality), [prefs.quality]);
  const ranked = lookup.data?.ranked;
  const pick = useMemo(() => pickRelease(ranked ?? [], prefs, choice), [ranked, prefs, choice]);

  // Nothing is searched for a title that is not out yet, so nothing is said either.
  if (!isOut(d)) return null;

  const playHref = watchHref(d, state?.progress, season);
  const join = playHref.includes("?") ? "&" : "?";
  const via = tp("viaTorrServer", { name: source.name });
  const { option, edition, version, chosen } = pick;
  // What "Watch" asks the player to start: a studio's track, or a language's alone ("Ukrainian · MVO").
  const voice = option && (option.studio || option.language) ? option.key : null;
  // A cut and a picture go along only when chosen by hand: with nothing chosen the screen starts with the same release anyway.
  const pickHref = sourcesHref(playHref, `${option ? `&voice=${encodeURIComponent(option.key)}` : ""}${edition && choice.edition ? `&edition=${edition}` : ""}${version && choice.picture ? `&picture=${version.key}` : ""}${mode !== prefs.quality ? `&quality=${mode}` : ""}`);
  // One track of a release in words: the studio's, else the one the player starts of a language alone or its dub.
  const heardOf = (x: RankedRelease) =>
    text.audio({ info: x.info, language: option?.language ?? x.language }, option?.studio ?? wishNameTrack(x.info, voiceWish(option?.key ?? null), prefs.studios));
  // What the search does, for a screen reader (no explanation on screen).
  const about = <p className="sr-only">{`${t("tsAddsNote", { name: source.name })} ${prefs.languagesFromProfile ? t("tsNote") : t("tsNoteLocale")}`}</p>;

  if (lookup.isLoading) return <WatchCardLoading id={ID} kind="torrserver" status={t("tsSearching", { name: source.name })} />;
  if (lookup.isError)
    return (
      <WatchCard
        id={ID}
        mark={<CardMark kind="torrserver" />}
        heading={t("tsFailed", { name: source.name })}
        where={mediaError(lookup.error)}
        actions={
          <>
            <Button variant="secondary" size="lg" loading={lookup.isFetching} onClick={() => void lookup.refetch()}>
              {tc("retry")}
            </Button>
            <ActionLink variant="action" arrow href={pickHref}>
              {t("tsSearchManually")}
            </ActionLink>
          </>
        }
      />
    );
  if (!chosen)
    return (
      <>
        {about}
        <WatchCard
          id={ID}
          mark={<CardMark kind="torrserver" />}
          heading={<span aria-live="polite">{t("tsNothing")}</span>}
          where={via}
          actions={
            <Link href={pickHref} className={buttonClass("secondary", "lg")}>
              {t("tsSearchManually")}
            </Link>
          }
        />
      </>
    );

  // `alternatives`: what the card falls back on when the release won't add (its tracker gives no torrent), for the card's
  // own pick; a release chosen in its details plays alone.
  const play = async (x: RankedRelease, voice: string | null, alternatives: RankedRelease[] = []) => {
    setAdding(true);
    setError(null);
    // The launch's scene from the press, as the sources screen starts it: the add is its first step, the release under it,
    // the player's page goes on with it; "←" drops it before the player is asked for, "Another source" drops it for the
    // sources screen.
    let dropped = false;
    const drop = () => {
      dropped = true;
      setAdding(false);
    };
    startLaunch(
      {
        status: tpl("stage_add"),
        detail: `${[text.picture(x.info), heardOf(x)].filter(Boolean).join(" · ")} — ${source.name}`,
        onBack: () => {
          drop();
          endLaunch();
        },
        actions: (
          <Button
            variant="secondary"
            onClick={() => {
              drop();
              router.push(pickHref);
            }}
          >
            {tpl("anotherSource")}
          </Button>
        ),
      },
      true,
    );
    try {
      const added = await addFirstWorking(source.id, d, start?.season ?? null, [x.result, ...alternatives.map((a) => a.result)]);
      if (!added) throw new Error(tpl("addFailed"));
      await qc.invalidateQueries({ queryKey: ["availability", d.id] });
      if (dropped) {
        // Left before it played ("←" during the add): a torrent this add brought is taken back, never one that was there.
        if (!added.existed) background(takeBack(source.id, added.hash).then(() => qc.invalidateQueries({ queryKey: ["availability", d.id] })));
        return;
      }
      // The chosen dubbing goes along, so the player starts that studio's track once the file is read;
      // "added" lets the watch page show this add as the first of its stages.
      router.push(`${playHref}${join}source=${source.id}:${encodeURIComponent(added.hash)}&added=1${added.existed ? "" : "&brought=1"}${voice ? `&voice=${encodeURIComponent(voice)}` : ""}`);
    } catch (e) {
      if (dropped) return;
      endLaunch();
      setError(mediaError(e));
      setAdding(false);
    }
  };

  const choose = (next: Partial<ReleaseChoice>) => setChoice((c) => ({ ...c, ...next }));
  const resolutions = text.resolutions;
  const editionName = (e: Edition) => t(`edition_${e}`);
  // The mode's reasons explain its own pick; a version the person picked needs none.
  const reasons = choice.picture === null ? pictureReasons(chosen, pick.pool, { ...prefs, quality: mode }) : [];
  // The heading says the chosen audio's own language ("Russian · dub" for a Russian dub, whatever else the release has).
  const heard = heardOf(chosen) || text.option({ studio: null, voice: null, language: null });
  // "Your voice-over": the option is the profile's studio — or a dub, for the profile's "Dubbing".
  const studioMatch = chosen.studio && (option?.studio === chosen.studio || (isDubbing(chosen.studio) && option?.voice === "dub"));
  const kept = lookup.data?.emptyAt ? t("tsKept", { minutes: Math.max(0, Math.round((Date.now() - lookup.data.at) / 60_000)) }) : null;
  const versionName = version ? text.version(version.resolution, version.range) : "";
  const qualityValue = choice.picture ? versionName : [t(`tsQuality_${mode}`), versionName].filter(Boolean).join(" · ");
  // The studios' marks in the choice, when one of its studios has one: every row keeps the place, so the names line up.
  const voiceMarks = pick.options.some((o) => hasStudioMark(o.studio));
  const voiceValue = option ? [text.option(option), option.language && option.language !== prefs.languages[0] ? text.language(option.language) : null].filter(Boolean).join(", ") : "";

  return (
    <>
      {about}
      {/* Results kept through an empty search: said to a screen reader, not on screen. */}
      {kept && <p className="sr-only">{kept}</p>}
      <WatchCard
        id={ID}
        mark={<CardMark kind="torrserver" />}
        tag={studioMatch ? <YourVoiceTag studio={chosen.studio!} /> : undefined}
        heading={heard}
        quality={
          <>
            {/* The picture and sound as marks (4K, Dolby Vision, Dolby Atmos), then the source, the cut when no pill says it, the size. */}
            <ReleaseLine
              info={chosen.info}
              rest={[pick.editions.length === 0 && edition ? editionName(edition) : null, d.kind === "tv" ? packWords(tpl, chosen.info.pack) || null : null, formatSize(chosen.result.size, locale)]}
            />
            {reasons.length > 0 && <span className="sr-only"> {reasons.map((r) => t(`tsWhy_${r}`)).join(" ")}</span>}
          </>
        }
        where={[via, chosen.result.seeders !== null ? t("tsSeeders", { count: chosen.result.seeders }) : null, chosen.result.tracker].filter(Boolean).join(" · ")}
        // A known risk only: "unknown" — a name without its codec, most of them — is said in the release's details.
        note={
          chosen.fit === "poor" && (
            <p className="flex items-start gap-1.5">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              {t(chosen.info.codec === "hevc" ? "tsFitHevc" : "tsFitDv")}
            </p>
          )
        }
        actions={
          <>
            <Button size="lg" variant={lead ? "primary" : "secondary"} loading={adding} onClick={() => void play(chosen, voice, pickAlternatives(pick))}>
              <Play aria-hidden className="fill-current" />
              {t("tsWatch")}
            </Button>
            <IconButton icon={Info} variant="secondary" size="lg" label={tp("releaseDetails")} onClick={() => setDetails(chosen)} />
          </>
        }
      >
        {error && (
          <InlineAlert tone="danger" title={tp("releaseAddFailedTitle")}>
            {error}
          </InlineAlert>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          {/* One row of pills that scrolls sideways on a phone (to the card's edges), wrapped on wider screens. */}
          <div className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 empty:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {pick.options.length > 1 && option && (
              <Menu
                label={tp("voiceChoice")}
                align="start"
                trigger={<PickPill name={tp("voiceChoice")} value={voiceValue} lead={<StudioMark studio={option.studio} className="ms-0.5 size-5" />} disabled={adding} aria-label={t("pickValue", { name: tp("voiceChoice"), value: voiceValue })} />}
              >
                {pick.options.map((o) => (
                  <MenuCheckboxItem key={o.key} checked={o === option} lead={voiceMarks ? <StudioSlot studio={o.studio} className="size-8" /> : undefined} onCheckedChange={() => choose({ voice: o.key, edition: null, picture: null })}>
                    <PickItem
                      name={text.option(o)}
                      sub={[o.language && text.option(o) !== text.cap(text.language(o.language)) ? text.cap(text.language(o.language)) : null, resolutions(o.versions.map((v) => v.resolution))].filter(Boolean).join(" · ")}
                    />
                  </MenuCheckboxItem>
                ))}
              </Menu>
            )}
            {pick.editions.length > 1 && edition && (
              <Menu
                label={t("pickEdition")}
                align="start"
                trigger={<PickPill name={t("pickEdition")} value={editionName(edition)} disabled={adding} aria-label={t("pickValue", { name: t("pickEdition"), value: editionName(edition) })} />}
              >
                {pick.editions.map((e) => (
                  <MenuCheckboxItem key={e.key} checked={e.key === edition} onCheckedChange={() => choose({ edition: e.key, picture: null })}>
                    <PickItem name={editionName(e.key)} sub={resolutions(e.resolutions)} />
                  </MenuCheckboxItem>
                ))}
              </Menu>
            )}
            {pick.pool.length > 1 && (
              <Menu
                label={t("pickQuality")}
                align="start"
                trigger={<PickPill name={t("pickQuality")} value={qualityValue} disabled={adding} aria-label={t("pickValue", { name: t("pickQuality"), value: qualityValue })} />}
              >
                {/* The mode picks the version for this screen (Auto), the best one or the smallest file; a version by hand overrides it. */}
                {QUALITY_MODES.map((m) => (
                  <MenuCheckboxItem
                    key={m}
                    checked={choice.picture === null && mode === m}
                    onCheckedChange={() => {
                      setMode(m);
                      choose({ picture: null });
                    }}
                  >
                    {t(`tsQuality_${m}`)}
                  </MenuCheckboxItem>
                ))}
                {pick.versions.length > 1 && (
                  <>
                    <MenuSeparator />
                    {[...pick.versions].reverse().sort((a, b) => (b.resolution ?? -1) - (a.resolution ?? -1)).map((v) => (
                      <MenuCheckboxItem key={v.key} checked={choice.picture === v.key} onCheckedChange={() => choose({ picture: v.key })}>
                        <PickItem name={<VersionLine resolution={v.resolution} range={v.range} />} sub={formatSize(v.best.result.size, locale)} />
                      </MenuCheckboxItem>
                    ))}
                  </>
                )}
              </Menu>
            )}
          </div>
          <ActionLink variant="action" arrow href={pickHref} className="self-start sm:ms-auto sm:self-auto">
            {/* What the screen lists: its card and "Other releases" — not dead ones, cinema recordings, other seasons. */}
            {tp("allReleases", { count: (lookup.data?.ranked ?? []).filter((x) => x.holds !== false && !x.info.cam && !x.dead).length })}
          </ActionLink>
        </div>
        <ReleaseDetails
          result={details?.result ?? null}
          release={details ?? undefined}
          tv={d.kind === "tv"}
          note={tpl("addsTo", { server: source.name })}
          loading={adding}
          onClose={() => setDetails(null)}
          onWatch={() => {
            setDetails(null);
            if (details) void play(details, voice);
          }}
        />
      </WatchCard>
    </>
  );
}
