"use client";

import type { DeviceSession } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Gamepad2, Laptop, LogOut, Tv } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { authCall } from "@/components/auth/auth-call";
import { Tag } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { QueryState } from "@/components/ui/QueryState";
import { SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { ApiRequestError, api } from "@/lib/api";
import { authErrorKey } from "@/lib/api-errors";
import { authClient } from "@/lib/auth-client";
import { relativeTime } from "@/lib/format";

/**
 * Sign-ins from one browser ("Chrome · Windows"): repeated sign-ins with the same User-Agent become one row (SET-06),
 * different User-Agents never share one, so "Remove device" on a row signs out only that browser (SET-14).
 */
interface Group {
  key: string;
  label: string;
  sessions: DeviceSession[];
  lastSeenAt: string;
  tv: boolean;
}

type Translate = ReturnType<typeof useTranslations<"settings">>;

/** The device in the interface language: browser and system by name, a TV, a script or headless browser, or unknown. */
function deviceName({ device: d }: DeviceSession, t: Translate): string {
  const parts = [d.browser, d.os].filter(Boolean).join(" · ");
  if (d.client === "automated") return t("deviceAutomated", { tool: d.browser ?? "" });
  if (d.client === "tv") return parts ? t("deviceTv", { device: parts }) : t("deviceTvOnly");
  return parts || t("deviceUnknown");
}

function groups(list: DeviceSession[], t: Translate): Group[] {
  const map = new Map<string, Group>();
  for (const s of list) {
    // Without a User-Agent nothing says two sign-ins are one device: each keeps its own row.
    const key = `${s.device.client}|${s.userAgent ?? s.id}`;
    const g = map.get(key) ?? { key, label: deviceName(s, t), sessions: [], lastSeenAt: s.lastSeenAt, tv: s.device.client === "tv" };
    g.sessions.push(s);
    if (s.lastSeenAt > g.lastSeenAt) g.lastSeenAt = s.lastSeenAt;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/**
 * Settings → Devices (S18, audit SET-06): this device first, then the others grouped by kind with the number of
 * sign-ins. "Remove device" (not "Sign out" — that is leaving on this device) and "Sign out on all other devices"
 * are asked first, naming what goes; the list follows the answer.
 */
export function DevicesSettings() {
  const t = useTranslations("settings");
  const tn = useTranslations("nav");
  const tr = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ["sessions"], queryFn: () => api<{ sessions: DeviceSession[] }>("/api/sessions") });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["sessions"] });

  const revoke = async (g: Group) => {
    const n = g.sessions.length;
    const ok = await confirm({
      title: t("revokeTitle", { device: g.label }),
      text: n > 1 ? t("revokeGroupText", { count: n }) : t("revokeText"),
      confirmLabel: t("revoke"),
      action: async () => {
        for (const s of g.sessions) {
          try {
            await api(`/api/sessions/${s.id}`, { method: "DELETE" });
          } catch (e) {
            // Already gone (signed out there meanwhile) is what was asked for.
            if (!(e instanceof ApiRequestError && e.status === 404)) throw e;
          }
        }
      },
      error: t("revokeFailed", { device: g.label }),
    });
    refresh();
    if (ok) toast.success(t("revoked", { device: g.label }));
  };

  const revokeOthers = async (count: number) => {
    const ok = await confirm({
      title: t("revokeOthersTitle"),
      text: t("revokeOthersText", { count }),
      confirmLabel: t("revokeOthers"),
      action: async () => {
        const r = await authCall(() => authClient.revokeOtherSessions());
        if (r.error) throw new Error(tr(authErrorKey(r.error)));
      },
      error: t("revokeOthersFailed"),
    });
    refresh();
    if (ok) toast.success(t("revokedOthers"));
  };

  return (
    <div className="space-y-6">
      <QueryState
        query={q}
        loading={
          <SettingsSection title={t("sessions")}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                <Skeleton shape="md" className="size-10" />
                <span className="flex-1 space-y-2">
                  <Skeleton shape="xs" className="h-4 w-40" />
                  <Skeleton shape="xs" className="h-3 w-24" />
                </span>
              </div>
            ))}
          </SettingsSection>
        }
        error={{ title: t("devicesLoadError") }}
      >
        {(d) => {
          const current = d.sessions.find((s) => s.current);
          const others = groups(d.sessions.filter((s) => !s.current), t);
          const count = d.sessions.length - (current ? 1 : 0);
          return (
            <SettingsSection
              title={t("sessions")}
              description={t("sessionsHint")}
              footer={
                count > 0 ? (
                  <Button variant="secondary" icon={LogOut} onClick={() => void revokeOthers(count)}>
                    {t("revokeOthers")}
                  </Button>
                ) : undefined
              }
            >
              {current && (
                <DeviceRow
                  label={deviceName(current, t)}
                  tv={current.device.client === "tv"}
                  meta={t("activeNow")}
                  tag={<Tag>{t("thisDevice")}</Tag>}
                />
              )}
              {others.map((g) => (
                <DeviceRow
                  key={g.key}
                  label={g.label}
                  tv={g.tv}
                  meta={[
                    t("lastActive", { time: relativeTime(g.lastSeenAt, locale, tr("common.justNow")) }),
                    g.sessions.length > 1 ? t("signIns", { count: g.sessions.length }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  <Button variant="tertiary" aria-label={t("revokeNamed", { device: g.label })} onClick={() => void revoke(g)}>
                    {t("revoke")}
                  </Button>
                </DeviceRow>
              ))}
              {count === 0 && <p className="py-4 text-body-s text-text-2">{t("noOtherDevices")}</p>}
            </SettingsSection>
          );
        }}
      </QueryState>
      <SettingsSection title={tn("linkDevice")}>
        <SettingsRow label={t("linkTvLabel")} description={t("linkTvHint")}>
          <Link href="/link" className={buttonClass("secondary")}>
            <Tv aria-hidden />
            {tn("linkDevice")}
          </Link>
        </SettingsRow>
        <SettingsRow label={t("remoteLabel")} description={t("remoteHint")}>
          <Link href="/remote" className={buttonClass("secondary")}>
            <Gamepad2 aria-hidden />
            {t("openRemote")}
          </Link>
        </SettingsRow>
        <SettingsRow label={t("tvAppLabel")} description={t("tvAppHint")}>
          <Link href="/android-tv" className={buttonClass("secondary")}>
            <Download aria-hidden />
            {t("tvAppOpen")}
          </Link>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

function DeviceRow({ label, tv, meta, tag, children }: { label: string; tv: boolean; meta: string; tag?: ReactNode; children?: ReactNode }) {
  const Icon = tv ? Tv : Laptop;
  return (
    // On a phone the button goes under the name instead of squeezing it.
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-surface-2 text-text-2">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-40 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-title text-text-1">
          {label} {tag}
        </p>
        <p className="text-body-s text-text-2">{meta}</p>
      </div>
      {children && <div className="ms-auto">{children}</div>}
    </div>
  );
}
