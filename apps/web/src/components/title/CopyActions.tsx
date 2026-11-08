"use client";

import type { Availability, ConnectionSummary } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Info, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { TorrentConnection } from "@/components/connections/RemoveTorrentsDialog";
import { useMediaErrorText } from "@/components/sources/media-error";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { invalidateAvailability, loadTorrentManager, type ManagedTorrent, type TorrentManagerData } from "@/lib/media/torrent-manage";

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
 * "More" of a copy in "Where to watch" (design-system 7.15, TS8, SRC-15): details, and for a TorrServer copy of an adult
 * profile "Remove from TorrServer…", TS7's removal with its confirmation naming the server, the torrent and everything
 * linked to it. Nothing else (the owner, 2026-11-08: unlinking from the title or one episode is gone — another release
 * is chosen on the card, a copy that is not wanted is removed). A menu (a sheet on a phone) reached by touch, keyboard
 * and remote; opening it never starts playback.
 */
export function CopyActions({
  copy,
  manage,
  onRemove,
  onDetails,
  size = "md",
}: {
  copy: Availability;
  /** Remove: a TorrServer copy, adult profiles only. */
  manage: boolean;
  onRemove: (target: RemovalTarget) => void;
  onDetails: () => void;
  /** lg beside the card's large "Watch", md in a row. */
  size?: "md" | "lg";
}) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const mediaError = useMediaErrorText();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const hash = copy.externalId.split(":")[0]!.toLowerCase();
  const server = copy.connectionName;

  const gone = () => {
    invalidateAvailability(qc);
    focusFind();
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
    <Menu
      trigger={<IconButton icon={Ellipsis} label={tp("copyMore", { server })} variant="secondary" size={size} disabled={loading} aria-busy={loading || undefined} />}
      label={tp("copyMore", { server })}
      title={server}
    >
      <MenuItem icon={Info} onSelect={onDetails}>
        {tp("copyDetails")}
      </MenuItem>
      {manage && (
        <>
          <MenuSeparator />
          <MenuItem icon={Trash2} tone="danger" onSelect={() => void startRemoval()}>
            {tp("removeCopy")}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
