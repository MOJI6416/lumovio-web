"use client";

import type { Profile } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";
import { authCall } from "@/components/auth/auth-call";
import { useSession } from "@/components/providers/Providers";
import { Button, buttonClass } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toast";
import { ApiRequestError, api } from "@/lib/api";
import { apiErrorKey, authErrorKey } from "@/lib/api-errors";
import { authClient } from "@/lib/auth-client";
import { useSettingsSave } from "@/lib/use-action";
import { type Prefs, usePrefs } from "./prefs";
import { useUnsavedChanges } from "./use-unsaved";

/**
 * Settings → Privacy and data (S23): what of the profile is public, what AI search may read, the export, and — last —
 * the danger zone (8.8): deleting the account, asked with a typed word (8.3).
 */
export function PrivacySettings() {
  const t = useTranslations("settings");
  const { me } = useSession();
  const p = me?.activeProfile;
  return (
    <div className="space-y-6">
      {p && !p.isKids && <PublicProfileSection profile={p} />}
      <AiSection />
      <SettingsSection title={t("exportSection")}>
        <SettingsRow label={t("exportLabel")} description={t("exportHint")}>
          <a href="/api/export" className={buttonClass("secondary")} download>
            <Download aria-hidden />
            {t("exportButton")}
          </a>
        </SettingsRow>
      </SettingsSection>
      <DangerZone />
    </div>
  );
}

type Public = { handle: string | null; isPublic: boolean; showFavorites: boolean; showRatings: boolean; showStats: boolean; bio: string | null };

const HANDLE = /^[a-z0-9_]{3,24}$/;

/**
 * The public page of the profile (audit SET-05): the name and "about" are a form with an explicit Save — what is
 * typed is kept as typed and checked on save, with the reason at the field; the address shown is the page's real one
 * (/u/…). The switches apply at once; showing favourites and ratings is off while the page itself is closed.
 */
