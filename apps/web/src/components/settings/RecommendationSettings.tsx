"use client";

import type { RecommendationDiscovery, RecommendationPrefs, TasteProfile, TasteSignal, TitleSummary } from "@lumovio/contracts";
import { type UseQueryResult, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useRecommendationFeedback } from "@/components/media/ForYouRow";
import { useGenreEntries } from "@/components/media/GenresDialog";
import { type GenreEntry, toggleGenre } from "@/components/media/genre-entries";
import { TitleGrid } from "@/components/media/Row";
import { StarterCard, useStarterTitles } from "@/components/media/StarterRow";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/Chip";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { QueryState } from "@/components/ui/QueryState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { untilComplete } from "@/lib/incomplete";
import { titleHref } from "@/lib/slug";
import { useSettingsSave } from "@/lib/use-action";

const TASTE = ["recommendations-taste"];
type TasteQuery = UseQueryResult<TasteProfile>;
/** Signals shown before "Show all". */
const FIRST = 12;

/** The profile's settings, changed in the taste query at once and sent; returns how to put them back. */
function usePrefs() {
  const qc = useQueryClient();
  const optimistic = (next: Partial<RecommendationPrefs>) => () => {
    const before = qc.getQueryData<TasteProfile>(TASTE);
    qc.setQueryData<TasteProfile>(TASTE, (d) => d && { ...d, prefs: { ...d.prefs, ...next } });
    return () => qc.setQueryData(TASTE, before);
  };
  const request = (next: Partial<RecommendationPrefs>) => async () => {
    await api("/api/recommendations/settings", { method: "PUT", json: next });
    void qc.invalidateQueries({ queryKey: ["recommendations"] });
  };
  return { optimistic, request };
}

/**
 * Settings → Recommendations (S15, design-system 7.18, 8.8): what recommendations are built on — each of the profile's
 * titles with its signals and influence, with "Don't use" for one of them; why you see them — the interests they add
 * up to, with "Don't show" for a person; genres you like and titles to like; what not to show — genres, people and
 * "Not interested" titles; how to pick — watch history on or off and the one "More proven · Balanced · More new" knob;
 * and starting over. Each change applies at once with "Saved" in its section; a refusal puts it back and stays there
 * with "Retry". A kids profile has the same page, with only the titles its age limit opens.
 */
