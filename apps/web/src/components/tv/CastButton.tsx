"use client";

import { Tv } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { IconButton, type IconButtonSize, type IconButtonVariant } from "@/components/ui/IconButton";
import { type CastTarget, onlineTvs, useTvs } from "./cast";

// The dialog and its live remote load when the button is approached or pressed (bundle budget: the title page).
const loadDialog = () => import("./CastDialog");
const CastDialog = dynamic(loadDialog, { ssr: false });

/**
 * "Watch on TV" (design-system 8.18, 6.4: `Tv`): a circle beside the button that starts the same viewing here — the title's
 * main button, a copy's "Watch" in "Where to watch", the player's bar. Drawn only while a TV of the account has Lumovio
 * open; a lime dot while that TV plays this title (`resume`: pressing it then opens its remote instead of sending again).
 * `target` is read at the press: the player's position and track as they are then.
 */
export function CastButton({
  target,
  titleId,
  resume = false,
  size = "lg",
  variant = "secondary",
  onSent,
}: {
  target: () => CastTarget;
  /** "movie:603": the TV playing it is said by the dot. */
  titleId: string;
  /** A press while a TV plays this title opens its remote (the hero); else it always sends (a copy, the player). */
  resume?: boolean;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  onSent?: () => void;
}) {
  const t = useTranslations("cast");
  const id = useId();
  const tvs = useTvs();
  const online = onlineTvs(tvs.data?.devices);
  const [open, setOpen] = useState<{ mode: "send" } | { mode: "remote"; tvId: string } | null>(null);
  const playing = online.find((d) => d.playback?.titleId === titleId && d.playback.state !== "failed" && d.playback.state !== "ended");
  if (online.length === 0 && !open) return null;
  return (
    <>
      <span className="relative inline-flex shrink-0">
        <IconButton
          icon={Tv}
          label={t("button")}
          variant={variant}
          size={size}
          aria-haspopup="dialog"
          aria-describedby={playing ? id : undefined}
          onPointerEnter={() => void loadDialog()}
          onFocus={() => void loadDialog()}
          onClick={() => setOpen(resume && playing ? { mode: "remote", tvId: playing.id } : { mode: "send" })}
        />
        {playing && (
          <>
            <span aria-hidden className="pointer-events-none absolute end-2 top-2 size-2 rounded-full bg-accent" />
            <span id={id} className="sr-only">
              {t("onTvNow")}
            </span>
          </>
        )}
      </span>
      {open && <CastDialog target={target} start={open} onClose={() => setOpen(null)} onSent={onSent} />}
    </>
  );
}
