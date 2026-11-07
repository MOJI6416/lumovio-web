"use client";

// Types only: a value from @lumovio/contracts brings its zod schemas into the page's first load (bundle budget).
import type { ConnectionSummary, ServerHistory } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { netErrorText } from "@/components/connections/net-errors";
import { profileHasAccess } from "@/components/connections/server-actions";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Link } from "@/components/ui/Link";
import { Select } from "@/components/ui/Select";
import { api } from "@/lib/api";

/**
 * Import history from a connected Jellyfin or Plex (S13, C134; roadmap Stage 6): this device reads what the server's
 * sign-in has played — Lumovio's servers never contact it — and hands it to the import as a file, so it goes through the
 * same review, report and undo as any export. A server this profile can't use isn't offered; none — a link to Servers.
 */
export function ServerHistoryRead({ source, busy, onFile }: { source: "jellyfin" | "plex"; busy: boolean; onFile: (file: File) => void }) {
  const t = useTranslations("import");
  const tc = useTranslations("connections");
  const { me } = useSession();
  const conns = useQuery({ queryKey: ["connections"], queryFn: () => api<{ connections: ConnectionSummary[] }>("/api/connections") });
  const servers = (conns.data?.connections ?? []).filter((c) => c.kind === source && profileHasAccess(c, me));
  const [chosen, setChosen] = useState<string | null>(null);
  const server = servers.find((c) => c.id === chosen) ?? servers[0] ?? null;
  const [reading, setReading] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const name = source === "jellyfin" ? "Jellyfin" : "Plex";

  const read = async () => {
    if (!server) return;
    setProblem(null);
    setReading(0);
    try {
      // The server clients load only when they are used (bundle budget).
      const { clientFor } = await import("@/lib/media/clients");
      const client = await clientFor(server);
      const items = client.history ? await client.history((p) => setReading(p.scanned)) : [];
      if (items.length === 0) {
        setProblem(t("nothingPlayed", { server: server.name }));
        return;
      }
      const history: ServerHistory = { format: "lumovio-server-history/1", server: source, items };
      onFile(new File([JSON.stringify(history)], `${source}-history.json`, { type: "application/json" }));
    } catch (e) {
      setProblem(t("readFailed", { server: server.name, reason: netErrorText(tc, e, server.baseUrl) }));
    } finally {
      setReading(null);
    }
  };

  if (conns.isLoading) return null;
  // The servers didn't load: said with Retry, not "no server" (8.4).
  if (!conns.data && (conns.isError || conns.fetchStatus === "paused"))
    return <ErrorState variant="inline" error={conns.error} onRetry={() => void conns.refetch()} retrying={conns.isFetching} />;
  if (servers.length === 0) {
    return (
      <p className="text-body-s text-text-2">
        {t("noServer", { source: name })}{" "}
        <Link href="/settings/connections">{tc("title")}</Link>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {servers.length > 1 && (
        <Field label={t("fromServer")} className="max-w-sm">
          {(id, describedBy) => (
            <Select id={id} aria-describedby={describedBy} value={server?.id ?? ""} onValueChange={setChosen} options={servers.map((c) => ({ value: c.id, label: c.name }))} />
          )}
        </Field>
      )}
      {problem && <InlineAlert tone="warning">{problem}</InlineAlert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={History} loading={reading !== null || busy} onClick={() => void read()}>
          {t("readHistory")}
        </Button>
        <p role="status" className="text-body-s text-text-2">
          {reading !== null ? t("readingHistory", { server: server?.name ?? "", count: reading }) : busy ? t("parsing") : servers.length === 1 ? t("fromServerOne", { server: server!.name }) : ""}
        </p>
      </div>
    </div>
  );
}