export function RecommendationSettings() {
  const t = useTranslations("recs");
  const qc = useQueryClient();
  const confirm = useConfirm();
  const taste = useQuery({ queryKey: TASTE, queryFn: () => api<TasteProfile>("/api/recommendations/taste"), refetchInterval: untilComplete });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: TASTE });
    void qc.invalidateQueries({ queryKey: ["recommendations"] });
    void qc.invalidateQueries({ queryKey: ["recommendations-feedback"] });
  };
  // Starting over is asked first; the request runs in the dialog and a failure stays there (8.3).
  const reset = async () => {
    const ok = await confirm({
      title: t("resetConfirmTitle"),
      text: t("resetText"),
      confirmLabel: t("reset"),
      action: () => api("/api/recommendations/learned", { method: "DELETE" }),
    });
    if (!ok) return;
    void qc.invalidateQueries({ queryKey: ["library-state"] });
    void qc.invalidateQueries({ queryKey: ["recommendations-start"] });
    refresh();
    toast.success(t("resetDone"));
  };

  return (
    <div className="space-y-6">
      <p className="max-w-measure text-body text-text-2">{t("intro")}</p>
      {/* One answer feeds every section: when it fails, the page says so once, with "Retry" (8.5), not five times. */}
      {taste.isError && !taste.data ? (
        <QueryState query={taste} error={{ title: t("loadError") }}>
          {() => null}
        </QueryState>
      ) : (
        <>
          <SignalsSection taste={taste} onChange={refresh} />
          <InterestsSection taste={taste} />
          <LikeSection taste={taste} onChange={refresh} />
          <MutedSection taste={taste} onChange={refresh} />
          <HowSection taste={taste} />
          <OpenedSection taste={taste} onChange={refresh} />
        </>
      )}
      <SettingsSection title={t("resetTitle")}>
        <SettingsRow label={t("reset")} description={t("resetText")}>
          <Button variant="danger-tertiary" onClick={() => void reset()}>
            {t("reset")}
          </Button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

function useSignalWords() {
  const t = useTranslations("recs");
  return (s: TasteSignal) =>
    s.signals
      .filter((k, i, all) => all.indexOf(k) === i)
      .map((k) => {
        if (k === "rating") return t("sigRating", { rating: s.rating ?? 0 });
        if (k === "hide") return s.hideReason === "seen" ? t("sigHideSeen") : s.hideReason === "genre" ? t("sigHideGenre") : s.hideReason === "title" ? t("sigHideTitle") : t("sigHide");
        return t(`sig_${k}`);
      })
      .join(" · ");
}

function influence(t: ReturnType<typeof useTranslations<"recs">>, s: TasteSignal): string {
  if (s.ignored) return t("ignored");
  if (s.weight >= 2) return t("influenceStrong");
  if (s.weight >= 0.9) return t("influence");
  if (s.weight > 0) return t("influenceWeak");
  if (s.weight < 0) return t("influenceAgainst");
  return t("influenceNone");
}

function SignalsSection({ taste, onChange }: { taste: TasteQuery; onChange: () => void }) {
  const t = useTranslations("recs");
  const qc = useQueryClient();
  const words = useSignalWords();
  const feedback = useRecommendationFeedback();
  const { state, save } = useSettingsSave();
  const [all, setAll] = useState(false);
  // One title's influence taken away ("Don't use") or given back; a starter like is removed instead.
  const change = (s: TasteSignal, kind: "like" | "ignore", on: boolean) =>
    void save(
      async () => {
        await feedback(s.title.id, kind, on);
        onChange();
      },
      () => {
        const before = qc.getQueryData<TasteProfile>(TASTE);
        qc.setQueryData<TasteProfile>(TASTE, (d) =>
          d && {
            ...d,
            signals:
              kind === "like" ? d.signals.filter((x) => x.title.id !== s.title.id) : d.signals.map((x) => (x.title.id === s.title.id ? { ...x, ignored: on } : x)),
          },
        );
        return () => qc.setQueryData(TASTE, before);
      },
    );
  return (
    <SettingsSection title={t("signalsTitle")} description={t("signalsText")} save={state}>
      <QueryState
        query={taste}
        loading={
          <div className="space-y-3 py-4">
            <Skeleton shape="xs" className="h-5 w-56" />
            <Skeleton shape="xs" className="h-5 w-40" />
            <Skeleton shape="xs" className="h-5 w-48" />
          </div>
        }
        isEmpty={(d) => d.signals.every((s) => s.signals.every((k) => k === "hide" || k === "opened"))}
        empty={<p className="py-4 text-body-s text-text-2">{t("signalsEmpty")}</p>}
        error={{ title: t("loadError") }}
      >
        {(d) => {
          // "Not interested" titles are under "Don't show", titles only opened under "Opened pages".
          const list = d.signals.filter((s) => !s.signals.every((k) => k === "hide" || k === "opened"));
          const shown = all ? list : list.slice(0, FIRST);
          return (
            <>
              <ul className="divide-y divide-line">
                {shown.map((s) => {
                  const likeOnly = s.signals.length === 1 && s.signals[0] === "like";
                  return (
                    <li key={s.title.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2">
                      {/* The row's text is the title's link: a target as tall as the row (5.6). */}
                      <Link href={titleHref(s.title.kind, s.title.tmdbId, s.title.title)} className="group/l block min-w-0 flex-1 basis-56 rounded-sm py-1">
                        <span className="block text-title text-text-1 group-hover/l:underline">{s.title.title}</span>
                        <span className="block text-body-s text-text-2">
                          {words(s)} · {influence(t, s)}
                        </span>
                      </Link>
                      {likeOnly ? (
                        <IconButton icon={X} label={t("unlike", { title: s.title.title })} onClick={() => change(s, "like", false)} />
                      ) : (
                        <Button size="sm" variant="tertiary" aria-label={s.ignored ? t("unignoreLabel", { title: s.title.title }) : t("ignoreLabel", { title: s.title.title })} onClick={() => change(s, "ignore", !s.ignored)}>
                          {s.ignored ? t("unignore") : t("ignore")}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {list.length > FIRST && (
                <div className="pt-2">
                  <Button variant="tertiary" size="sm" onClick={() => setAll((x) => !x)}>
                    {all ? t("signalsFewer") : t("signalsAll", { count: list.length })}
                  </Button>
                </div>
              )}
            </>
          );
        }}
      </QueryState>
    </SettingsSection>
  );
}

function InterestsSection({ taste }: { taste: TasteQuery }) {
  const t = useTranslations("recs");
  const locale = useLocale();
  const genres = useGenreEntries();
  const { optimistic, request } = usePrefs();
  const { state, save } = useSettingsSave();
  const languages = new Intl.DisplayNames([locale], { type: "language" });
  const mute = (p: { id: number; name: string }, prefs: RecommendationPrefs) => {
    const mutedPeople = [...prefs.mutedPeople.filter((x) => x.id !== p.id), { id: p.id, name: p.name }];
    void save(request({ mutedPeople }), optimistic({ mutedPeople }));
  };
  return (
    <SettingsSection title={t("interestsTitle")} description={t("interestsText")} save={state}>
      <QueryState
        query={taste}
        loading={<Skeleton shape="md" className="my-4 h-20 w-full" />}
        isEmpty={(d) => d.interests.genres.length === 0 && d.interests.people.length === 0}
        empty={<p className="py-4 text-body-s text-text-2">{t("interestsEmpty")}</p>}
        error={{ title: t("loadError") }}
      >
        {(d) => {
          const i = d.interests;
          const genreName = (id: number) => genres.data?.find((g) => g.ids.includes(id))?.name;
          const summary = [
            ...i.forms.slice(0, 2).map((f) => t(`form_${f.form}`)),
            ...i.kinds.slice(0, 1).map((k) => t(`kind_${k.kind}`)),
            ...i.decades.slice(0, 2).map((x) => t("decade", { decade: x.decade })),
            ...i.languages.slice(0, 2).map((l) => languages.of(l.language) ?? l.language),
          ];
          const muted = new Set(d.prefs.mutedPeople.map((p) => p.id));
          return (
            <div className="space-y-4 py-4">
              {i.genres.length > 0 && (
                <div>
                  <p className="mb-2 text-body-s font-semibold text-text-1">{t("interestsGenres")}</p>
                  <div className="flex flex-wrap gap-2">
                    {i.genres
                      .map((g) => genreName(g.id))
                      .filter((n, k, all): n is string => Boolean(n) && all.indexOf(n) === k)
                      .slice(0, 6)
                      .map((n) => (
                        <Tag key={n}>{n}</Tag>
                      ))}
                  </div>
                </div>
              )}
              {summary.length > 0 && (
                <p className="text-body-s text-text-2">
                  <span className="font-semibold text-text-1">{t("interestsMostly")}</span> {summary.join(" · ")}
                </p>
              )}
              {i.people.length > 0 && (
                <div>
                  <p className="mb-1 text-body-s font-semibold text-text-1">{t("interestsPeople")}</p>
                  <ul className="divide-y divide-line">
                    {i.people
                      .filter((p) => !muted.has(p.id))
                      .map((p) => (
                        <li key={p.id} className="flex min-h-12 items-center justify-between gap-3 py-1">
                          <span className="min-w-0 text-body text-text-1">
                            {p.name} <span className="text-body-s text-text-2">· {t(`role_${p.role}`)}</span>
                          </span>
                          <Button size="sm" variant="tertiary" aria-label={t("mutePersonLabel", { name: p.name })} onClick={() => mute(p, d.prefs)}>
                            {t("mutePerson")}
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          );
        }}
      </QueryState>
    </SettingsSection>
  );
}

function LikeSection({ taste, onChange }: { taste: TasteQuery; onChange: () => void }) {
  const t = useTranslations("recs");
  const starter = useStarterTitles();
  const genres = useGenreEntries();
  const qc = useQueryClient();
  const { optimistic, request } = usePrefs();
  const { state, save } = useSettingsSave();
  const toggle = (g: GenreEntry, all: GenreEntry[], prefs: RecommendationPrefs) => {
    const likedGenres = toggleGenre(new Set(prefs.likedGenres), g, all);
    void save(async () => {
      await request({ likedGenres })();
      void qc.invalidateQueries({ queryKey: ["recommendations-start"] });
    }, optimistic({ likedGenres }));
  };
  return (
    <SettingsSection title={t("likeTitle")} description={t("likeText")} save={state}>
      <div className="space-y-4 py-4">
        <div>
          <p className="mb-2 text-body-s font-semibold text-text-1">{t("likedGenres")}</p>
          {/* The chips need the profile's genres first: toggling before they load would send a wrong list. */}
          <QueryState query={taste} loading={<Skeleton shape="md" className="h-16 w-full" />} error={{ title: t("loadError") }}>
            {(d) => (
              <QueryState query={genres} loading={<Skeleton shape="md" className="h-16 w-full" />} error={{ title: t("genresLoadError") }}>
                {(all) => (
                  <div className="flex flex-wrap gap-2">
                    {all.map((g) => (
                      <FilterChip key={g.id} selected={g.ids.some((id) => d.prefs.likedGenres.includes(id))} onClick={() => toggle(g, all, d.prefs)}>
                        {g.name}
                      </FilterChip>
                    ))}
                  </div>
                )}
              </QueryState>
            )}
          </QueryState>
        </div>
        <QueryState
          query={starter}
          loading={
            <TitleGrid>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} shape="sm" className="aspect-2/3 w-full" />
              ))}
            </TitleGrid>
          }
          isEmpty={(d) => d.length === 0}
          empty={<p className="text-body-s text-text-2">{t("likeEmpty")}</p>}
          error={{ title: t("loadError") }}
        >
          {(items) => (
            <TitleGrid>
              {items.map((title) => (
                <StarterCard key={title.id} title={title} onChange={onChange} />
              ))}
            </TitleGrid>
          )}
        </QueryState>
      </div>
    </SettingsSection>
  );
}

function MutedSection({ taste, onChange }: { taste: TasteQuery; onChange: () => void }) {
  const t = useTranslations("recs");
  const qc = useQueryClient();
  const genres = useGenreEntries();
  const feedback = useRecommendationFeedback();
  const { optimistic, request } = usePrefs();
  const { state, save } = useSettingsSave();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const marks = useQuery({
    queryKey: ["recommendations-feedback"],
    queryFn: () => api<{ liked: TitleSummary[]; hidden: TitleSummary[]; reasons?: Record<string, "seen" | "genre" | "title" | null> }>("/api/recommendations/feedback"),
    refetchInterval: untilComplete,
  });
  const toggleGenreMute = (g: GenreEntry, all: GenreEntry[], prefs: RecommendationPrefs) => {
    const mutedGenres = toggleGenre(new Set(prefs.mutedGenres), g, all);
    void save(request({ mutedGenres }), optimistic({ mutedGenres }));
  };
  const unmute = (id: number, prefs: RecommendationPrefs) => {
    const mutedPeople = prefs.mutedPeople.filter((p) => p.id !== id);
    void save(request({ mutedPeople }), optimistic({ mutedPeople }));
  };
  const unhide = (title: TitleSummary) =>
    void save(
      async () => {
        await feedback(title.id, "hide", false);
        onChange();
        void qc.invalidateQueries({ queryKey: ["library-state", title.id] });
      },
      () => {
        setGone((s) => new Set(s).add(title.id));
        return () =>
          setGone((s) => {
            const n = new Set(s);
            n.delete(title.id);
            return n;
          });
      },
    );
  const reasonOf = (r: "seen" | "genre" | "title" | null | undefined) =>
    r === "seen" ? t("hideReasonSeen") : r === "genre" ? t("hideReasonGenre") : r === "title" ? t("hideReasonTitle") : null;
  return (
    <SettingsSection title={t("mutedTitle")} description={t("mutedText")} save={state}>
      <div className="space-y-5 py-4">
        <div>
          <p className="mb-2 text-body-s font-semibold text-text-1">{t("mutedGenres")}</p>
          <QueryState query={taste} loading={<Skeleton shape="md" className="h-16 w-full" />} error={{ title: t("loadError") }}>
            {(d) => (
              <QueryState query={genres} loading={<Skeleton shape="md" className="h-16 w-full" />} error={{ title: t("genresLoadError") }}>
                {(all) => (
                  <div className="flex flex-wrap gap-2">
                    {all.map((g) => (
                      <FilterChip key={g.id} selected={g.ids.some((id) => d.prefs.mutedGenres.includes(id))} onClick={() => toggleGenreMute(g, all, d.prefs)}>
                        {g.name}
                      </FilterChip>
                    ))}
                  </div>
                )}
              </QueryState>
            )}
          </QueryState>
        </div>
        <div>
          <p className="mb-1 text-body-s font-semibold text-text-1">{t("mutedPeople")}</p>
          <QueryState
            query={taste}
            loading={<Skeleton shape="xs" className="h-5 w-48" />}
            isEmpty={(d) => d.prefs.mutedPeople.length === 0}
            empty={<p className="text-body-s text-text-2">{t("mutedPeopleEmpty")}</p>}
            error={{ title: t("loadError") }}
          >
            {(d) => (
              <ul className="divide-y divide-line">
                {d.prefs.mutedPeople.map((p) => (
                  <li key={p.id} className="flex min-h-12 items-center justify-between gap-3 py-1">
                    <span className="min-w-0 truncate text-body text-text-1">{p.name}</span>
                    <Button size="sm" variant="secondary" icon={Eye} aria-label={t("unmutePersonLabel", { name: p.name })} onClick={() => unmute(p.id, d.prefs)}>
                      {t("unmutePerson")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
        <div>
          <p className="mb-1 text-body-s font-semibold text-text-1">{t("hiddenTitle")}</p>
          <QueryState
            query={marks}
            loading={<Skeleton shape="md" className="h-16 w-full" />}
            isEmpty={(d) => d.hidden.every((x) => gone.has(x.id))}
            empty={<p className="text-body-s text-text-2">{t("hiddenEmpty")}</p>}
            error={{ title: t("loadError") }}
          >
            {(d) => (
              <ul className="divide-y divide-line">
                {d.hidden
                  .filter((x) => !gone.has(x.id))
                  .map((title) => (
                    <li key={title.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                      <Link href={titleHref(title.kind, title.tmdbId, title.title)} className="group/l block min-w-0 rounded-sm py-1">
                        <span className="block truncate text-title text-text-1 group-hover/l:underline">
                          {title.title}
                          {title.year ? <span className="ms-2 text-body-s font-normal text-text-2">{title.year}</span> : null}
                        </span>
                        {reasonOf(d.reasons?.[title.id]) && <span className="block text-body-s text-text-2">{reasonOf(d.reasons?.[title.id])}</span>}
                      </Link>
                      <Button size="sm" variant="secondary" icon={Eye} onClick={() => unhide(title)}>
                        {t("unhide")}
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
          </QueryState>
        </div>
      </div>
    </SettingsSection>
  );
}

function HowSection({ taste }: { taste: TasteQuery }) {
  const t = useTranslations("recs");
  const { optimistic, request } = usePrefs();
  const { state, save } = useSettingsSave();
  const set = (next: Partial<RecommendationPrefs>) => void save(request(next), optimistic(next));
  return (
    <SettingsSection title={t("howTitle")} save={state}>
      <QueryState query={taste} loading={<Skeleton shape="md" className="my-4 h-24 w-full" />} error={{ title: t("loadError") }}>
        {(d) => (
          <>
            <SettingsRow label={t("useHistory")} description={t("useHistoryText")}>
              <Switch checked={d.prefs.useHistory} onCheckedChange={(useHistory) => set({ useHistory })} label={t("useHistory")} hideLabel />
            </SettingsRow>
            <SettingsRow label={t("discovery")} description={t("discoveryText")}>
              <SegmentedControl<RecommendationDiscovery>
                label={t("discovery")}
                value={d.prefs.discovery}
                onValueChange={(discovery) => set({ discovery })}
                options={[
                  { value: "proven", label: t("discoveryProven") },
                  { value: "balanced", label: t("discoveryBalanced") },
                  { value: "new", label: t("discoveryNew") },
                ]}
              />
            </SettingsRow>
          </>
        )}
      </QueryState>
    </SettingsSection>
  );
}

/**
 * Opened pages (owner, 2026-10-25): title pages the profile stayed on count a little, fading within a couple of
 * months, kept 180 days. Switched off, they are neither recorded nor used; each can be forgotten, or all at once.
 */
function OpenedSection({ taste, onChange }: { taste: TasteQuery; onChange: () => void }) {
  const t = useTranslations("recs");
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { optimistic, request } = usePrefs();
  const { state, save } = useSettingsSave();
  const [all, setAll] = useState(false);
  const forget = (s: TasteSignal) =>
    void save(
      async () => {
        await api(`/api/recommendations/opened?titleId=${encodeURIComponent(s.title.id)}`, { method: "DELETE" });
        onChange();
      },
      () => {
        const before = qc.getQueryData<TasteProfile>(TASTE);
        qc.setQueryData<TasteProfile>(TASTE, (d) => d && { ...d, signals: d.signals.filter((x) => x.title.id !== s.title.id) });
        return () => qc.setQueryData(TASTE, before);
      },
    );
  // Removing them all is asked first; the request runs in the dialog (8.3).
  const clear = async () => {
    const ok = await confirm({
      title: t("openedClearTitle"),
      text: t("openedClearText"),
      confirmLabel: t("openedClear"),
      action: () => api("/api/recommendations/opened", { method: "DELETE" }),
    });
    if (!ok) return;
    onChange();
    toast.success(t("openedCleared"));
  };
  return (
    <SettingsSection title={t("openedTitle")} description={t("openedText")} save={state}>
      <QueryState query={taste} loading={<Skeleton shape="md" className="my-4 h-24 w-full" />} error={{ title: t("loadError") }}>
        {(d) => {
          const list = d.signals.filter((s) => s.signals.length === 1 && s.signals[0] === "opened");
          const shown = all ? list : list.slice(0, FIRST);
          return (
            <>
              <SettingsRow label={t("useOpens")} description={t("useOpensText")}>
                <Switch
                  checked={d.prefs.useOpens}
                  // Off, the recorded pages stop counting: the list is read again (they stay until deleted).
                  onCheckedChange={(useOpens) =>
                    void save(async () => {
                      await request({ useOpens })();
                      onChange();
                    }, optimistic({ useOpens }))
                  }
                  label={t("useOpens")}
                  hideLabel
                />
              </SettingsRow>
              {list.length === 0 ? (
                <p className="py-4 text-body-s text-text-2">{d.prefs.useOpens ? t("openedEmpty") : t("openedOff")}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {shown.map((s) => (
                    <li key={s.title.id} className="flex min-h-14 items-center gap-3 py-2">
                      <Link href={titleHref(s.title.kind, s.title.tmdbId, s.title.title)} className="group/l block min-w-0 flex-1 rounded-sm py-1">
                        <span className="block text-title text-text-1 group-hover/l:underline">{s.title.title}</span>
                        <span className="block text-body-s text-text-2">
                          {t("sig_opened")} · {influence(t, s)}
                        </span>
                      </Link>
                      <IconButton icon={X} label={t("openedForget", { title: s.title.title })} onClick={() => forget(s)} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {list.length > FIRST && (
                  <Button variant="tertiary" size="sm" onClick={() => setAll((x) => !x)}>
                    {all ? t("signalsFewer") : t("signalsAll", { count: list.length })}
                  </Button>
                )}
                <Button variant="danger-tertiary" size="sm" onClick={() => void clear()}>
                  {t("openedClear")}
                </Button>
              </div>
            </>
          );
        }}
      </QueryState>
    </SettingsSection>
  );
}
