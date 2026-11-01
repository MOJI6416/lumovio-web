"use client";

import type { ConnectionSummary, LibraryIndexEntry, Me } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Status } from "@/components/ui/Badge";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { MediaNetError } from "@/lib/media/net";
import { randomId } from "@/lib/random-id";
import { failureDetail, netErrorText } from "./net-errors";

// The server's state as a dot and a word (7.4, 7.16): never only a colour.
export const STATUS: Record<string, Status> = {
  ok: "success",
  degraded: "warning",
  unreachable: "danger",
  unauthorized: "danger",
  unknown: "neutral",
};

/** One line of fact about the server (7.16): what's indexed and when it was scanned, or when it was last checked. */
export function useServerFact() {
  const t = useTranslations("connections");
  const tc = useTranslations("common");
  const locale = useLocale();
  return (c: ConnectionSummary, scanned: number | null): string | null => {
    if (scanned !== null) return t("syncing", { count: scanned });
    // "Not checked" is already the status: no second line saying the same.
    if (c.kind === "torrserver") return c.lastCheckedAt ? t("lastCheck", { time: relativeTime(c.lastCheckedAt, locale, tc("justNow")) }) : null;
    return [t("synced", { count: c.itemCount }), c.lastSyncedAt ? t("lastSync", { time: relativeTime(c.lastSyncedAt, locale, tc("justNow")) }) : t("neverScanned")].join(" · ");
  };
}

/**
 * Whether the active profile may use the server (SRV-03): explicit grants, or "every adult profile" when there are
 * none. Checking, scanning and the added releases go through the profile's own credentials — without access they'd
 * end in an error, so they aren't offered.
 */
export function profileHasAccess(c: Pick<ConnectionSummary, "profileIds">, me: Me | null) {
  const p = me?.activeProfile;
  if (!p) return false;
  return c.profileIds.length === 0 ? !p.isKids : c.profileIds.includes(p.id);
}

/**
 * The server's actions, shared by its row ("More") and its panel: check the connection, scan the library, remove the
 * server. One state per server, so the row and the panel show the same progress.
 */
export function useServerActions(c: ConnectionSummary, onChange: () => void) {
  const t = useTranslations("connections");
  const confirm = useConfirm();
  const [busy, setBusy] = useState<"test" | "scan" | null>(null);
  const [scanned, setScanned] = useState<number | null>(null);

  /**
   * `quiet`: the check the list runs by itself (SRV-08) — the row shows the result, a failure included: its status
   * and what went wrong, with "What to do" (no toast repeating "Unreachable" over the bottom of the screen; phones
   * 2026-10-30). A pressed check says its result in a toast as well.
   */
  const test = async ({ quiet = false }: { quiet?: boolean } = {}) => {
    setBusy("test");
    try {
      // The clients load only when a server is checked or scanned (bundle budget).
      const { clientFor } = await import("@/lib/media/clients");
      const client = await clientFor(c);
      const r = await client.test();
      await api(`/api/connections/${c.id}/check`, { method: "POST", json: { status: r.latencyMs > 2500 ? "degraded" : "ok", detail: r.version ?? null, serverVersion: r.version ?? null, latencyMs: r.latencyMs } });
      if (!quiet) toast.success(t("testOk", { name: c.name, version: r.version ?? "", latency: r.latencyMs }));
    } catch (e) {
      const status = e instanceof MediaNetError && e.code === "auth" ? "unauthorized" : "unreachable";
      try {
        // The failure's kind ("local_network", "timeout"…), never its text: the row says it in the person's words.
        await api(`/api/connections/${c.id}/check`, { method: "POST", json: { status, detail: failureDetail(e) } });
      } catch {
        // Only the stored status stays as it was; the toast below says what failed.
      }
      if (!quiet) toast.error(netErrorText(t, e, c.baseUrl));
    } finally {
      setBusy(null);
      onChange();
    }
  };

  const scan = async () => {
    setBusy("scan");
    setScanned(0);
    try {
      const { clientFor } = await import("@/lib/media/clients");
      const client = await clientFor(c);
      if (!client.scan) return;
      const entries: LibraryIndexEntry[] = await client.scan((p) => setScanned(p.scanned));
      const scanId = randomId();
      for (let i = 0; i < Math.max(entries.length, 1); i += 2000) {
        const chunk = entries.slice(i, i + 2000);
        await api(`/api/connections/${c.id}/index`, { method: "POST", json: { mode: "replace", entries: chunk, scanId, final: i + 2000 >= entries.length } });
      }
      toast.success(t("scanDone", { name: c.name, count: entries.length }));
    } catch (e) {
      toast.error(netErrorText(t, e));
    } finally {
      setBusy(null);
      setScanned(null);
      onChange();
    }
  };

  // Removing a server is asked first; the request runs in the dialog (X-12, 8.3).
  const remove = async () => {
    const ok = await confirm({
      title: t("removeConfirm", { name: c.name }),
      text: t("removeText"),
      confirmLabel: t("remove"),
      action: () => api(`/api/connections/${c.id}`, { method: "DELETE" }),
    });
    if (!ok) return false;
    navigator.serviceWorker?.controller?.postMessage({ type: "lumovio:forget-credentials" });
    toast.success(t("removed", { name: c.name }));
    onChange();
    return true;
  };

  return { test, scan, remove, busy, scanned };
}

export type ServerActions = ReturnType<typeof useServerActions>;
