"use client";

import type { Availability, ConnectionSummary } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Info, Link2Off, ListX, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { TorrentConnection } from "@/components/connections/RemoveTorrentsDialog";
import { ranges, useMediaErrorText } from "@/components/sources/media-error";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { invalidateAvailability, loadTorrentManager, type ManagedTorrent, type TorrentManagerData } from "@/lib/media/torrent-manage";
import type { TitleCore } from "./core";

// The TS7 removal (its confirmation and per-torrent results) loads when a removal is asked for.
const RemoveTorrentsDialog = dynamic(() => import("@/components/connections/RemoveTorrentsDialog").then((m) => m.RemoveTorrentsDialog), { ssr: false });

/** Where focus goes once a copy is gone from the list: the action that is still there. */
export const FIND_SOURCE_ID = "find-another-source";

/** A removal about to be confirmed: the server's own entry for the torrent and what the index links to it. */
export type RemovalTarget = { connection: TorrentConnection; torrent: ManagedTorrent; titles: TorrentManagerData["titles"] };

const focusFind = () => requestAnimationFrame(() => document.getElementById(FIND_SOURCE_ID)?.focus());

/**
 * TS7's confirmation and results for one copy. It lives beside the list, not in the copy's row: the row goes as soon as
 * the removal updates availability, and the results (with a retry when only Lumovio's links are left) must stay until
 * the person closes them. Its "Remove" is the dialog's danger button — the only red one (SRC-15).
 */
export function CopyRemovalDialog({ target, onClose }: { target: RemovalTarget; onClose: () => void }) {
  return (
    <RemoveTorrentsDialog
      connection={target.connection}
      torrents={[target.torrent]}
      titles={target.titles}
      onClose={(results) => {
        onClose();
        if (results?.some((r) => r.status === "removed" || r.status === "index_pending")) focusFind();
      }}
    />
  );
}

/**
 * "More" of a copy in "Where to watch" (design-system 7.15, TS8, SRC-15): details; for a TorrServer copy of an adult
 * profile also "Unlink from title" — the torrent stays on the server, other titles keep it; a series says which
 * episodes' files go with it, and one episode's file can be unlinked alone — and "Remove from TorrServer…", TS7's
 * removal with its confirmation naming the server, the torrent and everything linked to it. A menu (a sheet on a
 * phone) reached by touch, keyboard and remote; opening it never starts playback.
 */
