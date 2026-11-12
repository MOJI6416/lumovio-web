"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import type { RankedRelease } from "@/lib/media/releases";
import type { TsSearchResult } from "@/lib/media/torrserver";
import { Facts } from "./Facts";
import { ReleaseLine, useReleaseFacts, useReleaseText } from "./release-text";

/**
 * "Release details", one dialog wherever a release is shown — the card of "Where to watch", the sources
 * screen and its rows, the sources over the player: the marks and the audio under the heading, every fact its name and
 * the indexer give, and "Watch". Centred from `md`, a bottom sheet on a phone; the TV's is tvui/sources/TvFinder.
 * `note` says for a screen reader what "Watch" does (adds it to the server, or plays the copy already there).
 */
export function ReleaseDetails({
  result: r,
  release: x,
  tv,
  note,
  loading,
  onWatch,
  onClose,
}: {
  result: TsSearchResult | null;
  release: RankedRelease | undefined;
  /** A series: its pack's seasons, a pack's size said as the whole pack's. */
  tv: boolean;
  note: string;
  loading?: boolean;
  onWatch: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const tp = useTranslations("titlePage");
  const text = useReleaseText();
  const facts = useReleaseFacts();
  return (
    <Dialog
      size="lg"
      open={r !== null}
      onOpenChange={(o) => !o && onClose()}
      title={tp("releaseDetails")}
      description={x ? <ReleaseLine info={x.info} rest={[text.audio(x)]} /> : undefined}
    >
      {r && !x && <p className="mb-4 text-body-s text-text-2">{t("detailOtherTitle")}</p>}
      {r && <Facts rows={facts(r, x, tv)} />}
      <DialogActions>
        <Button loading={loading} onClick={onWatch}>
          <Play aria-hidden className="fill-current" />
          {tt("tsWatch")}
        </Button>
      </DialogActions>
      <p className="sr-only">{note}</p>
    </Dialog>
  );
}
