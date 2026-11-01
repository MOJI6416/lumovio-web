"use client";

import type { ConnectionSummary } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, HelpCircle, Plus, Server } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { StatusBadge, Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { lazyControl, OPEN_KEYS, useLazySwap } from "@/components/ui/lazy-swap";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { MediaNetError } from "@/lib/media/net";
import { netErrorText, storedFailure } from "./net-errors";
import { ServerMark } from "./ServerMark";
import type { ServerMenuProps } from "./ServerMenu";
import { profileHasAccess, STATUS, useServerActions, useServerFact } from "./server-actions";

export { netErrorText } from "./net-errors";

// The panel and the add/edit form (with the server clients) load when they are opened (bundle budget).
const ServerPanel = dynamic(() => import("./ServerPanel").then((m) => m.ServerPanel), { ssr: false });
const AddConnectionDialog = dynamic(() => import("./AddConnectionDialog").then((m) => m.AddConnectionDialog), { ssr: false });
const ConnectionHelp = dynamic(() => import("./ConnectionHelp").then((m) => m.ConnectionHelp), { ssr: false });
const serverMenu = lazyControl(() => import("./ServerMenu"));

/** A server not checked for this long (or never) is checked when the list opens (SRV-08). */
const RECHECK_AFTER_MS = 24 * 3600_000;

/**
 * Settings → Servers (S19, design-system 7.16; audit SRV-03…SRV-06): one row per server — the type's mark, the name,
 * the status in words, the address and one line of fact — with "Open" (the server's panel with its settings and
 * actions) and "More" (check, scan, added releases, remove). A server this profile can't use says so and offers only
 * what works without access.
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-measure text-body text-text-2">{t("intro")}</p>
        <Button icon={Plus} onClick={() => setAdding(true)}>
          {t("add")}
        </Button>
      </div>
      <div>
        {/* How Lumovio reaches a server and what to do when it can't, per server type (./ConnectionHelp). */}
        <Button variant="tertiary" size="sm" icon={HelpCircle} aria-haspopup="dialog" className="-ms-3" onClick={() => setShowHelp(true)}>
          {th("title")}
        </Button>
      </div>
      {showHelp && <ConnectionHelp onClose={() => setShowHelp(false)} />}

      {/* A failed load is not "no servers" (X-14): an error with Retry, not "Add server". */}
      <QueryState
        query={q}
        loading={
          <div className="divide-y divide-line rounded-md border border-line bg-surface-1">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 md:p-6">
                <Skeleton shape="sm" className="size-10" />
                <span className="flex-1 space-y-2">
                  <Skeleton shape="xs" className="h-5 w-48" />
                  <Skeleton shape="xs" className="h-4 w-64" />
                </span>
              </div>
            ))}
          </div>
        }
        isEmpty={(d) => d.connections.length === 0}
        empty={<EmptyState icon={Server} title={t("empty")} text={t("emptyText")} action={<Button onClick={() => setAdding(true)}>{t("add")}</Button>} />}
        error={{ title: t("loadError") }}
      >
        {(d) => (
          <ul aria-label={t("title")} className="divide-y divide-line rounded-md border border-line bg-surface-1">
            {d.connections.map((c) => (
              <ServerRow key={c.id} conn={c} onChange={refresh} autoCheck={due?.[0] === c.id} onAutoChecked={checked} />
            ))}
          </ul>
        )}
      </QueryState>
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

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 md:p-6">
      <span className="grid size-10 shrink-0 place-items-center self-start rounded-sm bg-surface-2 text-text-2">
        <ServerMark kind={c.kind} />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="min-w-0 truncate text-title text-text-1">{c.name}</h2>
          <Tag>{t(`kind_${c.kind}`)}</Tag>
          {testing ? <StatusBadge status="neutral">{t("testing")}</StatusBadge> : <StatusBadge status={STATUS[c.status] ?? "neutral"}>{t(`status_${c.status}`)}</StatusBadge>}
          {!access && <Tag>{t("noAccess")}</Tag>}
        </div>
        <p className="mt-1 truncate text-body-s text-text-2">{c.baseUrl}</p>
        {fact(c, actions.scanned) && <p className="text-body-s text-text-2">{fact(c, actions.scanned)}</p>}
        {/* What the last failed check ran into, in words (in place of a toast over the screen; phones 2026-10-30), and
            what to do about it (./ConnectionHelp, its steps first). */}
        {failure && !testing && (
          <>
            <p className="text-body-s text-text-2">{netErrorText(t, new MediaNetError(failure, failure), c.baseUrl)}</p>
            {access && (
              <Button variant="tertiary" size="sm" icon={HelpCircle} aria-haspopup="dialog" className="-ms-3 mt-1" onClick={() => setHelp(true)}>
                {th("whatToDo")}
              </Button>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-2 max-sm:w-full max-sm:ps-14">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {t("open")}
        </Button>
        <ServerMore conn={c} access={access} actions={actions} />
      </div>
      {open && <ServerPanel conn={c} access={access} actions={actions} onChange={onChange} onClose={() => setOpen(false)} />}
      {help && failure && <ConnectionHelp kind={c.kind} failure={failure} server={c} onRetry={() => void actions.test()} onClose={() => setHelp(false)} />}
    </li>
  );
}

/** "More" of a row: a light button until the pointer or the focus comes to it, then the menu itself (./ServerMenu). */
function ServerMore(props: ServerMenuProps) {
  const t = useTranslations("connections");
  const light = useRef<HTMLButtonElement>(null);
  const { full: m, start, activate } = useLazySwap(serverMenu, light);
  if (m) return <m.ServerMenu {...props} initialOpen={start.open} focusTrigger={start.focus} />;
  return (
    <IconButton
      ref={light}
      icon={Ellipsis}
      label={t("moreFor", { name: props.conn.name })}
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