export function CopyActions({
  title: d,
  copy,
  episodes,
  manage,
  onRemove,
  onDetails,
}: {
  title: TitleCore;
  copy: Availability;
  episodes: Availability[];
  /** Unlink and remove: a TorrServer copy, adult profiles only. */
  manage: boolean;
  onRemove: (target: RemovalTarget) => void;
  onDetails: () => void;
}) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tm = useTranslations("torrentManager");
  const tpl = useTranslations("player");
  const mediaError = useMediaErrorText();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [loading, setLoading] = useState(false);
  const hash = copy.externalId.split(":")[0]!.toLowerCase();
  const server = copy.connectionName;
  const bound = [...episodes].sort((a, b) => a.season! - b.season! || a.episode! - b.episode!);
  const epLabel = (f: Availability) => tpl("episodeLabel", { season: f.season!, episode: f.episode! });
  // "S2: E1–3 · 3 episodes": the episodes whose files go with the torrent.
  const scope = () => {
    const seasons = [...new Set(bound.map((f) => f.season!))];
    return [
      ...seasons.map((s) => tm("season", { season: s, episodes: ranges([...new Set(bound.filter((f) => f.season === s).map((f) => f.episode!))]) })),
      tm("episodes", { count: new Set(bound.map((f) => `${f.season}:${f.episode}`)).size }),
    ].join(" · ");
  };

  const gone = () => {
    invalidateAvailability(qc);
    focusFind();
  };

  /** Unlinking: confirmed with what changes and what stays; it runs in the dialog, a failure is said there. */
  const unlink = async (file?: Availability) => {
    const episode = file ? { season: file.season!, episode: file.episode! } : undefined;
    const ok = await confirm({
      title: file ? t("unlinkEpisodeTitle", { episode: epLabel(file) }) : tp("unlinkTitle", { title: d.title }),
      text: (
        <>
          {file ? t("unlinkEpisodeText", { server }) : t("unlinkText", { server })}
          {!file && bound.length > 0 && <span className="mt-2 block text-text-1">{t("unlinkWithEpisodes", { scope: scope() })}</span>}
        </>
      ),
      confirmLabel: tp("unlinkConfirm"),
      tone: "primary",
      action: () => api(`/api/connections/${copy.connectionId}/index/unlink`, { method: "POST", json: { titleId: d.id, hash, episode } }),
      error: (e) => t("unlinkFailed", { error: mediaError(e) }),
    });
    if (!ok) return;
    if (file) {
      // The torrent stays a copy of the series: the row stays, the episode leaves its list.
      toast.success(t("unlinkedEpisode", { episode: epLabel(file), server }));
      invalidateAvailability(qc);
    } else {
      toast.success(t("unlinked", { server }));
      gone();
    }
  };

  // The removal works on the server's own entry (size, activity) and everything the index links to it.
  const startRemoval = async () => {
    setLoading(true);
    try {
      const [{ connections }, data] = await Promise.all([api<{ connections: ConnectionSummary[] }>("/api/connections"), loadTorrentManager(copy.connectionId)]);
      const connection = connections.find((c) => c.id === copy.connectionId);
      const torrent = data.torrents.find((x) => x.hash === hash);
      if (!connection) {
        toast.error(t("removeCantStart", { server, error: t("removeNoServer") }));
        return;
      }
      if (!torrent) {
        // Reading a full list already dropped the links of a torrent it no longer has; an empty list
        // proves nothing (TS7), so then the copy stays and can still be unlinked by hand.
        if (data.reconciled.some((r) => r.hash === hash && r.status === "removed")) {
          toast.info(t("copyNotOnServer", { server }));
          gone();
        } else toast.info(t("copyMissingKept", { server }));
        return;
      }
      onRemove({ connection, torrent, titles: data.titles });
    } catch (e) {
      toast.error(t("removeCantStart", { server, error: mediaError(e) }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Menu
        trigger={<IconButton icon={Ellipsis} label={tp("copyMore", { server })} variant="secondary" size="md" disabled={loading} aria-busy={loading || undefined} />}
        label={tp("copyMore", { server })}
        title={server}
      >
        <MenuItem icon={Info} onSelect={onDetails}>
          {tp("copyDetails")}
        </MenuItem>
        {manage && (
          <>
            {bound.length > 0 && <MenuLabel>{t("copyEpisodes", { scope: scope() })}</MenuLabel>}
            <MenuItem icon={Link2Off} onSelect={() => void unlink()}>
              {tp("unlinkCopy")}
            </MenuItem>
            {bound.length > 0 && (
              <MenuItem icon={ListX} onSelect={() => setShowEpisodes(true)}>
                {t("unlinkOneEpisode")}
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem icon={Trash2} tone="danger" onSelect={() => void startRemoval()}>
              {tp("removeCopy")}
            </MenuItem>
          </>
        )}
      </Menu>
      {bound.length > 0 && (
        <Dialog open={showEpisodes} onOpenChange={setShowEpisodes} title={t("unlinkOneEpisode")} description={t("copyActionsHint", { server })}>
          <ul className="max-w-full space-y-1">
            {bound.map((f) => (
              <li key={f.externalId + epLabel(f)} className="flex items-center gap-2 rounded-sm border border-line px-2 py-1.5">
                <span className="min-w-0 flex-1 text-body-s">
                  <span className="font-semibold text-text-1">{epLabel(f)}</span>
                  {f.label && <span className="ms-1.5 break-all text-text-2">{f.label}</span>}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={t("unlinkEpisodeAction", { episode: epLabel(f) })}
                  onClick={() => {
                    setShowEpisodes(false);
                    void unlink(f);
                  }}
                >
                  {t("unlinkEpisodeShort")}
                </Button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </>
  );
}
