"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { TvButton } from "@/components/ui/tv/TvButton";
import { libraryKey } from "@/hooks/useLibraryState";
import { api } from "@/lib/api";
import { randomId } from "@/lib/random-id";
import { useAction } from "@/lib/use-action";
import { TvLayer } from "../nav/TvLayer";
import { useTvNav } from "../nav/TvNav";

/*
 * The panel of a TV card's "More" (./hold, design-system 8.3, 10.3): the title's name and its removal — from Continue
 * watching (HOME-01), from the history (the title's every viewing, LIB-25), from a list (LIB-01) — with the site's
 * requests and words. Done, the card is gone from its screen at once and the panel says what happened, with "Undo"
 * focused: the TV's toast, which a remote can reach. Back or "Close" ends it, the focus on the card that took the
 * removed one's place; after Undo, on the card again. The screen's data follows once the panel closes.
 */

/** What "More" was opened on. */
export type CardTarget =
  | { kind: "continue"; title: TitleSummary; details?: string; refresh?: boolean }
  | { kind: "history"; title: TitleSummary; ids: string[] }
  | { kind: "list"; title: TitleSummary; list: { id: string; name: string } };

export function CardMoreLayer({
  target,
  hide,
  onClose,
}: {
  target: CardTarget;
  /** Takes the card off its screen at once (8.3); returns how to put it back. */
  hide: () => () => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const qc = useQueryClient();
  const router = useRouter();
  const nav = useTvNav();
  const x = target.title;
  // One key for the removal and its Undo (the history keeps what it removed under it).
  const [undoKey] = useState(randomId);
  const r =
    target.kind === "continue"
      ? {
          label: t("card.removeFromContinue"),
          done: t("rows.removedFromContinue", { title: x.title }),
          failed: t("rows.removeFromContinueFailed", { title: x.title }),
          run: () => api(`/api/continue/${x.id}`, { method: "DELETE" }),
          undo: () => api(`/api/continue/${x.id}/restore`, { method: "POST", json: {} }),
        }
      : target.kind === "history"
        ? {
            label: t("library.removeFromHistory"),
            done: t("library.entryRemoved", { title: x.title }),
            failed: t("library.entryRemoveFailed", { title: x.title }),
            // Every viewing of the title up to now, also those the page hasn't loaded (the site's row span, LIB-27).
            run: () =>
              api("/api/history/remove", {
                method: "POST",
                json: {
                  ids: target.ids,
                  undoKey,
                  span: { titleId: x.id, from: new Date(0).toISOString(), to: new Date(Date.now() + 864e5).toISOString() },
                },
              }),
            undo: () => api("/api/history/restore", { method: "POST", json: { undoKey } }),
          }
        : {
            label: t("library.removeFromList"),
            done: t("library.removedFromList", { title: x.title, list: target.list.name }),
            failed: t("library.removeFromListFailed", { title: x.title }),
            run: () => api(`/api/lists/${target.list.id}/items/${x.id}`, { method: "DELETE" }),
            undo: () => api(`/api/lists/${target.list.id}/items/${x.id}/restore`, { method: "POST", json: {} }),
          };
  const sync = () => {
    void qc.invalidateQueries({ queryKey: libraryKey(x.id) });
    if (target.kind === "continue") {
      void qc.invalidateQueries({ queryKey: ["continue"] });
      // The home's shelves are the server's: Back to it later mustn't bring the card back from the router's cache.
      if (target.refresh) router.refresh();
    } else if (target.kind === "history") {
      void qc.invalidateQueries({ queryKey: ["history-tv"] });
      void qc.invalidateQueries({ queryKey: ["history"] });
    } else {
      void qc.invalidateQueries({ queryKey: ["list-tv", target.list.id] });
      void qc.invalidateQueries({ queryKey: ["library-list"] });
      void qc.invalidateQueries({ queryKey: ["lists"] });
    }
  };

  const [removed, setRemoved] = useState(false);
  const putBack = useRef<(() => void) | null>(null);
  // The screen's data is brought up to date once the panel closes, not while it is open: Undo then puts the card back
  // from what the screen still has, at once and in its place.
  const changed = useRef(false);
  const remove = useAction({
    run: r.run,
    optimistic: () => {
      const back = hide();
      putBack.current = back;
      return back;
    },
    error: r.failed,
  });
  const undo = useAction({ run: r.undo, error: t("common.undoFailed") });
  return (
    <TvLayer
      label={x.title}
      onClose={() => {
        if (changed.current) sync();
        onClose();
      }}
    >
      {(close) => (
        <>
          <h2 className="text-h2 text-text-1">{x.title}</h2>
          {removed ? (
            <>
              <p role="status" className="text-body-l text-text-1">
                {r.done}
              </p>
              <div data-zone="more" data-zone-axis="y" className="flex flex-col gap-3">
                <TvButton
                  look="row"
                  data-tv-initial
                  loading={undo.pending}
                  onClick={async () => {
                    if (!(await undo.run()).ok) return;
                    // The card is back on its screen before the panel closes, so the focus returns to it.
                    flushSync(() => putBack.current?.());
                    close();
                  }}
                >
                  {t("common.undo")}
                </TvButton>
                <TvButton look="row" onClick={close}>
                  {t("common.close")}
                </TvButton>
              </div>
            </>
          ) : (
            <div data-zone="more" data-zone-axis="y" className="flex flex-col gap-3">
              {target.kind === "continue" && target.details && (
                // Through the shell, which closes this layer first: no empty step of Back stays behind.
                <TvButton look="row" icon={Info} onClick={() => nav.navigate(target.details!)}>
                  {t("card.details")}
                </TvButton>
              )}
              <TvButton
                look="row"
                icon={X}
                loading={remove.pending}
                onClick={async () => {
                  if (!(await remove.run()).ok) return;
                  changed.current = true;
                  setRemoved(true);
                }}
              >
                {r.label}
              </TvButton>
            </div>
          )}
        </>
      )}
    </TvLayer>
  );
}
