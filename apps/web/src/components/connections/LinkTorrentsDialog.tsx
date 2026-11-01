"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, RadioGroup } from "@/components/ui/Checkbox";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { SearchInput } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { catalogMatch, linkTorrents, type MatchTitle, titleName } from "@/lib/media/torrent-link";
import type { ManagedTorrent } from "@/lib/media/torrent-manage";



/** "Film · Dune": what kind of title it is and its original name when it differs. */
function useTitleFact() {
  const t = useTranslations("torrentManager");
  return (c: MatchTitle) => [c.kind === "movie" ? t("film") : t("series"), c.originalTitle && c.originalTitle !== c.title ? c.originalTitle : null].filter(Boolean).join(" · ");
}

/**
 * Linking one release already on the server to a title (TS7 «Не связано в Lumovio», C133): the titles its name fits —
 * the sure one chosen — and a search of the catalog for another. The release becomes the title's copy on this server;
 * it stays on the server as it is. Nothing is linked until «Link».
 */
export function LinkTorrentDialog({
  connection,
  torrent,
  candidates,
  initial,
  onClose,
}: {
  connection: { id: string; name: string };
  torrent: Pick<ManagedTorrent, "hash" | "name">;
  candidates: MatchTitle[];
  initial: MatchTitle | null;
  /** True when it was linked. */
  onClose: (linked: boolean) => void;
}) {
  const t = useTranslations("torrentManager");
  const tc = useTranslations("common");
  const fact = useTitleFact();
  const [chosen, setChosen] = useState<string | null>(initial?.id ?? null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<MatchTitle[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // The catalog for the typed name, a moment after typing stops.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFound(null);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      catalogMatch([{ key: "q", query: q }])
        .then((r) => live && setFound(r.q ?? []))
        .catch(() => live && setFound([]))
        .finally(() => live && setSearching(false));
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const options = [...candidates, ...(found ?? [])].filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i);
  const pick = options.find((c) => c.id === chosen) ?? null;

  const link = async () => {
    if (!pick) return;
    setBusy(true);
    setFailed(false);
    try {
      await linkTorrents(connection.id, [{ hash: torrent.hash, titleId: pick.id, label: torrent.name }]);
      toast.success(t("linked", { title: titleName(pick) }));
      onClose(true);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose(false)} title={t("linkTitle")} description={torrent.name} size="md">
      <div className="flex flex-col gap-4">
        <p className="text-body-s text-text-2">{t("linkHint", { server: connection.name })}</p>
        {options.length > 0 && (
          <RadioGroup
            legend={t("titleLegend")}
            value={chosen}
            onValueChange={setChosen}
            options={options.map((c) => ({ value: c.id, label: titleName(c), description: fact(c) }))}
          />
        )}
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder={t("findPlaceholder")}
          aria-label={t("findTitle")}
        />
        <p role="status" className="text-body-s text-text-2">
          {searching ? t("searching") : found && found.length === 0 ? t("noTitles") : ""}
        </p>
        {pick?.kind === "tv" && <p className="text-body-s text-text-2">{t("linkSeriesHint")}</p>}
        {failed && <InlineAlert tone="danger">{t("linkFailed")}</InlineAlert>}
      </div>
      <DialogActions>
        <Button variant="secondary" disabled={busy} onClick={() => onClose(false)}>
          {tc("cancel")}
        </Button>
        <Button loading={busy} disabled={!pick} onClick={() => void link()}>
          {t("link")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * «Review and link» (C133): every release not linked in Lumovio whose title is sure — by its own data or by its name
 * and year — as a pair to check; an unchecked pair is left as it is. One request links the checked ones.
 */
export function LinkAllDialog({
  connection,
  pairs,
  onClose,
}: {
  connection: { id: string; name: string };
  pairs: { torrent: Pick<ManagedTorrent, "hash" | "name">; title: MatchTitle }[];
  onClose: (linked: boolean) => void;
}) {
  const t = useTranslations("torrentManager");
  const tc = useTranslations("common");
  const fact = useTitleFact();
  const [checked, setChecked] = useState<Set<string>>(() => new Set(pairs.map((p) => p.torrent.hash)));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const picked = pairs.filter((p) => checked.has(p.torrent.hash));

  const link = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await linkTorrents(
        connection.id,
        picked.map((p) => ({ hash: p.torrent.hash, titleId: p.title.id, label: p.torrent.name })),
      );
      toast.success(t("linkedCount", { count: picked.length }));
      onClose(true);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose(false)} title={t("linkAllTitle")} description={t("linkAllHint", { server: connection.name })} size="lg">
      <ul className="flex flex-col divide-y divide-line">
        {pairs.map((p) => (
          <li key={p.torrent.hash} className="py-3 first:pt-0">
            <Checkbox
              label={titleName(p.title)}
              description={
                <>
                  <span className="block">{fact(p.title)}</span>
                  <span className="block break-words text-text-3">{p.torrent.name}</span>
                </>
              }
              checked={checked.has(p.torrent.hash)}
              onCheckedChange={(on) =>
                setChecked((s) => {
                  const n = new Set(s);
                  if (on) n.add(p.torrent.hash);
                  else n.delete(p.torrent.hash);
                  return n;
                })
              }
            />
          </li>
        ))}
      </ul>
      {failed && <InlineAlert tone="danger" className="mt-4">{t("linkFailed")}</InlineAlert>}
      <DialogActions>
        <Button variant="secondary" disabled={busy} onClick={() => onClose(false)}>
          {tc("cancel")}
        </Button>
        <Button loading={busy} disabled={picked.length === 0} onClick={() => void link()}>
          {t("linkAllConfirm", { count: picked.length })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
