"use client";

import type { IntegrationAccount, IntegrationBackfill, IntegrationKind, IntegrationProvider, IntegrationsOverview } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Ellipsis, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { type Status, StatusBadge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Link } from "@/components/ui/Link";
import { lazyControl, OPEN_KEYS, useLazySwap } from "@/components/ui/lazy-swap";
import { QueryState } from "@/components/ui/QueryState";
import { Select } from "@/components/ui/Select";
import { SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toast";
import { Link as IntlLink, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";
import { relativeTime } from "@/lib/format";
import { useAction, useSettingsSave } from "@/lib/use-action";
import type { ServiceMenuProps } from "./ServiceMenu";

const serviceMenu = lazyControl(() => import("./ServiceMenu"));

const LABEL: Record<IntegrationProvider, string> = { trakt: "Trakt", simkl: "Simkl" };
const KINDS: IntegrationKind[] = ["history", "ratings", "watchlist"];
const ERRORS = ["expired", "denied", "session", "issuer", "exchange", "failed"] as const;
// The account's state as a dot and a word (7.4): Connected · Connecting · Sign-in needed · Error.
const STATUS: Record<IntegrationAccount["status"], Status> = { ok: "success", connecting: "neutral", reauth: "warning", error: "danger" };

/**
 * What a failed sync left in `statusDetail` (diagnostics, English) in the person's words (SET-11): which step failed,
 * never the text itself.
 */
function failureKey(detail: string | null): "failFirst" | "failImport" | "failSync" {
  if (detail?.startsWith("first import failed")) return "failFirst";
  if (detail?.includes("import failed")) return "failImport";
  return "failSync";
}

/**
 * Settings → Trakt & Simkl (S21): link a service to one profile, choose what flows each way, see the last sync and
 * what needs a choice. Reading starts on; writing to the service is the person's choice. Switches apply at once with
 * "Saved" (8.8); what can't be done now is said, not just greyed out (SET-09).
 */
export function TrackingServices() {
  const t = useTranslations("services");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const params = useSearchParams();
  const router = useRouter();
  const q = useQuery({ queryKey: ["integrations"], queryFn: () => api<IntegrationsOverview>("/api/integrations") });

  // Back from the service's consent page.
  useEffect(() => {
    const provider = params.get("provider") ?? params.get("connected");
    const service = provider === "trakt" || provider === "simkl" ? LABEL[provider] : "";
    const error = params.get("error");
    if (params.get("connected")) toast.success(t("connected", { service }));
    else if (error) toast.error(t(`error_${(ERRORS as readonly string[]).includes(error) ? error : "failed"}` as "error_failed", { service }));
    if (params.get("connected") || error) router.replace("/settings/services");
  }, [params, router, t]);

  // A failed load is an error with Retry, not an endless skeleton (X-14).
  return (
    <div className="space-y-6">
      <p className="sr-only">{t("intro")}</p>
      <QueryState
        query={q}
        loading={
          <div className="space-y-6">
            <Skeleton shape="md" className="h-48 w-full" />
            <Skeleton shape="md" className="h-48 w-full" />
          </div>
        }
        error={{ title: t("loadError") }}
      >
        {(d) => (
          <div className="space-y-6">
            {(["trakt", "simkl"] as const).map((p) => (
              <ServiceSection key={p} provider={p} available={d.available[p]} accounts={d.accounts.filter((a) => a.provider === p)} />
            ))}
          </div>
        )}
      </QueryState>
      {/* Files from other services: the import is a page of its own, not a section of the settings (SET-03). */}
      <SettingsSection title={tn("import")}>
        <SettingsRow label={t("importFiles")} description={t("importFilesHint")}>
          <IntlLink href="/import" className={buttonClass("secondary")}>
            {tc("open")}
          </IntlLink>
        </SettingsRow>
      </SettingsSection>
      <p className="max-w-measure text-body-s text-text-2">{t("privacy")}</p>
      <p className="max-w-measure text-body-s text-text-2">{t("traktCredit")}</p>
    </div>
  );
}

function ServiceSection({ provider, available, accounts }: { provider: IntegrationProvider; available: boolean; accounts: IntegrationAccount[] }) {
  const t = useTranslations("services");
  const tr = useTranslations();
  const locale = useLocale();
  const { me } = useSession();
  const ids = useId();
  const service = LABEL[provider];
  const free = (me?.profiles ?? []).filter((p) => !p.isKids && !accounts.some((a) => a.profileId === p.id));
  const [profileId, setProfileId] = useState("");
  const [busy, setBusy] = useState(false);
  const { state, save } = useSettingsSave();
  const target = free.some((p) => p.id === profileId) ? profileId : (free.find((p) => p.id === me?.activeProfile?.id)?.id ?? free[0]?.id ?? "");

  const connect = async (forProfile: string) => {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>(`/api/integrations/${provider}/connect`, { method: "POST", json: { profileId: forProfile, locale } });
      window.location.assign(url);
    } catch (e) {
      toast.error(tr(apiErrorKey(e)));
      setBusy(false);
    }
  };

  return (
    <SettingsSection title={service} description={t(provider)} save={state}>
      {!available ? (
        <p className="py-4 text-body-s text-text-2">{t("notConfigured", { service })}</p>
      ) : (
        <>
          {accounts.map((a) => (
            <AccountBlock key={a.id} account={a} save={save} onSignInAgain={() => connect(a.profileId)} signingIn={busy} />
          ))}
          {free.length > 0 ? (
            <SettingsRow label={t("connectTo", { service })} description={t("connectHint", { service })} htmlFor={`${ids}-profile`}>
              <Select id={`${ids}-profile`} className="w-full sm:w-48" value={target} onValueChange={setProfileId} options={free.map((p) => ({ value: p.id, label: p.name }))} />
              <Button loading={busy} disabled={!target} onClick={() => void connect(target)}>
                {t("connect", { service })}
              </Button>
            </SettingsRow>
          ) : (
            accounts.length > 0 && <p className="py-4 text-body-s text-text-2">{t("allLinked", { service })}</p>
          )}
        </>
      )}
    </SettingsSection>
  );
}

type Save = (request: () => Promise<unknown>, optimistic?: () => (() => void) | undefined) => Promise<boolean>;

function AccountBlock({
  account: a,
  save,
  onSignInAgain,
  signingIn,
}: {
  account: IntegrationAccount;
  save: Save;
  onSignInAgain: () => void;
  signingIn: boolean;
}) {
  const t = useTranslations("services");
  const tc = useTranslations("common");
  const locale = useLocale();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const service = LABEL[a.provider];
  const [sending, setSending] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["integrations"] });
  const stuck = a.status === "connecting" || a.status === "reauth";

  // A switch moves at once; the overview follows; a refusal puts it back in the section (8.8).
  const patch = (json: { import?: Partial<Record<IntegrationKind, boolean>>; export?: Partial<Record<IntegrationKind, boolean>>; scrobble?: boolean }) =>
    void save(
      async () => {
        await api(`/api/integrations/${a.id}`, { method: "PATCH", json });
        refresh();
      },
      () => {
        const before = qc.getQueryData<IntegrationsOverview>(["integrations"]);
        qc.setQueryData<IntegrationsOverview>(["integrations"], (d) =>
          d && {
            ...d,
            accounts: d.accounts.map((x) =>
              x.id !== a.id
                ? x
                : {
                    ...x,
                    settings: {
                      ...x.settings,
                      import: { ...x.settings.import, ...json.import },
                      export: {
                        ...x.settings.export,
                        ...Object.fromEntries(Object.entries(json.export ?? {}).map(([k, v]) => [k, v ? (x.settings.export[k as IntegrationKind] ?? new Date().toISOString()) : null])),
                      },
                      scrobble: json.scrobble ?? x.settings.scrobble,
                    },
                  },
            ),
          },
        );
        return () => qc.setQueryData(["integrations"], before);
      },
    );
  const sync = useAction({
    run: () => api(`/api/integrations/${a.id}/sync`, { method: "POST" }),
    success: t("syncQueued"),
    sync: refresh,
  });
  // Starting without the first import, importing everything again and disconnecting are asked first (X-12).
  const skipFirst = async () => {
    if (await confirm({ title: t("skipConfirm", { service }), confirmLabel: t("skipFirst"), tone: "primary", action: () => api(`/api/integrations/${a.id}/skip-initial`, { method: "POST" }) }))
      refresh();
  };
  const reimport = async () => {
    if (
      await confirm({
        title: t("reimportTitle", { service }),
        text: t("reimportHint", { service }),
        confirmLabel: t("reimport"),
        tone: "primary",
        action: () => api(`/api/integrations/${a.id}/reimport`, { method: "POST" }),
      })
    ) {
      toast.success(t("reimportQueued"));
      refresh();
    }
  };
  const disconnect = async () => {
    if (
      await confirm({
        title: t("disconnectTitle", { service }),
        text: t("disconnectConfirm", { service }),
        confirmLabel: t("disconnect"),
        action: () => api(`/api/integrations/${a.id}`, { method: "DELETE" }),
      })
    )
      refresh();
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-title text-text-1">
          {/* An icon, not "→": it points the reading way in right-to-left languages too (8.11, X-26). */}
          {a.externalUser ?? service}{" "}
          <span className="inline-flex items-center gap-1 font-normal text-text-2">
            <ArrowRight aria-hidden className="size-4" />
            {a.profileName}
          </span>
        </p>
        <StatusBadge status={STATUS[a.status] ?? "neutral"}>{t(`status_${a.status}`)}</StatusBadge>
        <span className="text-body-s text-text-2 sm:ms-auto">
          {a.lastSyncAt ? t("lastSync", { time: relativeTime(a.lastSyncAt, locale, tc("justNow")) }) : t("never")}
        </span>
      </div>

      {a.status === "reauth" && (
        <InlineAlert
          tone="warning"
          title={t("reauthTitle", { service })}
          action={
            <Button variant="tertiary" size="sm" loading={signingIn} onClick={onSignInAgain}>
              {t("signInAgain", { service })}
            </Button>
          }
        >
          {t("reauthText")}
        </InlineAlert>
      )}
      {a.status === "error" && (
        <InlineAlert
          tone="danger"
          title={t("errorTitle")}
          action={
            <Button variant="tertiary" size="sm" loading={sync.pending} onClick={() => void sync.run()}>
              {tc("retry")}
            </Button>
          }
        >
          {t(failureKey(a.statusDetail))}
        </InlineAlert>
      )}
      {a.status === "connecting" && (
        <div className="flex flex-wrap items-center gap-2">
          {a.initialJobId ? (
            <IntlLink href={`/import?job=${a.initialJobId}`} className={buttonClass("primary")}>
              {t("reviewFirst")}
            </IntlLink>
          ) : (
            <p className="text-body-s text-text-2">{t("preparing", { service })}</p>
          )}
          <Button variant="tertiary" onClick={() => void skipFirst()}>
            {t("skipFirst")}
          </Button>
        </div>
      )}
      {a.reviewJobIds.length > 0 && (
        <p>
          <Link variant="action" arrow href={`/import?job=${a.reviewJobIds[0]}`}>
            {t("needsChoice", { count: a.reviewJobIds.length })}
          </Link>
        </p>
      )}
      {(a.notes.skipped > 0 || a.notes.notFound > 0) && (
        <ul className="flex flex-col gap-1 text-body-s text-text-2">
          {a.notes.skipped > 0 && <li>{t("notesSkipped", { count: a.notes.skipped })}</li>}
          {a.notes.notFound > 0 && <li>{t("notesNotFound", { count: a.notes.notFound, service })}</li>}
        </ul>
      )}

      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
        <fieldset className="min-w-0">
          <legend className="mb-1 text-body-s font-semibold text-text-2">{t("readTitle", { service })}</legend>
          {KINDS.map((k) => (
            <Switch key={k} checked={a.settings.import[k]} disabled={a.status === "reauth"} onCheckedChange={(v) => patch({ import: { [k]: v } })} label={t(k)} />
          ))}
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-1 text-body-s font-semibold text-text-2">{t("writeTitle", { service })}</legend>
          {KINDS.map((k) => (
            <Switch
              key={k}
              checked={a.settings.export[k] !== null}
              disabled={!a.canWrite || a.status === "reauth"}
              onCheckedChange={(v) => patch({ export: { [k]: v } })}
              label={t(k)}
            />
          ))}
          <Switch
            checked={a.settings.scrobble}
            disabled={!a.canWrite || a.status === "reauth"}
            onCheckedChange={(v) => patch({ scrobble: v })}
            label={t("scrobble")}
            description={t("scrobbleHint", { service })}
          />
          <p className="mt-1 text-body-s text-text-2">{a.canWrite ? t("writeHint", { service }) : t("readOnlyGrant")}</p>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon={RefreshCw} loading={sync.pending} disabled={stuck} onClick={() => void sync.run()}>
          {t("syncNow")}
        </Button>
        {/* Why it's off, next to it (7.1). */}
        {stuck && <span className="text-body-s text-text-2">{a.status === "reauth" ? t("syncNeedsSignIn") : t("syncNeedsFirst")}</span>}
        <div className="ms-auto">
          <ServiceMore
            label={t("moreActions", { service })}
            items={{ reimport: t("reimport"), send: t("sendExisting"), disconnect: t("disconnect") }}
            canReimport={!stuck}
            canSend={a.canWrite && a.status !== "reauth"}
            onReimport={() => void reimport()}
            onSend={() => setSending(true)}
            onDisconnect={() => void disconnect()}
          />
        </div>
      </div>
      {sending && <SendExisting account={a} onClose={() => setSending(false)} />}
    </div>
  );
}