function PublicProfileSection({ profile }: { profile: Profile }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const qc = useQueryClient();
  const ids = useId();
  const key = ["public-settings", profile.id];
  const q = useQuery({ queryKey: key, queryFn: () => api<Public>(`/api/profiles/${profile.id}/public`) });
  const [saved, setSaved] = useState<Public | null>(null);
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [errors, setErrors] = useState<{ handle?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const { state, save } = useSettingsSave();
  useEffect(() => {
    if (!q.data) return;
    setSaved(q.data);
    setHandle(q.data.handle ?? "");
    setBio(q.data.bio ?? "");
  }, [q.data]);
  const dirty = saved !== null && (handle.trim() !== (saved.handle ?? "") || bio.trim() !== (saved.bio ?? ""));
  useUnsavedChanges(dirty);

  if (!saved && q.isError) {
    return (
      <SettingsSection title={t("publicProfile")}>
        <ErrorState error={q.error} title={t("publicProfileLoadError")} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      </SettingsSection>
    );
  }
  if (!saved) return <Skeleton shape="md" className="h-64 w-full" />;

  const put = (next: Public) => api(`/api/profiles/${profile.id}/public`, { method: "PUT", json: next });
  const handleError = (e: unknown) =>
    e instanceof ApiRequestError && e.code === "conflict"
      ? t("handleTaken")
      : e instanceof ApiRequestError && e.code === "bad_request"
        ? t("handleFirst")
        : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const h = handle.trim();
    // Checked as typed, never rewritten silently: the reason is said at the field.
    if (h && !HANDLE.test(h)) return setErrors({ handle: t("handleInvalid") });
    if (!h && saved.isPublic) return setErrors({ handle: t("handleNeeded") });
    setErrors({});
    setBusy(true);
    const next = { ...saved, handle: h || null, bio: bio.trim() || null };
    try {
      await put(next);
      setSaved(next);
      qc.setQueryData(key, next);
      toast.success(tc("saved"));
    } catch (err) {
      const field = handleError(err);
      setErrors(field ? { handle: field } : { form: tr(apiErrorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  // A switch applies at once with "Saved" by the title; a refusal puts it back (8.8).
  const toggle = (patch: Partial<Public>) => {
    const before = saved;
    void save(
      () => put({ ...before, ...patch }),
      () => {
        setSaved({ ...before, ...patch });
        return () => setSaved(before);
      },
    );
  };
  const address = saved.handle ? `lumovio.app/u/${saved.handle}` : null;

  return (
    <SettingsSection title={t("publicProfile")} description={t("publicProfileHint")} save={state}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4 py-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("handle")} hint={t("handleHint")} error={errors.handle}>
            {(id, d, invalid) => (
              <Input id={id} aria-describedby={d} invalid={invalid} value={handle} maxLength={24} autoComplete="off" spellCheck={false} onChange={(e) => setHandle(e.target.value)} />
            )}
          </Field>
          <Field label={t("bio")} hint={t("bioHint")}>
            {(id, d) => <Input id={id} aria-describedby={d} value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} />}
          </Field>
        </div>
        {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
        <div className="flex flex-wrap items-center gap-3">
          {/* Off until something is changed (8.8). */}
          <Button type="submit" loading={busy} disabled={!dirty}>
            {tc("save")}
          </Button>
          {dirty && (
            <Button
              variant="tertiary"
              disabled={busy}
              onClick={() => {
                setHandle(saved.handle ?? "");
                setBio(saved.bio ?? "");
                setErrors({});
              }}
            >
              {tc("cancel")}
            </Button>
          )}
        </div>
      </form>
      <SettingsRow
        label={t("publicSwitch")}
        description={saved.isPublic && address ? t("publicOn", { address }) : saved.handle ? t("publicOff") : t("handleFirst")}
        htmlFor={`${ids}-public`}
      >
        <Switch id={`${ids}-public`} hideLabel label={t("publicSwitch")} checked={saved.isPublic} disabled={!saved.handle} onCheckedChange={(v) => toggle({ isPublic: v })} />
      </SettingsRow>
      {saved.isPublic && saved.handle && (
        <div className="py-4">
          <Link variant="action" arrow href={`/u/${saved.handle}`}>
            {t("openPublic")}
          </Link>
        </div>
      )}
      <SettingsRow label={t("showFavorites")} description={saved.isPublic ? undefined : t("needsPublic")} htmlFor={`${ids}-fav`}>
        <Switch id={`${ids}-fav`} hideLabel label={t("showFavorites")} checked={saved.showFavorites} disabled={!saved.isPublic} onCheckedChange={(v) => toggle({ showFavorites: v })} />
      </SettingsRow>
      <SettingsRow label={t("showRatings")} description={saved.isPublic ? undefined : t("needsPublic")} htmlFor={`${ids}-ratings`}>
        <Switch id={`${ids}-ratings`} hideLabel label={t("showRatings")} checked={saved.showRatings} disabled={!saved.isPublic} onCheckedChange={(v) => toggle({ showRatings: v })} />
      </SettingsRow>
    </SettingsSection>
  );
}

/** What AI search may read (SET-08): said in Russian and in the same words as the recommendations page. */
function AiSection() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const ids = useId();
  const { query, set, state } = usePrefs();
  return (
    <SettingsSection title={t("aiSection")} save={state}>
      <SettingsRow label={t("aiHistory")} description={t("aiHistoryHint")} htmlFor={`${ids}-ai`}>
        {query.data ? (
          <Switch id={`${ids}-ai`} hideLabel label={t("aiHistory")} checked={query.data.aiHistoryOptIn} onCheckedChange={(v) => set({ aiHistoryOptIn: v } satisfies Partial<Prefs>)} />
        ) : query.isError ? (
          <Button variant="tertiary" size="sm" loading={query.isFetching} onClick={() => void query.refetch()}>
            {tc("retry")}
          </Button>
        ) : (
          <Skeleton shape="full" className="h-6 w-11" />
        )}
      </SettingsRow>
    </SettingsSection>
  );
}

/** The last section (8.8): deleting the account, confirmed by typing a word; it goes after the link in the e-mail. */
function DangerZone() {
  const t = useTranslations("settings");
  const tr = useTranslations();
  const confirm = useConfirm();
  const remove = async () => {
    const ok = await confirm({
      title: t("deleteTitle"),
      text: t("deleteHint"),
      confirmLabel: t("deleteAccount"),
      confirmWord: t("deleteWord"),
      action: async () => {
        const r = await authCall(() => authClient.deleteUser({ callbackURL: "/?account=deleted" }));
        if (r.error) throw new Error(tr(authErrorKey(r.error)));
      },
      error: (e) => (e instanceof Error ? e.message : tr("errors.generic")),
    });
    if (ok) toast.success(t("deleteSent"));
  };
  return (
    <SettingsSection title={t("dangerZone")}>
      <SettingsRow label={t("deleteAccount")} description={t("deleteHint")}>
        <Button variant="danger-tertiary" icon={Trash2} onClick={() => void remove()}>
          {t("deleteAccount")}
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}
