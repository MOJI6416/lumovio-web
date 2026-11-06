"use client";

import type { ReleaseQuality, SourceState } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Info, Magnet, Play, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { useMediaErrorText } from "@/components/sources/media-error";
import { QualityBadges, qualityMarks } from "@/components/sources/QualityBadges";
import { AudioMatchBadge, formatSize, QUALITY_MODES, useReleaseText } from "@/components/sources/release-text";
import { SourceRow, SourceSection } from "@/components/sources/SourceRow";
import { AccentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/Chip";
import { SidePanel } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Link as ActionLink } from "@/components/ui/Link";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLibraryState } from "@/hooks/useLibraryState";
import { autoSearchSource, isOut, useReleasePrefs, useTorrentLookup } from "@/hooks/useTorrentLookup";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { bestOf, pictureReasons, type Range, type RankedRelease, type ReleaseInfo, voiceOptions } from "@/lib/media/releases";
import { addTorrentSource } from "@/lib/media/torrent-source";
import { useAction } from "@/lib/use-action";
import { sourcesHref, startEpisode, type TitleCore, watchHref } from "./core";

/**
 * "Where to watch" without a copy on the profile's servers (design-system 7.15, SRC-01, SRC-09): this device searches
 * the profile's own TorrServer and recommends a release for its audio languages, studios and this screen — one
 * SourceRow with "Watch". The audio (FilterChips) and the picture version are picked apart, under the profile's
 * quality mode or another one for this viewing — said so, with "Save as default" (the scope of every choice is
 * visible). Picking only changes the choice; nothing is added to the TorrServer until "Watch". What the search does
 * and that "Watch" adds the release is in the section's "i", not under every button.
 */
