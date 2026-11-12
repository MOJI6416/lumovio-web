"use client";

import type { ImportJob, ImportSourceInfo, IntegrationAccount, IntegrationsOverview } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { type Status, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Link, linkClass } from "@/components/ui/Link";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { ApiRequestError, api, handle } from "@/lib/api";
import { apiErrorKey, importUploadErrorKey } from "@/lib/api-errors";
import { EXPORT_PAGE, LABEL } from "./import-shared";
import { ServerHistoryRead } from "./ServerHistoryRead";

/** As Settings → Sync colours an account's state. */
const ACCOUNT_STATUS: Record<IntegrationAccount["status"], Status> = { ok: "success", connecting: "neutral", reauth: "warning", error: "danger" };

/**
 * A source's window: everything to bring its history in, on the screen where its tile
 * was tapped. In order — the profile it goes to (only when there is a choice); Trakt and Simkl first offer signing in,
 * after which the history keeps coming by itself, then the file; the file: how to get it with a link to the service's
 * export page, "Choose file" (a file dropped anywhere on the window works too). A connected server is read instead.
 * The upload opens the import's own page with its review.
 */
export function SourceDialog({ info, onClose }: { info: ImportSourceInfo; onClose: () => void }) {
  const t = useTranslations("import");
  const ts = useTranslations("services");
  const tr = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { me } = useSession();
  const source = info.source;
  const service = LABEL[source];
  const profiles = me?.profiles ?? [];
  // Adults first; a kids profile is never the default target.
  const ordered = [...profiles.filter((p) => !p.isKids), ...profiles.filter((p) => p.isKids)];
  const [profileId, setProfileId] = useState(me?.activeProfile && !me.activeProfile.isKids ? me.activeProfile.id : (ordered[0]?.id ?? ""));
  const target = profiles.find((p) => p.id === profileId);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const account = source === "trakt" || source === "simkl";
  const integrations = useQuery({ queryKey: ["integrations"], queryFn: () => api<IntegrationsOverview>("/api/integrations"), enabled: account });
  const linked = account ? integrations.data?.accounts.find((a) => a.provider === source && a.profileId === profileId) : undefined;
  // Signing in is an adult profile's; a kids profile gets its history by a file an adult imports.
  const canConnect = account && Boolean(integrations.data?.available[source]) && !target?.isKids && !linked;
  const server = info.method === "server" && (source === "jellyfin" || source === "plex");

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>(`/api/integrations/${source}/connect`, { method: "POST", json: { profileId, locale } });
      window.location.assign(url);
    } catch (e) {
      toast.error(tr(apiErrorKey(e)));
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    // Only the files the source exports: a .txt is refused here, in words, before any upload.
    const ext = /\.[a-z0-9]+$/i.exec(file.name)?.[0]?.toLowerCase() ?? "";
    if (!info.accept.includes(ext)) {
      toast.error(t("errWrongType", { source: service, types: info.accept.join(", ") }));
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("source", source);
    fd.set("profileId", profileId);
    fd.set("file", file);
    try {
      // The server names what's wrong with a refused file; the toast says it in the person's language.
      const res = await fetch("/api/imports", { method: "POST", body: fd, credentials: "same-origin" }).catch(() => {
        throw new ApiRequestError(0, "network", "Network error");
      });
      const job = await handle<ImportJob>(res);
      router.push(`/import?job=${job.id}`);
    } catch (e) {
      toast.error(tr(importUploadErrorKey(e), { source: service }));
      setBusy(false);
    }
  };

  const exportPage = EXPORT_PAGE[source];
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()} title={t("uploadFrom", { source: service })} size="md">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a target for a dropped file only; "Choose file" is the control */}
      <div
        onDragOver={(e) => {
          if (server) return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (server) return;
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f && !busy) void upload(f);
        }}
        className={cn("-m-2 flex flex-col gap-6 rounded-md p-2 outline-2 outline-offset-2 outline-transparent transition-[outline-color] duration-fast", drag && "outline-dashed outline-line-2")}
      >
        {ordered.length > 1 && (
          <Field label={t("toProfile")} hint={<span className="sr-only">{t("sharedImports")}</span>} className="max-w-sm">
            {(id, describedBy) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={profileId}
                onValueChange={setProfileId}
                options={ordered.map((p) => ({ value: p.id, label: p.isKids ? t("kidsProfile", { name: p.name }) : p.name }))}
              />
            )}
          </Field>
        )}
        {target?.isKids && (
          <InlineAlert tone="warning" title={t("kidsTargetTitle", { name: target.name })}>
            {t("kidsTargetText")}
          </InlineAlert>
        )}

        {(canConnect || linked) && (
          <section aria-labelledby="src-account" className="flex flex-col gap-3">
            <h3 id="src-account" className="sr-only">
              {ts("connect", { service })}
            </h3>
            {linked ? (
              // Its state as Sync says it: "Connected", or "Sign-in needed" with the way there.
              <div className="flex flex-col items-start gap-2">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body text-text-1">
                  {t("accountLinked", { source: service, profile: target?.name ?? "" })}
                  <StatusBadge status={ACCOUNT_STATUS[linked.status] ?? "neutral"}>{ts(`status_${linked.status}`)}</StatusBadge>
                </p>
                <Link variant="action" arrow href="/settings/services">
                  {ts("title")}
                </Link>
              </div>
            ) : (
              <>
                <Button className="self-start" loading={busy} onClick={() => void connect()}>
                  {ts("connect", { service })}
                </Button>
                <p className="text-body-s text-text-2">{t("accountSync")}</p>
              </>
            )}
          </section>
        )}

        {server ? (
          <section aria-labelledby="src-file" className="flex flex-col gap-4">
            <h3 id="src-file" className="sr-only">
              {t("readHistory")}
            </h3>
            <p className="max-w-measure text-body-s text-text-2">{t(info.helpKey.replace("import.", "") as "help_jellyfin")}</p>
            <ServerHistoryRead source={source} busy={busy} onFile={(f) => void upload(f)} />
          </section>
        ) : (
          <section aria-labelledby="src-file" className={cn("flex flex-col gap-4", (canConnect || linked) && "border-t border-line pt-6")}>
            <h3 id="src-file" className={canConnect || linked ? "text-h3 text-text-1" : "sr-only"}>
              {t("orFile")}
            </h3>
            <p className="max-w-measure text-body-s text-text-2">{t(info.helpKey.replace("import.", "") as "help_trakt")}</p>
            {exportPage ? (
              <a href={exportPage} target="_blank" rel="noreferrer noopener" className={linkClass("action", "self-start")}>
                {t("openExport", { source: service })}
                <ExternalLink aria-hidden className="size-4 shrink-0" />
              </a>
            ) : (
              source === "lumovio" && (
                <Link variant="action" arrow href="/settings/privacy" className="self-start">
                  {t("lumovioExport")}
                </Link>
              )
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button variant={canConnect ? "secondary" : "primary"} icon={FileUp} loading={busy} onClick={() => input.current?.click()}>
                {t("chooseFile")}
              </Button>
              {/* Dropping needs a mouse; a touch screen only picks. While the file is read, that is said here. */}
              <span role="status" className={cn("text-body-s text-text-2", !busy && "pointer-coarse:hidden")}>
                {busy ? t("parsing") : t("orDrop", { types: info.accept.join(", ") })}
              </span>
            </div>
            <input
              ref={input}
              type="file"
              accept={info.accept.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                // Cleared, so the same file can be chosen again after a refused or failed upload.
                e.target.value = "";
                if (f) void upload(f);
              }}
            />
          </section>
        )}
      </div>
    </Dialog>
  );
}