/** "Send existing": the counts first, then an explicit choice — never part of a regular sync. */
function SendExisting({ account: a, onClose }: { account: IntegrationAccount; onClose: () => void }) {
  const t = useTranslations("services");
  const tc = useTranslations("common");
  const service = LABEL[a.provider];
  const counts = useQuery({ queryKey: ["integration-backfill", a.id], queryFn: () => api<IntegrationBackfill>(`/api/integrations/${a.id}/backfill`) });
  const [kinds, setKinds] = useState<IntegrationKind[]>([]);
  const send = useAction({
    run: () => api(`/api/integrations/${a.id}/backfill`, { method: "POST", json: { kinds } }),
    success: t("sendQueued"),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t("sendTitle", { service })} description={t("sendHint", { service })}>
      <QueryState query={counts} loading={<Skeleton shape="md" className="h-24 w-full" />} error={{ title: t("countsLoadError") }}>
        {(d) => (
          <div className="flex flex-col gap-1">
            {KINDS.map((k) => (
              <Checkbox
                key={k}
                checked={kinds.includes(k)}
                disabled={d[k] === 0}
                onCheckedChange={(v) => setKinds(v ? [...kinds, k] : kinds.filter((x) => x !== k))}
                label={`${t(k)} · ${d[k]}`}
              />
            ))}
            <DialogActions>
              <Button variant="secondary" onClick={onClose}>
                {tc("cancel")}
              </Button>
              <Button
                loading={send.pending}
                disabled={kinds.length === 0}
                onClick={async () => {
                  if ((await send.run()).ok) onClose();
                }}
              >
                {t("send")}
              </Button>
            </DialogActions>
          </div>
        )}
      </QueryState>
    </Dialog>
  );
}


/** "More" of an account: a light button until the pointer or the focus comes to it, then the menu (./ServiceMenu). */
function ServiceMore(props: ServiceMenuProps) {
  const light = useRef<HTMLButtonElement>(null);
  const { full: m, start, activate } = useLazySwap(serviceMenu, light);
  if (m) return <m.ServiceMenu {...props} initialOpen={start.open} focusTrigger={start.focus} />;
  return (
    <IconButton
      ref={light}
      icon={Ellipsis}
      label={props.label}
      aria-haspopup="menu"
      aria-expanded={false}
      onPointerEnter={() => activate(false)}
      onFocus={() => activate(false)}
      onPointerDown={(e) => {
        if (e.button === 0) activate(true);
      }}
      onKeyDown={(e) => {
        if (!OPEN_KEYS.includes(e.key)) return;
        e.preventDefault();
        activate(true);
      }}
    />
  );
}
