"use client";

import type { ConnectionSummary } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Plus, Server } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryState } from "@/components/ui/QueryState";
import { SettingsLink, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { MediaNetError } from "@/lib/media/net";
import { netErrorText, storedFailure } from "./net-errors";
import { ServerMark } from "./ServerMark";
import { profileHasAccess, STATUS, useServerActions, useServerFact } from "./server-actions";

export { netErrorText } from "./net-errors";

// The panel and the add/edit form (with the server clients) load when they are opened (bundle budget).
const ServerPanel = dynamic(() => import("./ServerPanel").then((m) => m.ServerPanel), { ssr: false });
const AddConnectionDialog = dynamic(() => import("./AddConnectionDialog").then((m) => m.AddConnectionDialog), { ssr: false });
const ConnectionHelp = dynamic(() => import("./ConnectionHelp").then((m) => m.ConnectionHelp), { ssr: false });

/** A server not checked for this long (or never) is checked when the list opens (SRV-08). */
const RECHECK_AFTER_MS = 24 * 3600_000;

/**
 * Settings → Servers (S19, design-system 7.16; audit SRV-03…SRV-06): the servers as rows of one group, as the rest of the
 * settings — the type's mark, the name, the type and address, one line of fact, the status in words at the end — each
 * row opening the server's panel (state, check, scan or added releases, settings, who may use it, address, removing);
 * "Add server" is the group's last row, "Help with connecting" a row of its own. A server this profile can't use says
 * so and its panel offers only what works without access.
 */
export function ConnectionsView({ initial }: { initial?: { connections: ConnectionSummary[] } }) {
  const t = useTranslations("connections");
  const th = useTranslations("connectionHelp");
  const qc = useQueryClient();
  const { me } = useSession();
  const [adding, setAdding] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // The list the page was rendered with (./page): the rows are there at once, so nothing below them moves when they
  // load (phones 2026-10-30: the footer jumped, CLS 0.26). It is read again here all the same: the check below goes by
  // this device's own read.
  const q = useQuery({
    queryKey: ["connections"],
    queryFn: () => api<{ connections: ConnectionSummary[] }>("/api/connections"),
    initialData: initial,
    refetchOnMount: "always",
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["connections"] });
  // "Not checked" doesn't wait for a press (SRV-08): the servers this profile may use that weren't checked for a day
  // are checked as the list opens, one at a time, each row saying "Checking…" until its usual status comes back.
  const [due, setDue] = useState<string[] | null>(null);
  useEffect(() => {
    if (due !== null || !q.data || !q.isFetchedAfterMount || !me) return;
    const now = Date.now();
    setDue(
      q.data.connections
        .filter((c) => profileHasAccess(c, me) && (!c.lastCheckedAt || now - new Date(c.lastCheckedAt).getTime() > RECHECK_AFTER_MS))
        .map((c) => c.id),
    );
  }, [due, q.data, q.isFetchedAfterMount, me]);
  const checked = useCallback(() => setDue((d) => d?.slice(1) ?? d), []);
  // How Lumovio reaches a server and what to do when it can't, per server type (./ConnectionHelp).
  const help = (
    <SettingsSection>
      <SettingsLink leading={<HelpCircle aria-hidden className="size-5 text-text-2" />} label={th("title")} opens onClick={() => setShowHelp(true)} />
    </SettingsSection>
  );

  return (
    <div className="space-y-8">
      <p className="sr-only">{t("intro")}</p>
      {/* A failed load is not "no servers" (X-14): an error with Retry, not "Add server". */}
      <QueryState
        query={q}
        loading={
          <SettingsSection>
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton shape="sm" className="size-10" />
                <span className="flex-1 space-y-2">
                  <Skeleton shape="xs" className="h-5 w-48" />
                  <Skeleton shape="xs" className="h-4 w-64" />
                </span>
              </div>
            ))}
          </SettingsSection>
        }
        isEmpty={(d) => d.connections.length === 0}
        empty={
          <div className="space-y-8">
            <EmptyState
              icon={Server}
              title={t("empty")}
              text={t("emptyText")}
              action={
                <Button icon={Plus} onClick={() => setAdding(true)}>
                  {t("add")}
                </Button>
              }
            />
            {help}
          </div>
        }
        error={{ title: t("loadError") }}
      >
        {(d) => (
          <div className="space-y-8">
            <SettingsSection>
              <ul aria-label={t("title")} className="divide-y divide-line">
                {d.connections.map((c) => (
                  <ServerRow key={c.id} conn={c} onChange={refresh} autoCheck={due?.[0] === c.id} onAutoChecked={checked} />
                ))}
              </ul>
              <SettingsLink leading={<Plus aria-hidden className="size-5 text-text-1" />} label={t("add")} opens onClick={() => setAdding(true)} />
            </SettingsSection>
            {help}
          </div>
        )}
      </QueryState>
      {showHelp && <ConnectionHelp onClose={() => setShowHelp(false)} />}
      {adding && (
        <AddConnectionDialog
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ServerRow({
  conn: c,
  onChange,
  autoCheck,
  onAutoChecked,
}: {
  conn: ConnectionSummary;
  onChange: () => void;
  /** This row's turn in the check the list runs by itself. */
  autoCheck: boolean;
  onAutoChecked: () => void;
}) {
  const t = useTranslations("connections");
  const th = useTranslations("connectionHelp");
  const { me } = useSession();
  const fact = useServerFact();
  const actions = useServerActions(c, onChange);
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const access = profileHasAccess(c, me);
  const testing = actions.busy === "test";
  const failure = c.status === "unreachable" || c.status === "unauthorized" ? storedFailure(c.statusDetail) : null;
  // Once per turn (React runs effects twice in development); a check already running — pressed — counts as it.
  const started = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: started by the turn only
  useEffect(() => {
    if (!autoCheck || started.current) return;
    started.current = true;
    if (actions.busy !== null) return onAutoChecked();
    void actions.test({ quiet: true }).then(onAutoChecked);
  }, [autoCheck]);
  const line = fact(c, actions.scanned);
  const address = c.baseUrl.replace(/^https?:\/\//, "");
  const status = testing ? t("testing") : t(`status_${c.status}`);

  return (
    <li>
      <SettingsLink
        leading={
          <span className="grid size-10 place-items-center rounded-sm bg-surface-2 text-text-2">
            <ServerMark kind={c.kind} />
          </span>
        }
        label={
          // On a phone the status goes by the name: at the end of the row it squeezed the address into three lines.
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold">{c.name}</span>
            <StatusBadge status={testing ? "neutral" : (STATUS[c.status] ?? "neutral")} className="shrink-0 sm:hidden">
              {status}
            </StatusBadge>
          </span>
        }
        detail={
          <>
            <span className="block truncate">
              {t(`kind_${c.kind}`)} · {address}
            </span>
            {!access && <span className="block">{t("noAccess")}</span>}
            {line && <span className="block">{line}</span>}
            {/* What the last failed check ran into, in words (in place of a toast over the screen; phones 2026-10-30). */}
            {failure && !testing && <span className="block">{netErrorText(t, new MediaNetError(failure, failure), c.baseUrl)}</span>}
          </>
        }
        value={
          <StatusBadge status={testing ? "neutral" : (STATUS[c.status] ?? "neutral")} className="max-sm:hidden">
            {status}
          </StatusBadge>
        }
        opens
        onClick={() => setOpen(true)}
        after={
          // What to do about a failed check (./ConnectionHelp, its steps first): a target of its own under the row's.
          failure && !testing && access ? (
            <div className="-mt-2 pb-3 ps-13">
              <Button variant="tertiary" size="sm" icon={HelpCircle} aria-haspopup="dialog" className="-ms-3" onClick={() => setHelp(true)}>
                {th("whatToDo")}
              </Button>
            </div>
          ) : undefined
        }
      />
      {open && <ServerPanel conn={c} access={access} actions={actions} onChange={onChange} onClose={() => setOpen(false)} />}
      {help && failure && <ConnectionHelp kind={c.kind} failure={failure} server={c} onRetry={() => void actions.test()} onClose={() => setHelp(false)} />}
    </li>
  );
}