export function TorrentLookupPanel({ title: d, sources }: { title: TitleCore; sources: SourceState[] | undefined }) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tpl = useTranslations("player");
  const tc = useTranslations("common");
  const locale = useLocale();
  const mediaError = useMediaErrorText();
  const { me } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const prefs = useReleasePrefs();
  const [mode, setMode] = useState<ReleaseQuality>(prefs.quality);
  const source = autoSearchSource(sources, Boolean(me?.activeProfile?.isKids));
  const { data: state } = useLibraryState(d.id);
  // "Watch" opens the episode the title's Play would (resume, else the next): the release has to hold its season.
  const lookup = useTorrentLookup(d, source, true, mode, d.kind === "tv" ? startEpisode(d, state?.progress).season : null);
  const text = useReleaseText();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<RankedRelease | null>(null);
  // Explicit choices; null follows the recommendation (the picture follows the mode).
  const [voiceKey, setVoiceKey] = useState<string | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  useEffect(() => setMode(prefs.quality), [prefs.quality]);
  const ranked = lookup.data?.ranked;
  // Releases of other seasons only aren't offered as an audio or a picture to pick.
  const options = useMemo(() => voiceOptions((ranked ?? []).filter((x) => x.holds !== false)), [ranked]);

  // "Save as default": this viewing's quality mode becomes the profile's (Settings → Profile), with Undo.
  const profile = me?.activeProfile;
  const saveMode = useAction({
    run: async (m: ReleaseQuality) => {
      await api(`/api/profiles/${profile!.id}`, { method: "PATCH", json: { releaseQuality: m } });
      router.refresh();
    },
    success: () => tp("qualitySaved"),
    undo: async () => {
      await api(`/api/profiles/${profile!.id}`, { method: "PATCH", json: { releaseQuality: prefs.quality } });
      router.refresh();
    },
  });

  // Nothing is searched for a title that is not out yet, so nothing is said either.
  if (!source || !isOut(d)) return null;

  const playHref = watchHref(d, state?.progress);
  const join = playHref.includes("?") ? "&" : "?";

  const play = async (x: RankedRelease, voice: string | null) => {
    setAdding(true);
    setError(null);
    try {
      const added = await addTorrentSource(source.id, d, null, x.result);
      if (!added) throw new Error(tpl("addFailed"));
      await qc.invalidateQueries({ queryKey: ["availability", d.id] });
      // The chosen dubbing goes along, so the player starts that studio's track once the file is read;
      // "added" lets the watch page show this add as the first of its stages.
      router.push(`${playHref}${join}source=${source.id}:${encodeURIComponent(added.hash)}&added=1${voice ? `&voice=${encodeURIComponent(voice)}` : ""}`);
    } catch (e) {
      setError(mediaError(e));
      setAdding(false);
    }
  };

  const best = ranked ? bestOf(ranked) : undefined;
  const option = options.find((o) => o.key === voiceKey) ?? options[0];
  const version = option && (picture ? option.versions.find((v) => v.key === picture) : option.versions.find((v) => v.key === option.best.picture));
  // An explicit picture this audio doesn't come in: said so, never swapped silently for another.
  const missing = Boolean(option && picture && !version);
  const chosen = option ? version?.best : best;
  const explicit = voiceKey !== null || picture !== null;
  const prefsNow = { ...prefs, quality: mode };
  const among = option ? (ranked ?? []).filter((x) => option.versions.some((v) => v.best === x) || x === chosen) : [];
  // The mode's reasons explain its own pick; a version the person picked needs none.
  const reasons = chosen && option && picture === null ? pictureReasons(chosen, among, prefsNow) : [];
  const versionCount = options.reduce((n, o) => Math.max(n, o.versions.length), 0);
  const languages = prefs.languages.map(text.language).join(", ");
  const pickHref = sourcesHref(playHref, `${option ? `&voice=${encodeURIComponent(option.key)}` : ""}${version ? `&picture=${version.key}` : ""}${mode !== prefs.quality ? `&quality=${mode}` : ""}`);
  const shownVersions = option?.versions.slice(0, 5) ?? [];
  const heading = lookup.isLoading
    ? t("tsSearching", { name: source.name })
    : lookup.isError
      ? t("tsFailed", { name: source.name })
      : best?.language
        ? t("tsFound")
        : best
          ? t("tsFoundOther", { languages })
          : t("tsNone");

  return (
    <SourceSection
      id="torrserver-h"
      title={tp("viaTorrServer", { name: source.name })}
      footer={
        lookup.data && (
          <ActionLink variant="action" arrow href={pickHref} className="self-start">
            {lookup.data.ranked.length > 0 ? tp("allReleases", { count: lookup.data.ranked.length }) : t("tsSearchManually")}
          </ActionLink>
        )
      }
    >
      {/* No "i" by the heading (2026-11-06): what the search does stays for a screen reader. */}
      <p className="sr-only">{`${t("tsAddsNote", { name: source.name })} ${prefs.languagesFromProfile ? t("tsNote") : t("tsNoteLocale")}`}</p>
      {/* The search's state while it runs or finds nothing; with a release shown the row says it (2026-11-06). */}
      <p className={chosen ? "sr-only" : "text-body-s text-text-2"} aria-live="polite">
        {heading}
        {lookup.data?.emptyAt ? ` ${t("tsKept", { minutes: Math.max(0, Math.round((Date.now() - lookup.data.at) / 60_000)) })}` : ""}
      </p>
      {lookup.isLoading && <Skeleton className="h-20 w-full" />}
      {lookup.isError && (
        <InlineAlert
          tone="danger"
          action={
            <Button variant="tertiary" size="sm" loading={lookup.isFetching} onClick={() => void lookup.refetch()}>
              {tc("retry")}
            </Button>
          }
        >
          {mediaError(lookup.error)}
        </InlineAlert>
      )}
      {chosen && (
        <SourceRow
          selected
          icon={<Magnet />}
          badges={
            <>
              <AccentBadge>{explicit ? t("tsChosen") : t("tsRecommended")}</AccentBadge>
              <AudioMatchBadge x={chosen} />
            </>
          }
          title={text.audio(chosen, option?.studio) || text.option({ studio: null, voice: null, language: null })}
          meta={
            <>
              {/* The picture and sound as marks (4K, Dolby Vision, Dolby Atmos — QualityBadges), then the source, size, seeders, tracker. */}
              <QualityBadges className="me-2" marks={qualityMarks({ resolution: chosen.info.resolution, hdrFormats: chosen.info.hdrFormats, atmos: chosen.info.atmos })} />
              {[text.besideMarks(chosen.info), formatSize(chosen.result.size, locale), chosen.result.seeders !== null ? t("tsSeeders", { count: chosen.result.seeders }) : null, chosen.result.tracker]
                .filter(Boolean)
                .join(" · ")}
              {/* Why this picture was picked: for a screen reader only (no explanations on screen, 2026-11-06). */}
              {reasons.length > 0 && <span className="sr-only">{reasons.map((r) => t(`tsWhy_${r}`)).join(" ")}</span>}
              {chosen.fit !== "ok" && (
                <span className="mt-0.5 flex items-center gap-1 text-text-1">
                  <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning" />
                  {chosen.fit === "poor" ? t(chosen.info.codec === "hevc" ? "tsFitHevc" : "tsFitDv") : t("tsFitUnknown")}
                </span>
              )}
            </>
          }
          action={
            <Button variant="secondary" loading={adding} onClick={() => void play(chosen, option?.studio ? option.key : null)}>
              <Play aria-hidden className="fill-current" />
              {t("tsWatch")}
            </Button>
          }
          more={
            <Menu trigger={<IconButton icon={Ellipsis} variant="secondary" label={tp("releaseMore")} />} label={tp("releaseMore")}>
              <MenuItem icon={Info} onSelect={() => setDetails(chosen)}>
                {tp("releaseDetails")}
              </MenuItem>
            </Menu>
          }
        />
      )}
      {error && (
        <InlineAlert tone="danger" title={tp("releaseAddFailedTitle")}>
          {error}
        </InlineAlert>
      )}
      {missing && option && (
        <InlineAlert tone="warning">
          {t("tsNoVersion", { voice: text.option(option), picture: picture ? text.version(Number(picture.split("-")[0]) as ReleaseInfo["resolution"], (picture.split("-")[1] as Range | undefined) ?? null) : "" })}
        </InlineAlert>
      )}
      {options.length > 1 && (
        <fieldset className="mt-1">
          <legend className="mb-2 text-body-s font-semibold text-text-2">{tp("voiceChoice")}</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => {
              const lang = o.language ? (o.language !== prefs.languages[0] ? text.language(o.language) : null) : o.best.info.languages.map(text.language).join("/") || null;
              return (
                <FilterChip key={o.key} disabled={adding} selected={o === option} onClick={() => setVoiceKey(o.key)}>
                  {text.option(o)}
                  {lang && <span className="ms-1 font-medium text-text-2 group-aria-pressed:text-inherit">{lang}</span>}
                </FilterChip>
              );
            })}
          </div>
          {/* The scope of the choice, said where it is made (SRC-09): this viewing; the default studios are the profile's. */}
          {voiceKey !== null && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-body-s text-text-2">
              {tp("voiceOnce")}
              <ActionLink variant="action" arrow href="/settings/profile">
                {tp("voiceDefaults")}
              </ActionLink>
            </p>
          )}
        </fieldset>
      )}
      {option && option.versions.length > 1 && (
        <fieldset className="mt-1">
          <legend className="mb-2 text-body-s font-semibold text-text-2">{t("tsVersions", { voice: text.option(option) })}</legend>
          <div className="flex flex-wrap items-center gap-2">
            {shownVersions.map((v) => (
              <FilterChip key={v.key} disabled={adding} selected={v === version} count={v.count > 1 ? v.count : undefined} onClick={() => setPicture(v.key)}>
                {text.version(v.resolution, v.range)}
              </FilterChip>
            ))}
            {option.versions.length > shownVersions.length && (
              <ActionLink variant="action" arrow href={pickHref}>
                {t("tsMoreVersions", { count: option.versions.length - shownVersions.length })}
              </ActionLink>
            )}
          </div>
        </fieldset>
      )}
      {versionCount > 1 && (
        <fieldset className="mt-1">
          <legend className="mb-2 text-body-s font-semibold text-text-2">{t("tsQuality")}</legend>
          <SegmentedControl
            label={t("tsQuality")}
            value={mode}
            onValueChange={(m) => {
              setMode(m);
              setPicture(null);
            }}
            options={QUALITY_MODES.map((m) => ({ value: m, label: t(`tsQuality_${m}`) }))}
          />
          {/* The scope of the choice, said where it is made (SRC-09): this viewing, or the profile's default. */}
          {/* Said only when it differs from the profile's default (no explanation otherwise, 2026-11-06). */}
          {mode !== prefs.quality && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-body-s text-text-2">
              {t("tsQualityOnce")}
              {profile && (
                <Button variant="tertiary" size="sm" loading={saveMode.pending} onClick={() => void saveMode.run(mode)}>
                  {tp("saveDefault")}
                </Button>
              )}
            </p>
          )}
        </fieldset>
      )}
      <ReleaseDetails release={details} onClose={() => setDetails(null)} />
    </SourceSection>
  );
}

/** A release's details (7.15): its full name, tracker, size, seeders, date — in a side panel, a sheet on a phone. */
function ReleaseDetails({ release: x, onClose }: { release: RankedRelease | null; onClose: () => void }) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const locale = useLocale();
  const text = useReleaseText();
  const rows: [string, string | null][] = x
    ? [
        [tp("detailName"), x.result.title],
        [tp("detailAudio"), text.audio(x) || null],
        [tp("detailPicture"), text.picture(x.info)],
        [tp("detailSize"), formatSize(x.result.size, locale)],
        [tp("detailSeeders"), x.result.seeders !== null ? t("tsSeeders", { count: x.result.seeders }) : null],
        [tp("detailTracker"), x.result.tracker],
      ]
    : [];
  return (
    <SidePanel open={x !== null} onOpenChange={(o) => !o && onClose()} title={tp("releaseDetails")}>
      <dl className="flex flex-col gap-4">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-body-s text-text-2">{k}</dt>
              <dd className="mt-0.5 text-body break-words text-text-1">{v}</dd>
            </div>
          ))}
      </dl>
    </SidePanel>
  );
}
