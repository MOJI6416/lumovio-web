"use client";

import type { DeviceSession } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, Tv } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { authCall } from "@/components/auth/auth-call";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { QueryState } from "@/components/ui/QueryState";
import { EmptyState } from "@/components/ui/EmptyState";
import { SettingsLink, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { ApiRequestError, api } from "@/lib/api";
import { authErrorKey } from "@/lib/api-errors";
import { relativeTime } from "@/lib/format";
import { sessionsQuery } from "./queries";

/** The auth client (Better Auth) loads with the action that needs it, not in the page's first-load JS (bundle budget). */
const auth = () => import("@/lib/auth-client").then((m) => m.authClient);

/** Rows before "Show more": the newest sign-ins first. */
const FIRST = 6;

/**
 * Sign-ins from one browser ("Chrome · Windows"): repeated sign-ins with the same User-Agent become one row,
 * different User-Agents never share one, so "Remove device" on a row signs out only that browser.
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

const mark = (tv: boolean) => {
  const Icon = tv ? Tv : Laptop;
  return (
    <span className="grid size-10 place-items-center rounded-sm bg-surface-2 text-text-2">
      <Icon aria-hidden className="size-5" />
    </span>
  );
};

/**
 * Security → Where you're signed in: this device first, then the others, newest first, one row per
 * browser with the number of sign-ins. A row opens "Remove device «…»?" (not "Sign out" — that is leaving on this device);
 * "Remove all other devices" is a group of its own after the list — the risky one, its consequence said under it — and
 * asks first too. The list follows the answer.
 */
export function Sessions() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [all, setAll] = useState(false);
  const q = useQuery(sessionsQuery);
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
        const r = await authCall(async () => (await auth()).revokeOtherSessions());
        if (r.error) throw new Error(tr(authErrorKey(r.error)));
      },
      error: t("revokeOthersFailed"),
    });
    refresh();
    if (ok) toast.success(t("revokedOthers"));
  };

  return (
    <QueryState variant="inline"
      query={q}
      loading={
        <SettingsSection title={t("sessions")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton shape="sm" className="size-10" />
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
        const shown = all ? others : others.slice(0, FIRST);
        return (
          <div className="space-y-8">
            <SettingsSection
              title={t("sessions")}
              description={t("sessionsHint")}
              footer={
                others.length > FIRST ? (
                  <Button variant="tertiary" size="sm" onClick={() => setAll(!all)}>
                    {all ? tc("showLess") : t("showAllCount", { count: others.length })}
                  </Button>
                ) : undefined
              }
            >
              {current && (
                <div className="flex min-h-13 items-center gap-3 py-3">
                  {mark(current.device.client === "tv")}
                  <span className="min-w-0 flex-1">
                    <span className="block text-body text-text-1">{deviceName(current, t)}</span>
                    <span className="mt-0.5 block text-body-s text-text-2">{t("activeNow")}</span>
                  </span>
                  <Tag>{t("thisDevice")}</Tag>
                </div>
              )}
              {shown.map((g) => (
                <SettingsLink
                    key={g.key}
                    leading={mark(g.tv)}
                    label={g.label}
                    detail={[
                      t("lastActive", { time: relativeTime(g.lastSeenAt, locale, tr("common.justNow")) }),
                      g.sessions.length > 1 ? t("signIns", { count: g.sessions.length }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    opens
                    aria-label={t("revokeNamed", { device: g.label })}
                    onClick={() => void revoke(g)}
                  />
              ))}
              {count === 0 && <EmptyState variant="inline" title={t("noOtherDevices")} />}
            </SettingsSection>
            {/* The risky one, apart and last: its consequence is said and it asks first. */}
            {count > 0 && (
              <SettingsSection>
                <SettingsLink tone="danger" label={t("revokeOthers")} detail={t("revokeOthersHint")} onClick={() => void revokeOthers(count)} />
              </SettingsSection>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}
